import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email', 'profile'];

const SECURE_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  REFRESH_TOKEN: 'google_refresh_token',
  EXPIRES_AT: 'google_expires_at',
  USER_EMAIL: 'google_user_email',
};

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms timestamp
  email?: string;
}

export function getGoogleClientId(): string {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID is not set. ' +
      'Create a .env file with your Google OAuth Client ID.'
    );
  }
  return clientId;
}

export function useGoogleAuthRequest() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'receipttracker' });
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri, discovery };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const clientId = getGoogleClientId();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = await res.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };

  await storeTokens(tokens);
  return tokens;
}

async function storeTokens(tokens: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  await SecureStore.setItemAsync(SECURE_KEYS.EXPIRES_AT, String(tokens.expiresAt));
  if (tokens.email) {
    await SecureStore.setItemAsync(SECURE_KEYS.USER_EMAIL, tokens.email);
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);
  const expiresAtStr = await SecureStore.getItemAsync(SECURE_KEYS.EXPIRES_AT);

  if (!accessToken || !expiresAtStr) return null;

  const expiresAt = Number(expiresAtStr);
  const fiveMinutes = 5 * 60 * 1000;

  // Token is still valid
  if (Date.now() < expiresAt - fiveMinutes) {
    return accessToken;
  }

  // Attempt refresh
  return await refreshAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;

  const clientId = getGoogleClientId();

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    await signOut();
    return null;
  }

  const data = await res.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, data.access_token);
  await SecureStore.setItemAsync(SECURE_KEYS.EXPIRES_AT, String(expiresAt));

  return data.access_token;
}

export async function isSignedIn(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);
  return !!token;
}

export async function signOut(): Promise<void> {
  for (const key of Object.values(SECURE_KEYS)) {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function getUserEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEYS.USER_EMAIL);
}

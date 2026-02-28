import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { AuthRequest, AuthSessionResult } from 'expo-auth-session';

import {
  useGoogleAuthRequest,
  exchangeCodeForTokens,
  isSignedIn,
  signOut,
  getUserEmail,
} from '../services/auth';
import { getReceipts, getPendingSync } from '../services/database';
import { syncPendingReceipts } from '../services/googleDrive';
import { writeCsvToCache } from '../services/fileStorage';
import { Receipt, formatAmount } from '../types';

export default function SettingsScreen() {
  const [connected, setConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { request, response, promptAsync, redirectUri, discovery } = useGoogleAuthRequest();

  useEffect(() => {
    checkAuthState();
  }, []);

  useEffect(() => {
    if (response?.type === 'success' && response.params?.code) {
      handleAuthCode(response.params.code);
    } else if (response?.type === 'error') {
      Alert.alert('Sign In Failed', response.error?.message ?? 'Google sign-in was cancelled or failed.');
    }
  }, [response]);

  async function checkAuthState() {
    const signedIn = await isSignedIn();
    setConnected(signedIn);
    if (signedIn) {
      const email = await getUserEmail();
      setUserEmail(email);
    }
  }

  async function handleAuthCode(code: string) {
    if (!request?.codeVerifier) return;
    try {
      await exchangeCodeForTokens(code, request.codeVerifier, redirectUri);
      setConnected(true);
      await checkAuthState();
      // Mark all existing receipts as pending so they get synced
      const receipts = await getReceipts();
      const { updateReceipt } = await import('../services/database');
      for (const r of receipts) {
        if (r.syncStatus === 'not_configured' || r.syncStatus === 'failed') {
          await updateReceipt(r.id, { syncStatus: 'pending' });
        }
      }
      Alert.alert('Connected!', 'Google Drive connected. Your receipts will sync automatically.');
    } catch {
      Alert.alert('Error', 'Failed to connect Google Drive. Please try again.');
    }
  }

  async function handleDisconnect() {
    Alert.alert('Disconnect Google Drive', 'Your local receipts will be kept, but they will no longer sync to Drive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setConnected(false);
          setUserEmail(null);
        },
      },
    ]);
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const pending = await getPendingSync();
      if (pending.length === 0) {
        Alert.alert('All Synced', 'All receipts are already synced to Google Drive.');
        return;
      }
      const result = await syncPendingReceipts(pending);
      Alert.alert(
        'Sync Complete',
        `Uploaded: ${result.success}\nFailed: ${result.failed}`
      );
    } catch (err) {
      Alert.alert('Sync Error', 'An error occurred during sync. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const receipts = await getReceipts();
      if (receipts.length === 0) {
        Alert.alert('No Receipts', 'You have no receipts to export.');
        return;
      }
      const csv = generateCSV(receipts);
      const filePath = await writeCsvToCache(csv, 'receipts_export.csv');
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Receipts as CSV',
        UTI: 'public.comma-separated-values-text',
      });
    } catch {
      Alert.alert('Export Error', 'Could not export receipts.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Google Drive Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GOOGLE DRIVE</Text>
        {connected ? (
          <>
            <View style={styles.connectedRow}>
              <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
              <View style={styles.connectedInfo}>
                <Text style={styles.connectedLabel}>Connected</Text>
                {userEmail && <Text style={styles.connectedEmail}>{userEmail}</Text>}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.syncButton, syncing && styles.buttonDisabled]}
              onPress={handleSyncNow}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sync-outline" size={18} color="#fff" />
              )}
              <Text style={styles.buttonText}>Sync Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={handleDisconnect}>
              <Ionicons name="unlink-outline" size={18} color="#F44336" />
              <Text style={[styles.buttonText, { color: '#F44336' }]}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.driveDescription}>
              Connect Google Drive to automatically back up your receipts to the cloud.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.connectButton, !request && styles.buttonDisabled]}
              onPress={() => promptAsync()}
              disabled={!request}
            >
              <Ionicons name="logo-google" size={18} color="#fff" />
              <Text style={styles.buttonText}>Connect Google Drive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.helpLink}
              onPress={() => Linking.openURL('https://console.cloud.google.com')}
            >
              <Ionicons name="information-circle-outline" size={14} color="#9E9E9E" />
              <Text style={styles.helpText}>
                Requires a Google Cloud project with Drive API enabled and{' '}
                EXPO_PUBLIC_GOOGLE_CLIENT_ID set in your .env file.
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXPORT</Text>
        <Text style={styles.driveDescription}>
          Export all receipts as a CSV file and save it to the iOS Files app.
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.exportButton, exporting && styles.buttonDisabled]}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={18} color="#fff" />
          )}
          <Text style={styles.buttonText}>Export as CSV</Text>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function generateCSV(receipts: Receipt[]): string {
  const header = 'Date,Merchant,Amount,Currency,Category,Notes,Drive File ID\n';
  const rows = receipts.map((r) => {
    const amount = (r.amount / 100).toFixed(2);
    const notes = `"${r.notes.replace(/"/g, '""')}"`;
    return `${r.date},${r.merchant},${amount},${r.currency},${r.category},${notes},${r.googleDriveFileId ?? ''}`;
  });
  return header + rows.join('\n');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#212121' },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1, marginBottom: 12 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  connectedInfo: { flex: 1 },
  connectedLabel: { fontSize: 15, fontWeight: '600', color: '#4CAF50' },
  connectedEmail: { fontSize: 13, color: '#757575', marginTop: 1 },
  driveDescription: { fontSize: 14, color: '#757575', lineHeight: 20, marginBottom: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  buttonDisabled: { opacity: 0.5 },
  connectButton: { backgroundColor: '#4285F4' },
  syncButton: { backgroundColor: '#2196F3' },
  disconnectButton: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFCDD2' },
  exportButton: { backgroundColor: '#FF9800' },
  helpLink: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 4 },
  helpText: { flex: 1, fontSize: 12, color: '#9E9E9E', lineHeight: 17 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  aboutLabel: { fontSize: 15, color: '#424242' },
  aboutValue: { fontSize: 15, color: '#9E9E9E' },
});

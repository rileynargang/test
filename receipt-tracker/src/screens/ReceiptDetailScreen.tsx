import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { RootStackParamList } from '../navigation/AppNavigator';
import { getReceiptById, deleteReceipt, updateReceipt } from '../services/database';
import { deleteReceiptImages, saveReceiptToFilesApp } from '../services/fileStorage';
import { uploadReceiptToDrive } from '../services/googleDrive';
import { getValidAccessToken } from '../services/auth';
import { Receipt, CATEGORIES, formatAmount } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptDetail'>;

export default function ReceiptDetailScreen({ route, navigation }: Props) {
  const { receiptId } = route.params;
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadReceipt();
  }, [receiptId]);

  async function loadReceipt() {
    const r = await getReceiptById(receiptId);
    setReceipt(r);
  }

  async function handleSaveToFiles() {
    if (!receipt) return;
    try {
      await saveReceiptToFilesApp(receipt);
      Alert.alert(
        'Saved to Files',
        'Find it in Files → On My iPhone → Receipt Tracker → Receipts'
      );
    } catch {
      Alert.alert('Error', 'Unable to save receipt to Files.');
    }
  }

  async function handleUploadToDrive() {
    if (!receipt) return;

    const token = await getValidAccessToken();
    if (!token) {
      Alert.alert(
        'Not Connected',
        'Connect your Google Drive account in Settings first.',
        [{ text: 'OK' }]
      );
      return;
    }

    setUploading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateReceipt(receipt.id, { syncStatus: 'pending' });
      await uploadReceiptToDrive(receipt);
      await loadReceipt();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Uploaded', 'Receipt saved to Google Drive.');
    } catch (err) {
      await updateReceipt(receipt.id, { syncStatus: 'failed' });
      Alert.alert('Upload Failed', 'Could not upload to Google Drive. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!receipt) return;
    Alert.alert('Delete Receipt', 'Are you sure you want to delete this receipt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(receipt.id);
          await deleteReceiptImages(receipt.id);
          navigation.goBack();
        },
      },
    ]);
  }

  if (!receipt) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const category = CATEGORIES.find((c) => c.id === receipt.category);

  const syncLabel = () => {
    switch (receipt.syncStatus) {
      case 'synced': return 'Saved to Google Drive';
      case 'pending': return 'Waiting to sync...';
      case 'failed': return 'Sync failed — tap to retry';
      default: return null;
    }
  };

  const syncColor = () => {
    switch (receipt.syncStatus) {
      case 'synced': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Image */}
      <Image source={{ uri: receipt.imageUri }} style={styles.image} resizeMode="contain" />

      {/* Main info card */}
      <View style={styles.card}>
        <Text style={styles.merchant}>{receipt.merchant || 'Unknown Merchant'}</Text>
        <Text style={styles.amount}>{formatAmount(receipt.amount, receipt.currency)}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: (category?.color ?? '#B0BEC5') + '22' }]}>
            <Ionicons
              name={category?.icon as keyof typeof Ionicons.glyphMap ?? 'ellipsis-horizontal'}
              size={14}
              color={category?.color ?? '#B0BEC5'}
            />
            <Text style={[styles.categoryText, { color: category?.color }]}>
              {category?.label ?? receipt.category}
            </Text>
          </View>
          <Text style={styles.date}>
            {format(new Date(receipt.date), 'MMMM d, yyyy')}
          </Text>
        </View>
        {receipt.notes ? <Text style={styles.notes}>{receipt.notes}</Text> : null}
      </View>

      {/* Sync status */}
      {receipt.syncStatus !== 'not_configured' && (
        <View style={[styles.syncBanner, { borderLeftColor: syncColor() }]}>
          <Text style={[styles.syncText, { color: syncColor() }]}>{syncLabel()}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleSaveToFiles}>
          <Ionicons name="folder-outline" size={22} color="#2196F3" />
          <Text style={styles.actionLabel}>Save to Files</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, uploading && styles.actionButtonDisabled]}
          onPress={handleUploadToDrive}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={22} color="#4CAF50" />
          )}
          <Text style={[styles.actionLabel, { color: '#4CAF50' }]}>
            {receipt.syncStatus === 'synced' ? 'Re-upload' : 'Upload to Drive'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#F44336" />
          <Text style={[styles.actionLabel, { color: '#F44336' }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Metadata */}
      <View style={styles.metadataCard}>
        <Text style={styles.metadataTitle}>Details</Text>
        <MetaRow label="Added" value={format(new Date(receipt.createdAt), 'MMM d, yyyy · h:mm a')} />
        <MetaRow label="Currency" value={receipt.currency} />
        {receipt.googleDriveFileId && (
          <MetaRow label="Drive ID" value={receipt.googleDriveFileId} mono />
        )}
      </View>
    </ScrollView>
  );
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={metaStyles.row}>
      <Text style={metaStyles.label}>{label}</Text>
      <Text style={[metaStyles.value, mono && metaStyles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  label: { fontSize: 14, color: '#757575' },
  value: { fontSize: 14, color: '#212121', flex: 1, textAlign: 'right' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
});

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  merchant: { fontSize: 24, fontWeight: '700', color: '#212121' },
  amount: { fontSize: 32, fontWeight: '800', color: '#1976D2', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  categoryText: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 14, color: '#757575' },
  notes: { marginTop: 12, fontSize: 14, color: '#616161', lineHeight: 20 },
  syncBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
  },
  syncText: { fontSize: 13, fontWeight: '500' },
  actions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#2196F3' },
  metadataCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 16,
  },
  metadataTitle: { fontSize: 16, fontWeight: '700', color: '#424242', marginBottom: 8 },
});

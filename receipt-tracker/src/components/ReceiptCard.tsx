import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Receipt, CATEGORIES, formatAmount } from '../types';

interface Props {
  receipt: Receipt;
  onPress: () => void;
}

export default function ReceiptCard({ receipt, onPress }: Props) {
  const category = CATEGORIES.find((c) => c.id === receipt.category);

  const syncIcon = () => {
    switch (receipt.syncStatus) {
      case 'synced':
        return <Ionicons name="cloud-done-outline" size={14} color="#4CAF50" />;
      case 'pending':
        return <Ionicons name="cloud-upload-outline" size={14} color="#FF9800" />;
      case 'failed':
        return <Ionicons name="cloud-offline-outline" size={14} color="#F44336" />;
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: receipt.thumbnailUri || receipt.imageUri }} style={styles.thumbnail} />
      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.merchant} numberOfLines={1}>
            {receipt.merchant || 'Unknown Merchant'}
          </Text>
          <Text style={styles.amount}>{formatAmount(receipt.amount, receipt.currency)}</Text>
        </View>
        <View style={styles.row}>
          <View style={[styles.categoryBadge, { backgroundColor: category?.color + '33' }]}>
            <Text style={[styles.categoryText, { color: category?.color }]}>
              {category?.label ?? receipt.category}
            </Text>
          </View>
          <View style={styles.meta}>
            {syncIcon()}
            <Text style={styles.date}>{receipt.date}</Text>
          </View>
        </View>
        {receipt.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            {receipt.notes}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976D2',
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  date: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  notes: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
});

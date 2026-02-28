import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import { RootStackParamList } from '../navigation/AppNavigator';
import { addReceipt } from '../services/database';
import { saveReceiptImage } from '../services/fileStorage';
import { Category, CATEGORIES } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddReceipt'>;

export default function AddReceiptScreen({ route, navigation }: Props) {
  const { imageUri } = route.params;

  const [merchant, setMerchant] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency] = useState('USD');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState<Category>('other');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!merchant.trim()) {
      Alert.alert('Missing Info', 'Please enter a merchant name.');
      return;
    }

    const parsedAmount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      const receiptId = uuidv4();
      const { imageUri: savedImageUri, thumbnailUri } = await saveReceiptImage(imageUri, receiptId);
      const now = new Date().toISOString();

      await addReceipt({
        id: receiptId,
        imageUri: savedImageUri,
        thumbnailUri,
        merchant: merchant.trim(),
        amount: Math.round(parsedAmount * 100), // store as cents
        currency,
        date: format(date, 'yyyy-MM-dd'),
        category,
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
        syncStatus: 'not_configured',
      });

      navigation.navigate('MainTabs');
    } catch (err) {
      Alert.alert('Error', 'Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Receipt image preview */}
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

      <View style={styles.form}>
        {/* Merchant */}
        <View style={styles.field}>
          <Text style={styles.label}>Merchant *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Starbucks, Amazon..."
            placeholderTextColor="#BDBDBD"
            value={merchant}
            onChangeText={setMerchant}
            autoFocus
          />
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="0.00"
              placeholderTextColor="#BDBDBD"
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color="#9E9E9E" />
            <Text style={styles.dateText}>{format(date, 'MMMM d, yyyy')}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  category === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={category === cat.id ? '#fff' : cat.color}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat.id && { color: '#fff' },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Add any notes about this receipt..."
            placeholderTextColor="#BDBDBD"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Receipt</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  image: { width: '100%', height: 220, backgroundColor: '#E0E0E0' },
  form: { padding: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#757575', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  amountContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 20, fontWeight: '500', color: '#9E9E9E', marginRight: 4 },
  amountInput: { flex: 1 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  dateText: { fontSize: 16, color: '#212121' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: '#424242' },
  notesInput: { minHeight: 80, paddingTop: 12 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

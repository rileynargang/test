import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { getReceipts } from '../services/database';
import { Receipt, ReceiptFilters, CATEGORIES, Category, formatAmount } from '../types';
import ReceiptCard from '../components/ReceiptCard';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const load = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    const filters: ReceiptFilters = {};
    if (selectedCategory) filters.category = selectedCategory;
    if (search.trim()) filters.searchQuery = search.trim();

    const data = await getReceipts(filters);
    setReceipts(data);

    if (isRefreshing) setRefreshing(false);
    else setLoading(false);
  }, [selectedCategory, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);

  const allCategories = [null, ...CATEGORIES.map((c) => c.id as Category)];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Receipts</Text>
        {receipts.length > 0 && (
          <Text style={styles.headerSubtitle}>
            {receipts.length} receipts · {formatAmount(totalAmount)}
          </Text>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9E9E9E" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchants..."
          placeholderTextColor="#BDBDBD"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load()}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#BDBDBD" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {allCategories.map((cat) => {
          const categoryData = cat ? CATEGORIES.find((c) => c.id === cat) : null;
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat ?? 'all'}
              style={[
                styles.chip,
                isSelected && { backgroundColor: categoryData?.color ?? '#2196F3' },
              ]}
              onPress={() => {
                setSelectedCategory(cat);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && { color: '#fff' },
                ]}
              >
                {cat ? categoryData?.label : 'All'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Receipt list */}
      <FlatList
        data={receipts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReceiptCard
            receipt={item}
            onPress={() => navigation.navigate('ReceiptDetail', { receiptId: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        contentContainerStyle={receipts.length === 0 && styles.emptyList}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color="#BDBDBD" />
            <Text style={styles.emptyTitle}>No receipts yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap Capture to photograph your first receipt
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#212121' },
  headerSubtitle: { fontSize: 14, color: '#757575', marginTop: 2 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#212121' },
  filterScroll: { maxHeight: 48 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
  },
  chipText: { fontSize: 13, fontWeight: '500', color: '#616161' },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#424242', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9E9E9E', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface RankedProduct {
  id: string;
  title: string;
  store: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  url: string;
  image: string;
  valueScore: number;
  savingsScore: number;
  qualityScore: number;
  overallScore: number;
  reasoning: string;
}

interface SearchResult {
  success: boolean;
  query: string;
  totalFound: number;
  matchCount: number;
  results: RankedProduct[];
}

export default function ShoppingIntelligenceScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState<SearchResult | null>(null);
  const { theme } = useTheme();

  const bgColor = theme === 'dark' ? '#1a1a1a' : '#fff';
  const textColor = theme === 'dark' ? '#fff' : '#000';
  const cardBg = theme === 'dark' ? '#2a2a2a' : '#f9f9f9';

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        'https://us-central1-flashradar-71c93.cloudfunctions.net/shopWithIntelligence',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        }
      );
      const data: SearchResult = await response.json();
      setSearchInfo(data);
      setResults(data.success ? data.results : null);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProductCard = (product: RankedProduct, index: number) => (
    <View key={product.id} style={[styles.productCard, { backgroundColor: cardBg }]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>

      <View style={styles.productHeader}>
        <Text style={[styles.productTitle, { color: textColor }]} numberOfLines={2}>
          {product.title}
        </Text>
        <Text style={styles.store}>{product.store}</Text>
      </View>

      <View style={styles.priceSection}>
        <Text style={styles.price}>${product.price}</Text>
        <View style={styles.discount}>
          <Text style={styles.discountText}>{product.discountPercent}% OFF</Text>
        </View>
      </View>

      <View style={styles.scoresGrid}>
        <ScoreBox label="Overall" score={product.overallScore} color="#FF7A00" />
        <ScoreBox label="Value" score={product.valueScore} color="#4CAF50" />
        <ScoreBox label="Savings" score={product.savingsScore} color="#2196F3" />
        <ScoreBox label="Quality" score={product.qualityScore} color="#9C27B0" />
      </View>

      <Text style={[styles.reasoning, { color: textColor }]}>
        {product.reasoning}
      </Text>

      <TouchableOpacity 
        style={styles.viewButton}
        onPress={() => {
          // Open URL
        }}
      >
        <Text style={styles.viewButtonText}>View Deal</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={32} color="#FF7A00" />
          <Text style={[styles.title, { color: textColor }]}>Shopping Intelligence</Text>
          <Text style={[styles.subtitle, { color: '#888' }]}>Find the best deals with AI</Text>
        </View>

        <View style={[styles.searchContainer, { borderColor: '#ddd' }]}>
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search shoes, speakers, laptops..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {searchInfo && !results && (
          <View style={[styles.errorBox, { backgroundColor: '#FFE5CC' }]}>
            <Text style={styles.errorText}>
              No products found for "{searchInfo.query}"
            </Text>
          </View>
        )}

        {results && searchInfo && (
          <View>
            <View style={styles.resultsSummary}>
              <Text style={[styles.summaryText, { color: textColor }]}>
                Found {searchInfo.matchCount} results
              </Text>
            </View>

            {results.map((product, index) => renderProductCard(product, index))}
          </View>
        )}

        {!results && !loading && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: '#888' }]}>
              Search for anything: shoes, speakers, furniture, tech...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScoreBox({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <View style={styles.scoreBox}>
      <View style={[styles.scoreCircle, { borderColor: color }]}>
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
      </View>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 12 },
  title: { fontSize: 24, fontWeight: '900', marginTop: 12 },
  subtitle: { fontSize: 14, marginTop: 4 },
  searchContainer: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, marginBottom: 20 },
  searchInput: { flex: 1, padding: 12, fontSize: 16 },
  searchButton: { padding: 12, backgroundColor: '#FF7A00', justifyContent: 'center', alignItems: 'center', borderRadius: 8, margin: 4 },
  resultsSummary: { marginBottom: 16 },
  summaryText: { fontSize: 14, fontWeight: '600' },
  productCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  rankBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#FF7A00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rankText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  productHeader: { marginBottom: 12 },
  productTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  store: { fontSize: 12, color: '#999', fontWeight: '600' },
  priceSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  price: { fontSize: 28, fontWeight: '900', color: '#FF7A00' },
  discount: { backgroundColor: '#FF7A00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  discountText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  scoresGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  scoreBox: { alignItems: 'center' },
  scoreCircle: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  scoreNumber: { fontWeight: '700', fontSize: 16 },
  scoreLabel: { fontSize: 11, fontWeight: '600', color: '#666' },
  reasoning: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  viewButton: { backgroundColor: '#FF7A00', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  viewButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorBox: { padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#000', fontSize: 14, fontWeight: '600' },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

import React, { useState } from 'react';
import { Linking } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface SearchResult {
  success: boolean;
  query: string;
  bestDeal?: {
    title: string;
    store: string;
    price: number;
    originalPrice: number;
    discountPercent: number;
    url: string;
  };
  explanation?: string;
  alternatives?: any[];
  waitRecommendation?: string;
  totalDealsFound?: number;
  message?: string;
}

export default function AIAssistantScreen() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const { language } = useLanguage();

  const bgColor = theme === 'dark' ? '#1a1a1a' : '#fff';
  const textColor = theme === 'dark' ? '#fff' : '#000';
  const borderColor = theme === 'dark' ? '#333' : '#ddd';

  const handleViewDeal = () => {
    console.log('Best deal URL:', result?.bestDeal?.url);
    if (result?.bestDeal?.url) {
      Linking.openURL(result.bestDeal.url).catch(err => console.error('Error opening URL:', err));
    } else {
      alert('No URL available for this deal');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        'https://us-central1-flashradar-71c93.cloudfunctions.net/searchWithAI',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        }
      );
      const data = await response.json();
      setResult(data as SearchResult);
    } catch (error) {
      console.error('AI search error:', error);
      setResult({
        success: false,
        query,
        message: 'Failed to search. Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="sparkles" size={32} color="#FF7A00" />
            <Text style={[styles.title, { color: textColor }]}>AI Shopping Assistant</Text>
            <Text style={[styles.subtitle, { color: '#888' }]}>
              Ask anything about deals
            </Text>
          </View>

          {/* Search Input */}
          <View style={[styles.inputContainer, { borderColor, backgroundColor: bgColor }]}>
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="Find me a gaming monitor under $300..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              multiline
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Results */}
          {result && (
            <View style={[styles.resultContainer, { borderColor }]}>
              {result.success && result.bestDeal ? (
                <>
                  {/* Best Deal */}
                  <View style={[styles.dealCard, { backgroundColor: '#FF7A00' }]}>
                    <Text style={styles.dealTitle}>{result.bestDeal.title}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>${result.bestDeal.price}</Text>
                      <Text style={styles.discount}>
                        {result.bestDeal.discountPercent}% OFF
                      </Text>
                    </View>
                    <Text style={styles.store}>{result.bestDeal.store}</Text>
                  </View>

                  {/* Explanation */}
                  {result.explanation && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: textColor }]}>Why This Deal?</Text>
                      <Text style={[styles.sectionText, { color: textColor }]}>
                        {result.explanation}
                      </Text>
                    </View>
                  )}

                  {/* Wait Recommendation */}
                  {result.waitRecommendation && (
                    <View style={[styles.section, styles.warningSection]}>
                      <Ionicons name="alert-circle" size={20} color="#FF7A00" />
                      <Text style={[styles.sectionText, { color: textColor, marginLeft: 8 }]}>
                        {result.waitRecommendation}
                      </Text>
                    </View>
                  )}

                  {/* Alternatives */}
                  {result.alternatives && result.alternatives.length > 0 && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: textColor }]}>Alternatives</Text>
                      {result.alternatives.map((alt, i) => (
                        <Text key={i} style={[styles.altText, { color: textColor }]}>
                          • {alt.store}: ${alt.price}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={[styles.section, { backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8 }]}>
                    <Text style={[styles.sectionText, { color: '#E65100', fontSize: 12 }]}>
                      ⚠️ Price may vary from listed amount. Check merchant for current pricing.
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.viewDealButton} onPress={handleViewDeal}>
                    <Text style={styles.viewDealText}>View Deal</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[styles.errorText, { color: textColor }]}>
                  {result.message || 'No results found'}
                </Text>
              )}
            </View>
          )}

          {/* Examples */}
          {!result && !loading && (
            <View style={styles.examplesContainer}>
              <Text style={[styles.examplesTitle, { color: textColor }]}>Try asking:</Text>
              <Text style={[styles.example, { color: '#888' }]}>
                "Best gaming laptop under $1000"
              </Text>
              <Text style={[styles.example, { color: '#888' }]}>
                "Where to buy AirPods cheapest today?"
              </Text>
              <Text style={[styles.example, { color: '#888' }]}>
                "Find ninja creami best price"
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  title: { fontSize: 24, fontWeight: '900', marginTop: 12 },
  subtitle: { fontSize: 14, marginTop: 4 },
  inputContainer: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', marginBottom: 20 },
  input: { flex: 1, padding: 12, fontSize: 16 },
  searchButton: { padding: 12, backgroundColor: '#FF7A00', justifyContent: 'center', alignItems: 'center', borderRadius: 8, margin: 4 },
  resultContainer: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 },
  dealCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  dealTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  price: { fontSize: 24, fontWeight: '900', color: '#fff' },
  discount: { fontSize: 14, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, borderRadius: 6 },
  store: { fontSize: 12, color: '#fff', fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  sectionText: { fontSize: 14, lineHeight: 20 },
  warningSection: { flexDirection: 'row', alignItems: 'flex-start' },
  altText: { fontSize: 13, marginBottom: 4 },
  viewDealButton: { backgroundColor: '#FF7A00', padding: 12, borderRadius: 8, alignItems: 'center' },
  viewDealText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', padding: 20 },
  examplesContainer: { marginTop: 20 },
  examplesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  example: { fontSize: 13, marginBottom: 8, paddingLeft: 12 },
});

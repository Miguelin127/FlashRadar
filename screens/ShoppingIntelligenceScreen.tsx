import React, { useState } from 'react';
import { Share } from 'react-native';
import { Linking } from 'react-native';
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
import { firebase } from '../firebaseConfig';

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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ShoppingIntelligenceScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInfo, setSearchInfo] = useState<SearchResult | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const { theme } = useTheme();

  const bgColor = theme === 'dark' ? '#1a1a1a' : '#fff';
  const textColor = theme === 'dark' ? '#fff' : '#000';
  const cardBg = theme === 'dark' ? '#2a2a2a' : '#f9f9f9';

  const handleShareDeal = (product: RankedProduct) => {
    const message = `Check out this deal on FlashRadar!

${product.title}
${product.price} (${product.discountPercent}% OFF)
${product.store}

Score: ${product.overallScore}/100

${product.url}

Find more deals: https://flashradarapp.com`;
    Share.share({
      message,
      url: product.url,
      title: 'Share Deal',
    }).catch(err => console.error('Share error:', err));
  };

  const handleViewDeal = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error:', err));
  };

  const handleImageError = (productId: string) => {
    setFailedImages(prev => new Set([...prev, productId]));
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setChatMessages([]);
    try {
      const uid = firebase.auth().currentUser?.uid;
      if (!uid) {
        console.error('Not authenticated');
        return;
      }

      const response = await fetch(
        'https://us-central1-flashradar-71c93.cloudfunctions.net/shopWithIntelligence',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, uid }),
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

  const handleChatSend = async () => {
    if (!chatInput.trim() || !results || results.length === 0) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const uid = firebase.auth().currentUser?.uid;
      if (!uid) return;

      const productsContext = results.map(p => 
        `${p.title} ($${p.price}, ${p.discountPercent}% off) from ${p.store}`
      ).join('\n');

      const response = await fetch(
        'https://us-central1-flashradar-71c93.cloudfunctions.net/shopWithIntelligence',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Previous search: "${query}". These products were found:\n${productsContext}\n\nFollow-up question: ${chatInput}`,
            uid,
            isFollowUp: true,
          }),
        }
      );

      const data = await response.json();
      if (data.success && data.results && data.results[0]) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.results[0].reasoning,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const renderProductCard = (product: RankedProduct, index: number) => (
    <View key={product.id} style={[styles.productCard, { backgroundColor: cardBg }]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>

      {failedImages.has(product.id) ? (
        <View style={[styles.productImage, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="image-outline" size={40} color="#ccc" />
        </View>
      ) : (
        <Image 
          source={{ uri: product.image }}
          style={styles.productImage}
          resizeMode="contain"
          onError={() => handleImageError(product.id)}
        />
      )}

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

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.viewButton, { flex: 1, marginRight: 8 }]}
          onPress={() => handleViewDeal(product.url)}
        >
          <Text style={styles.viewButtonText}>View Deal</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.shareButton]}
          onPress={() => handleShareDeal(product)}
        >
          <Ionicons name="share-social" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderChatBubble = (msg: ChatMessage) => (
    <View key={msg.id} style={[
      styles.chatBubble,
      msg.role === 'user' ? styles.userBubble : styles.assistantBubble
    ]}>
      <Text style={[
        styles.chatText,
        msg.role === 'user' ? { color: '#fff' } : { color: textColor }
      ]}>
        {msg.content}
      </Text>
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

            <View style={[styles.chatContainer, { backgroundColor: cardBg }]}>
              <Text style={[styles.chatTitle, { color: textColor }]}>Ask AI</Text>
              
              {chatMessages.length > 0 && (
                <View style={styles.messagesBox}>
                  {chatMessages.map(msg => renderChatBubble(msg))}
                </View>
              )}

              <View style={[styles.chatInputContainer, { borderColor: '#ddd' }]}>
                <TextInput
                  style={[styles.chatInput, { color: textColor }]}
                  placeholder="Ask about these deals..."
                  placeholderTextColor="#999"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                />
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  {chatLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
  productImage: { width: '100%', height: 240, borderRadius: 8, marginBottom: 12, backgroundColor: '#f0f0f0' },
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
  productCard: { borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  rankBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#FF7A00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rankText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  productHeader: { marginBottom: 8 },
  productTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  store: { fontSize: 12, color: '#999', fontWeight: '600' },
  priceSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  price: { fontSize: 28, fontWeight: '900', color: '#FF7A00' },
  discount: { backgroundColor: '#FF7A00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  discountText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  scoresGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  scoreBox: { alignItems: 'center' },
  scoreCircle: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  scoreNumber: { fontWeight: '700', fontSize: 16 },
  scoreLabel: { fontSize: 11, fontWeight: '600', color: '#666' },
  reasoning: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  viewButton: { backgroundColor: '#FF7A00', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  viewButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
  shareButton: { backgroundColor: '#FF7A00', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  errorBox: { padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#000', fontSize: 14, fontWeight: '600' },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  chatContainer: { borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#eee' },
  chatTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  messagesBox: { maxHeight: 200, marginBottom: 12 },
  chatBubble: { marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  userBubble: { backgroundColor: '#FF7A00', alignSelf: 'flex-end', maxWidth: '80%' },
  assistantBubble: { backgroundColor: '#e0e0e0', alignSelf: 'flex-start', maxWidth: '80%' },
  chatText: { fontSize: 13, lineHeight: 18 },
  chatInputContainer: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, alignItems: 'flex-end' },
  chatInput: { flex: 1, padding: 10, fontSize: 14, maxHeight: 80 },
  chatButton: { padding: 10, backgroundColor: '#FF7A00', borderRadius: 6, margin: 4 },
});

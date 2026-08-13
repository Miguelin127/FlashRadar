import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Linking, Share, StyleSheet, Dimensions, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function DealDetailScreen() {
  const { darkMode } = useTheme();
  const { language } = useLanguage();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const deal = route.params?.deal;
  const [favorite, setFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!deal) {
    return (
      <View style={[styles.empty, { backgroundColor: darkMode ? '#000' : '#fff' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={darkMode ? '#777' : '#999'} />
        <Text style={[styles.emptyTitle, { color: darkMode ? '#fff' : '#111' }]}>Deal not found</Text>
        <TouchableOpacity style={styles.backButtonLarge} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bgColor = darkMode ? '#050505' : '#F7F7F8';
  const cardBg = darkMode ? '#111111' : '#FFFFFF';
  const textColor = darkMode ? '#FFFFFF' : '#111111';
  const secondaryText = darkMode ? '#A5A5A5' : '#666666';
  const borderColor = darkMode ? '#242424' : '#E7E7E7';

  const price = deal.price ?? deal.salePrice ?? null;
  const originalPrice = deal.originalPrice ?? deal.regularPrice ?? null;
  const discountPercent = deal.discountPercent ?? (originalPrice && price && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null);
  const savings = originalPrice && price && originalPrice > price ? originalPrice - price : null;
  const storeName = deal.storeName || deal.store || deal.merchant || 'Retailer';
  const dealUrl = deal.affiliateUrl || deal.merchantUrl || deal.url || deal.dealUrl;
  const imageUrl = deal.imageUrl || deal.image || deal.productImage || null;
  const isHot = deal.hot === true || (discountPercent !== null && discountPercent >= 40);
  const isRare = deal.rare === true;
  const isSteal = deal.steal === true || (discountPercent !== null && discountPercent >= 60);
  const storeInitial = typeof storeName === 'string' ? storeName.charAt(0).toUpperCase() : 'F';

  const openDeal = async () => {
    if (!dealUrl) {
      Alert.alert('Deal unavailable', 'This deal does not currently have a valid purchase link.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(dealUrl);
      if (!supported) {
        Alert.alert('Unable to open deal', 'The deal link is currently unavailable.');
        return;
      }
      await Linking.openURL(dealUrl);
    } catch {
      Alert.alert('Unable to open deal', 'Something went wrong opening this deal.');
    }
  };

  const shareDeal = async () => {
    try {
      const encodedId = encodeURIComponent(deal.id);
      const deepLink = `https://flashradarapp.com/deal/${encodedId}`;
      await Share.share({
        title: deal.title,
        message: `${deal.title}\n${storeName}\n${price !== null ? `$${price.toFixed(2)}` : 'See deal'}${discountPercent !== null ? ` • ${discountPercent}% OFF` : ''}\n\n${deepLink}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {imageUrl && !imageError ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" onError={() => setImageError(true)} />
          ) : (
            <View style={[styles.imageFallback, { backgroundColor: darkMode ? '#151515' : '#EDEDED' }]}>
              <Ionicons name="image-outline" size={64} color={darkMode ? '#444' : '#AAA'} />
            </View>
          )}

          <View style={styles.heroControls}>
            <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#111" />
            </TouchableOpacity>
            <View style={styles.heroRightControls}>
              <TouchableOpacity style={styles.circleButton} onPress={shareDeal}>
                <Ionicons name="share-outline" size={21} color="#111" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.circleButton, favorite && styles.favoriteActive]} onPress={() => setFavorite(!favorite)}>
                <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={21} color={favorite ? '#FF3B30' : '#111'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.badgeContainer}>
            {isSteal && <View style={styles.badge}><Ionicons name="flash" size={13} color="#fff" /><Text style={styles.badgeText}>STEAL</Text></View>}
            {!isSteal && isHot && <View style={styles.badge}><Ionicons name="flame" size={13} color="#fff" /><Text style={styles.badgeText}>HOT DEAL</Text></View>}
            {isRare && <View style={[styles.badge, styles.rareBadge]}><Ionicons name="diamond" size={12} color="#fff" /><Text style={styles.badgeText}>RARE</Text></View>}
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.storeRow, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.storeIcon}><Text style={styles.storeInitial}>{storeInitial}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.storeLabel, { color: secondaryText }]}>AVAILABLE AT</Text>
              <Text style={[styles.storeName, { color: textColor }]}>{storeName}</Text>
            </View>
            <View style={styles.verified}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          <Text style={[styles.title, { color: textColor }]}>{deal.title}</Text>

          <View style={styles.priceSection}>
            <View>
              <Text style={styles.price}>{price !== null ? `$${price.toFixed(2)}` : 'See deal'}</Text>
              {originalPrice !== null && <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>}
            </View>
            {discountPercent !== null && <View style={styles.discountBox}><Text style={styles.discountNumber}>{discountPercent}%</Text><Text style={styles.discountLabel}>OFF</Text></View>}
          </View>

          {savings !== null && (
            <View style={[styles.savingsCard, { backgroundColor: darkMode ? '#092116' : '#EAF9F0' }]}>
              <View style={styles.savingsIcon}><Ionicons name="trending-down" size={20} color="#22C55E" /></View>
              <View><Text style={[styles.savingsLabel, { color: secondaryText }]}>YOU SAVE</Text><Text style={styles.savingsValue}>${savings.toFixed(2)}</Text></View>
            </View>
          )}

          <TouchableOpacity style={styles.mainButton} onPress={openDeal} activeOpacity={0.85}>
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.mainButtonText}>View Deal at {storeName}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  scrollContent: { paddingBottom: 30 },
  hero: { width: '100%', height: width * 0.75, position: 'relative', backgroundColor: '#111', marginBottom: 10 },
  heroImage: { width: '100%', height: '100%' },
  imageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heroControls: { position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroRightControls: { flexDirection: 'row', gap: 10 },
  circleButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  favoriteActive: { backgroundColor: '#FFF1F0' },
  badgeContainer: { position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF7A00', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  rareBadge: { backgroundColor: '#8B5CF6' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  content: { paddingHorizontal: 16 },
  storeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 18 },
  storeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FF7A00', justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  storeInitial: { color: '#fff', fontSize: 19, fontWeight: '900' },
  storeLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  storeName: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: '#22C55E', fontSize: 11, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900', marginBottom: 16 },
  priceSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  price: { color: '#FF7A00', fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  originalPrice: { color: '#999', fontSize: 13, textDecorationLine: 'line-through', marginTop: 2 },
  discountBox: { backgroundColor: '#FF7A00', minWidth: 70, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
  discountNumber: { color: '#fff', fontSize: 20, fontWeight: '900' },
  discountLabel: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  savingsCard: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  savingsIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  savingsLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  savingsValue: { color: '#22C55E', fontSize: 18, fontWeight: '900', marginTop: 1 },
  mainButton: { height: 54, borderRadius: 14, backgroundColor: '#FF7A00', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 20 },
  backButtonLarge: { backgroundColor: '#FF7A00', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 10 },
  backButtonText: { color: '#fff', fontWeight: '800' },
});

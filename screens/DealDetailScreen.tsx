import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Share,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function DealDetailScreen() {
  const { darkMode } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const deal = route.params?.deal;

  const [favorite, setFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!deal) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: darkMode ? '#000' : '#fff' },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={darkMode ? '#777' : '#999'}
        />

        <Text
          style={[
            styles.emptyTitle,
            { color: darkMode ? '#fff' : '#111' },
          ]}
        >
          Deal not found
        </Text>

        <TouchableOpacity
          style={styles.backButtonLarge}
          onPress={() => navigation.goBack()}
        >
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

  const price =
    typeof deal.price === 'number'
      ? deal.price
      : typeof deal.salePrice === 'number'
      ? deal.salePrice
      : null;

  const originalPrice =
    typeof deal.originalPrice === 'number'
      ? deal.originalPrice
      : typeof deal.regularPrice === 'number'
      ? deal.regularPrice
      : null;

  const discountPercent =
    typeof deal.discountPercent === 'number'
      ? deal.discountPercent
      : originalPrice && price && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  const savings =
    originalPrice && price && originalPrice > price
      ? originalPrice - price
      : null;

  const storeName =
    deal.storeName ||
    deal.store ||
    deal.merchant ||
    deal.retailer ||
    'Retailer';

  const dealUrl =
    deal.affiliateUrl ||
    deal.merchantUrl ||
    deal.url ||
    deal.dealUrl;

  const imageUrl =
    deal.imageUrl ||
    deal.image ||
    deal.productImage ||
    null;

  const isHot =
    deal.isHot === true ||
    deal.hot === true ||
    (discountPercent !== null && discountPercent >= 40);

  const isRare =
    deal.isRare === true ||
    deal.rare === true;

  const isSteal =
    deal.isSteal === true ||
    deal.steal === true ||
    (discountPercent !== null && discountPercent >= 60);

  const flipData = deal.flip || deal.flipData || null;

  const estimatedResale =
    flipData?.estimatedResalePrice ??
    deal.estimatedResalePrice ??
    deal.avgResalePrice ??
    null;

  const estimatedProfit =
    flipData?.estimatedProfit ??
    deal.estimatedProfit ??
    deal.netProfit ??
    null;

  const flipVerdict =
    flipData?.verdict ||
    deal.flipVerdict ||
    null;

  const flipConfidence =
    flipData?.confidence ||
    deal.flipConfidence ||
    null;

  const priceHistory = deal.priceHistory || null;

  const expiration =
    deal.expirationDate ||
    deal.expiresAt ||
    deal.endDate ||
    null;

  const formattedExpiration = useMemo(() => {
    if (!expiration) return null;

    try {
      const date = new Date(expiration);

      if (Number.isNaN(date.getTime())) return null;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [expiration]);

  const openDeal = async () => {
    if (!dealUrl) {
      Alert.alert(
        'Deal unavailable',
        'This deal does not currently have a valid purchase link.'
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(dealUrl);

      if (!supported) {
        Alert.alert(
          'Unable to open deal',
          'The deal link is currently unavailable.'
        );
        return;
      }

      await Linking.openURL(dealUrl);
    } catch {
      Alert.alert(
        'Unable to open deal',
        'Something went wrong opening this deal.'
      );
    }
  };

  const shareDeal = async () => {
    try {
      await Share.share({
        title: deal.title,
        message: `${deal.title}\n${storeName}\n${
          price !== null ? `$${price.toFixed(2)}` : 'See deal'
        }${
          discountPercent !== null
            ? ` • ${discountPercent}% OFF`
            : ''
        }\n\nFound on FlashRadar`,
      });
    } catch {
      // User cancelled or sharing is unavailable.
    }
  };

  const storeInitial =
    typeof storeName === 'string'
      ? storeName.charAt(0).toUpperCase()
      : 'F';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO */}
        <View style={styles.hero}>
          {imageUrl && !imageError ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View
              style={[
                styles.imageFallback,
                { backgroundColor: darkMode ? '#151515' : '#EDEDED' },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={64}
                color={darkMode ? '#444' : '#AAA'}
              />
            </View>
          )}

          {/* HERO TOP CONTROLS */}
          <View style={styles.heroControls}>
            <TouchableOpacity
              style={styles.circleButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={22} color="#111" />
            </TouchableOpacity>

            <View style={styles.heroRightControls}>
              <TouchableOpacity
                style={styles.circleButton}
                onPress={shareDeal}
              >
                <Ionicons
                  name="share-outline"
                  size={21}
                  color="#111"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.circleButton,
                  favorite && styles.favoriteActive,
                ]}
                onPress={() => setFavorite(!favorite)}
              >
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={21}
                  color={favorite ? '#FF3B30' : '#111'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* BADGES */}
          <View style={styles.badgeContainer}>
            {isSteal && (
              <View style={styles.badge}>
                <Ionicons name="flash" size={13} color="#fff" />
                <Text style={styles.badgeText}>STEAL</Text>
              </View>
            )}

            {!isSteal && isHot && (
              <View style={styles.badge}>
                <Ionicons name="flame" size={13} color="#fff" />
                <Text style={styles.badgeText}>HOT DEAL</Text>
              </View>
            )}

            {isRare && (
              <View style={[styles.badge, styles.rareBadge]}>
                <Ionicons name="diamond" size={12} color="#fff" />
                <Text style={styles.badgeText}>RARE</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* STORE */}
          <View
            style={[
              styles.storeRow,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <View style={styles.storeIcon}>
              <Text style={styles.storeInitial}>{storeInitial}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.storeLabel,
                  { color: secondaryText },
                ]}
              >
                AVAILABLE AT
              </Text>

              <Text
                style={[
                  styles.storeName,
                  { color: textColor },
                ]}
              >
                {storeName}
              </Text>
            </View>

            <View style={styles.verified}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#22C55E"
              />

              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          {/* TITLE */}
          <Text style={[styles.title, { color: textColor }]}>
            {deal.title}
          </Text>

          {/* PRICE */}
          <View style={styles.priceSection}>
            <View>
              {price !== null ? (
                <Text style={styles.price}>
                  ${price.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.price}>See deal</Text>
              )}

              {originalPrice !== null && (
                <Text style={styles.originalPrice}>
                  ${originalPrice.toFixed(2)}
                </Text>
              )}
            </View>

            {discountPercent !== null && (
              <View style={styles.discountBox}>
                <Text style={styles.discountNumber}>
                  {discountPercent}%
                </Text>
                <Text style={styles.discountLabel}>OFF</Text>
              </View>
            )}
          </View>

          {/* SAVINGS */}
          {savings !== null && (
            <View
              style={[
                styles.savingsCard,
                {
                  backgroundColor: darkMode
                    ? '#092116'
                    : '#EAF9F0',
                },
              ]}
            >
              <View style={styles.savingsIcon}>
                <Ionicons
                  name="trending-down"
                  size={20}
                  color="#22C55E"
                />
              </View>

              <View>
                <Text
                  style={[
                    styles.savingsLabel,
                    { color: secondaryText },
                  ]}
                >
                  YOU SAVE
                </Text>

                <Text style={styles.savingsValue}>
                  ${savings.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* DEAL INTELLIGENCE */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="analytics-outline"
                  size={20}
                  color="#FF7A00"
                />

                <Text
                  style={[
                    styles.sectionTitle,
                    { color: textColor },
                  ]}
                >
                  Deal Intelligence
                </Text>
              </View>
            </View>

            <View style={styles.intelligenceGrid}>
              <View style={styles.intelligenceItem}>
                <Text
                  style={[
                    styles.intelligenceLabel,
                    { color: secondaryText },
                  ]}
                >
                  DISCOUNT
                </Text>

                <Text
                  style={[
                    styles.intelligenceValue,
                    { color: textColor },
                  ]}
                >
                  {discountPercent !== null
                    ? `${discountPercent}%`
                    : '—'}
                </Text>
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.intelligenceItem}>
                <Text
                  style={[
                    styles.intelligenceLabel,
                    { color: secondaryText },
                  ]}
                >
                  SAVINGS
                </Text>

                <Text
                  style={[
                    styles.intelligenceValue,
                    { color: textColor },
                  ]}
                >
                  {savings !== null
                    ? `$${savings.toFixed(0)}`
                    : '—'}
                </Text>
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.intelligenceItem}>
                <Text
                  style={[
                    styles.intelligenceLabel,
                    { color: secondaryText },
                  ]}
                >
                  STATUS
                </Text>

                <Text style={styles.hotStatus}>
                  {isSteal
                    ? 'STEAL'
                    : isHot
                    ? 'HOT'
                    : 'GOOD'}
                </Text>
              </View>
            </View>
          </View>

          {/* FLIP IT */}
          {(estimatedResale !== null ||
            estimatedProfit !== null ||
            flipVerdict) && (
            <View
              style={[
                styles.flipCard,
                {
                  backgroundColor: darkMode
                    ? '#111827'
                    : '#F0F7FF',
                  borderColor: darkMode
                    ? '#24334D'
                    : '#D7E8FF',
                },
              ]}
            >
              <View style={styles.flipHeader}>
                <View style={styles.flipTitleRow}>
                  <View style={styles.flipIcon}>
                    <Ionicons
                      name="repeat"
                      size={20}
                      color="#3B82F6"
                    />
                  </View>

                  <View>
                    <Text
                      style={[
                        styles.flipTitle,
                        { color: textColor },
                      ]}
                    >
                      Flip It
                    </Text>

                    <Text
                      style={[
                        styles.flipSubtitle,
                        { color: secondaryText },
                      ]}
                    >
                      Resale opportunity
                    </Text>
                  </View>
                </View>

                {flipVerdict && (
                  <View style={styles.verdictBadge}>
                    <Text style={styles.verdictText}>
                      {String(flipVerdict).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.flipStats}>
                <View style={styles.flipStat}>
                  <Text
                    style={[
                      styles.flipStatLabel,
                      { color: secondaryText },
                    ]}
                  >
                    BUY
                  </Text>

                  <Text
                    style={[
                      styles.flipStatValue,
                      { color: textColor },
                    ]}
                  >
                    {price !== null
                      ? `$${price.toFixed(2)}`
                      : '—'}
                  </Text>
                </View>

                <View style={styles.flipArrow}>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#3B82F6"
                  />
                </View>

                <View style={styles.flipStat}>
                  <Text
                    style={[
                      styles.flipStatLabel,
                      { color: secondaryText },
                    ]}
                  >
                    RESELL
                  </Text>

                  <Text
                    style={[
                      styles.flipStatValue,
                      { color: textColor },
                    ]}
                  >
                    {estimatedResale !== null
                      ? `$${Number(
                          estimatedResale
                        ).toFixed(2)}`
                      : '—'}
                  </Text>
                </View>

                <View style={styles.flipArrow}>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#3B82F6"
                  />
                </View>

                <View style={styles.flipStat}>
                  <Text
                    style={[
                      styles.flipStatLabel,
                      { color: secondaryText },
                    ]}
                  >
                    PROFIT
                  </Text>

                  <Text style={styles.profitValue}>
                    {estimatedProfit !== null
                      ? `+$${Number(
                          estimatedProfit
                        ).toFixed(2)}`
                      : '—'}
                  </Text>
                </View>
              </View>

              {flipConfidence !== null && (
                <Text
                  style={[
                    styles.confidence,
                    { color: secondaryText },
                  ]}
                >
                  Confidence: {flipConfidence}%
                </Text>
              )}
            </View>
          )}

          {/* PRICE HISTORY */}
          {priceHistory && (
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: cardBg, borderColor },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="stats-chart-outline"
                  size={20}
                  color="#FF7A00"
                />

                <Text
                  style={[
                    styles.sectionTitle,
                    { color: textColor },
                  ]}
                >
                  Price History
                </Text>
              </View>

              <Text
                style={[
                  styles.historyText,
                  { color: secondaryText },
                ]}
              >
                FlashRadar tracks price movement to help you
                understand whether this is a real discount.
              </Text>

              <View style={styles.historyPlaceholder}>
                <Ionicons
                  name="trending-down"
                  size={24}
                  color="#22C55E"
                />

                <Text style={styles.historyPlaceholderText}>
                  Current deal price is being monitored
                </Text>
              </View>
            </View>
          )}

          {/* EXPIRATION */}
          {formattedExpiration && (
            <View
              style={[
                styles.infoRow,
                { borderColor },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={20}
                color="#FF7A00"
              />

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.infoLabel,
                    { color: secondaryText },
                  ]}
                >
                  DEAL ENDS
                </Text>

                <Text
                  style={[
                    styles.infoValue,
                    { color: textColor },
                  ]}
                >
                  {formattedExpiration}
                </Text>
              </View>
            </View>
          )}

          {/* DISCLAIMER */}
          <Text
            style={[
              styles.disclaimer,
              { color: secondaryText },
            ]}
          >
            Prices and availability can change. FlashRadar
            provides deal information and links to the retailer
            or marketplace where the deal can be viewed.
          </Text>

          {/* CTA */}
          <TouchableOpacity
            style={styles.mainButton}
            onPress={openDeal}
            activeOpacity={0.85}
          >
            <Ionicons
              name="flash"
              size={20}
              color="#fff"
            />

            <Text style={styles.mainButtonText}>
              View Deal at {storeName}
            </Text>

            <Ionicons
              name="arrow-forward"
              size={20}
              color="#fff"
            />
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  hero: {
    width: '100%',
    height: width * 0.68,
    position: 'relative',
    backgroundColor: '#111',
  },

  heroImage: {
    width: '100%',
    height: '100%',
  },

  imageFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroControls: {
    position: 'absolute',
    top: 55,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  heroRightControls: {
    flexDirection: 'row',
    gap: 10,
  },

  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  favoriteActive: {
    backgroundColor: '#FFF1F0',
  },

  badgeContainer: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FF7A00',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },

  rareBadge: {
    backgroundColor: '#8B5CF6',
  },

  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 18,
  },

  storeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FF7A00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  storeInitial: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
  },

  storeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  storeName: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },

  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  verifiedText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },

  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    marginBottom: 18,
  },

  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  price: {
    color: '#FF7A00',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },

  originalPrice: {
    color: '#999',
    fontSize: 15,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },

  discountBox: {
    backgroundColor: '#FF7A00',
    minWidth: 75,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  discountNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },

  discountLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  savingsCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  savingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  savingsLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  savingsValue: {
    color: '#22C55E',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 1,
  },

  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },

  intelligenceGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  intelligenceItem: {
    flex: 1,
  },

  intelligenceLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  intelligenceValue: {
    fontSize: 17,
    fontWeight: '900',
  },

  hotStatus: {
    color: '#FF7A00',
    fontSize: 17,
    fontWeight: '900',
  },

  verticalDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#333',
    opacity: 0.3,
    marginHorizontal: 8,
  },

  flipCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },

  flipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  flipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  flipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  flipTitle: {
    fontSize: 17,
    fontWeight: '900',
  },

  flipSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  verdictBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },

  verdictText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },

  flipStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  flipStat: {
    flex: 1,
  },

  flipStatLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },

  flipStatValue: {
    fontSize: 16,
    fontWeight: '900',
  },

  profitValue: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '900',
  },

  flipArrow: {
    paddingHorizontal: 3,
  },

  confidence: {
    fontSize: 10,
    marginTop: 12,
  },

  historyText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 14,
  },

  historyPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },

  historyPlaceholderText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 15,
    marginBottom: 10,
  },

  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },

  disclaimer: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
    marginBottom: 16,
  },

  mainButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: '#FF7A00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#FF7A00',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },

  mainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 20,
  },

  backButtonLarge: {
    backgroundColor: '#FF7A00',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
  },

  backButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});

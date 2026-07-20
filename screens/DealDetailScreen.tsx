import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Deal } from "../components/DealCard";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";

/* ───────────────────── TYPES ───────────────────── */

type DealWithHistory = Deal & {
  originalPrice?: number | null;
  discountPercent?: number | null;
  avg30?: number | null;
  avg60?: number | null;
  avg90?: number | null;
  timestamp?: any;
};

type Props = {
  route: RouteProp<{ params: { deal: DealWithHistory } }, "params">;
};

/* ───────────────────── HELPERS ───────────────────── */

function timeAgo(timestamp?: any) {
  if (!timestamp?.seconds) return "Recently";

  const diffMs = Date.now() - timestamp.seconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function dealStrength(deal: Deal) {
  if (deal.lightning) return { label: "Lightning Deal", color: "#FF3B30" };
  if (deal.rare) return { label: "Rare Find", color: "#9B59B6" };
  if (deal.hot) return { label: "Hot Deal", color: "#FF7A00" };
  return { label: "Standard Deal", color: "#777" };
}

function normalizeImage(url?: string | null) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}

/* ───────────────────── SCREEN ───────────────────── */

export default function DealDetailScreen({ route }: Props) {
  const { deal } = route.params;
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { isPremium } = useUser();
  const [aiExplain, setAiExplain] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const call = httpsCallable(functions, "explainDeal");
        const res: any = await call({ dealId: deal.id });
        if (alive) setAiExplain(res.data?.explanation ?? null);
      } catch (e) {
        if (alive) setAiExplain(null);
      } finally {
        if (alive) setAiLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [deal.id]);

  // ✅ FIXED IMAGE RESOLUTION
  const imageUri = useMemo(() => {
    return (
      normalizeImage(deal.imageUrl) ||
      normalizeImage(deal.image) ||
      null
    );
  }, [deal.image, deal.imageUrl]);

  const dealUrl =
    deal.merchantUrl || deal.affiliateUrl || deal.url || null;

  const strength = dealStrength(deal);

  const currentPrice =
    typeof deal.price === "number" && deal.price > 0
      ? deal.price
      : null;

  const historyPrices = [
    deal.originalPrice,
    deal.avg30,
    deal.avg60,
    deal.avg90,
  ].filter((p): p is number => typeof p === "number" && p > 0);

  const oldPrice =
    historyPrices.length && currentPrice
      ? Math.max(...historyPrices)
      : null;

  // Prefer the deal's own discountPercent; fall back to computed from history
  const computedDiscount =
    currentPrice && oldPrice && oldPrice > currentPrice
      ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
      : null;

  const discountPercent =
    typeof deal.discountPercent === "number" && deal.discountPercent > 0
      ? Math.round(deal.discountPercent)
      : computedDiscount;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* HEADER BAR */}
      <View style={[styles.headerBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {deal.store}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* IMAGE */}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={48} color="#555" />
            <Text style={styles.imageFallbackText}>
              Image unavailable
            </Text>
          </View>
        )}

        <View style={styles.content}>
          {/* TITLE */}
          <Text style={[styles.title, { color: colors.text }]}>{deal.title}</Text>

          {/* STORE */}
          <Text style={[styles.store, { color: colors.subtext }]}>{deal.store}</Text>

          {/* DEAL STRENGTH */}
          <View style={styles.strengthRow}>
            <Ionicons name="flash" size={16} color={strength.color} />
            <Text style={[styles.strengthText, { color: strength.color }]}>
              {strength.label}
            </Text>
          </View>

          {/* PRICE */}
          <View style={styles.priceRow}>
            {currentPrice ? (
              <Text style={styles.price}>
                ${currentPrice.toFixed(2)}
              </Text>
            ) : (
              <Text style={styles.priceUnavailable}>{t.deals.seeDeal}</Text>
            )}

            {oldPrice && discountPercent && (
              <>
                <Text style={[styles.originalPrice, { color: colors.subtext }]}>
                  ${oldPrice.toFixed(2)}
                </Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {discountPercent}% OFF
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* META */}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={colors.subtext} />
            <Text style={[styles.metaText, { color: colors.subtext }]}>
              Posted {timeAgo(deal.timestamp)}
            </Text>
          </View>

          {/* DESCRIPTION */}
          <Text style={[styles.description, { color: colors.subtext }]}>
            This deal is live and may sell out quickly. Pricing and availability
            can change at any time.
          </Text>

          {/* AI DEAL ANALYSIS */}
          {(aiLoading || aiExplain) && (
            <View style={[aiCard.wrap, { backgroundColor: colors.card }]}>
              <View style={aiCard.head}>
                <Ionicons name="sparkles" size={15} color="#FF7A00" />
                <Text style={[aiCard.headText, { color: colors.text }]}>{t.deals.whyThisDeal}</Text>
              </View>

              {aiLoading ? (
                <Text style={[aiCard.loading, { color: colors.subtext }]}>{t.deals.analyzingDeal}</Text>
              ) : aiExplain ? (
                <>
                  {(() => {
                    const v = aiExplain.verdict || "Fair";
                    const vc = v === "Strong Buy" ? "#22c55e"
                      : v === "Good Deal" ? "#FF7A00"
                      : v === "Skip" ? "#ef4444" : "#888";
                    return (
                      <View style={[aiCard.verdictBadge, { backgroundColor: vc }]}>
                        <Text style={aiCard.verdictText}>{v}</Text>
                      </View>
                    );
                  })()}

                  {!!aiExplain.savingsNote && (
                    <Text style={[aiCard.savings, { color: colors.text }]}>{aiExplain.savingsNote}</Text>
                  )}
                  {!!aiExplain.reasoning && (
                    <Text style={[aiCard.reason, { color: colors.subtext }]}>{aiExplain.reasoning}</Text>
                  )}

                  {/* Flip analysis — premium only */}
                  {aiExplain.flipPotential && (
                    isPremium ? (
                      <View style={aiCard.flipRow}>
                        <Ionicons name="trending-up" size={14} color="#22c55e" />
                        <Text style={[aiCard.flipText, { color: colors.text }]}>
                          Flip potential: <Text style={{ fontWeight: "900" }}>{aiExplain.flipPotential}</Text>
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={aiCard.flipLocked} onPress={() => navigation.navigate("Upgrade")}>
                        <Ionicons name="lock-closed" size={13} color="#FF7A00" />
                        <Text style={aiCard.flipLockedText}>{t.deals.unlockFlipAnalysis}</Text>
                        <Ionicons name="chevron-forward" size={13} color="#FF7A00" />
                      </TouchableOpacity>
                    )
                  )}
                </>
              ) : null}
            </View>
          )}

          {/* CTA */}
          {dealUrl && (
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => Linking.openURL(dealUrl)}
            >
              <Text style={styles.openText}>{t.deals.getDeal}</Text>
            </TouchableOpacity>
          )}

          {/* GUEST SIGN-IN NUDGE */}
          {!user && (
            <TouchableOpacity
              style={styles.signInNudge}
              onPress={() => navigation.navigate("Login")}
            >
              <Ionicons name="notifications-outline" size={18} color="#FF7A00" />
              <Text style={styles.signInText}>
                Sign in to save deals & get price alerts
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#FF7A00" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────────── STYLES ───────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  signInNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF7A00",
    backgroundColor: "rgba(255,122,0,0.08)",
  },
  signInText: { flex: 1, color: "#FF7A00", fontWeight: "700", fontSize: 14 },
  container: { flex: 1, backgroundColor: "#000" },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#000",
  },

  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  image: {
    width: "100%",
    height: 320,
    resizeMode: "contain",
    backgroundColor: "#111",
  },

  imageFallback: {
    height: 320,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  imageFallbackText: {
    marginTop: 8,
    color: "#666",
    fontSize: 13,
  },

  content: { padding: 16 },

  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },

  store: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 8,
  },

  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },

  strengthText: {
    fontSize: 13,
    fontWeight: "800",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  price: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FF7A00",
  },

  priceUnavailable: {
    fontSize: 16,
    fontWeight: "700",
    color: "#bbb",
  },

  originalPrice: {
    fontSize: 14,
    color: "#aaa",
    textDecorationLine: "line-through",
  },

  discountBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  discountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },

  metaText: {
    color: "#aaa",
    fontSize: 12,
  },

  description: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  openBtn: {
    backgroundColor: "#FF6600",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  openText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});

const aiCard = StyleSheet.create({
  wrap: { marginTop: 18, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,122,0,0.25)" },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  headText: { fontSize: 14, fontWeight: "900" },
  loading: { fontSize: 13, fontStyle: "italic" },
  verdictBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  verdictText: { color: "#000", fontSize: 12, fontWeight: "900" },
  savings: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
  reason: { fontSize: 13, lineHeight: 19 },
  flipRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  flipText: { fontSize: 13, fontWeight: "600" },
  flipLocked: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(255,122,0,0.08)", borderWidth: 1, borderColor: "rgba(255,122,0,0.25)" },
  flipLockedText: { flex: 1, color: "#FF7A00", fontSize: 12, fontWeight: "800" },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking, Platform, Modal, TextInput, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

type Deal = {
  id: string;
  title: string;
  store: string;
  storeKey?: string;
  price?: number;
  image?: string | null;
  imageUrl?: string | null;
  merchantUrl?: string | null;
  affiliateUrl?: string | null;
  url?: string | null;
  isSaved?: boolean;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  live?: boolean;
  source?: "local" | "online";
  discountPercent?: number | null;
  timestamp?: any;
  expiresAt?: number | null;
  address?: string;
  latitude?: number;
  longitude?: number;
};

type Props = {
  deal: Deal;
  onToggleSave?: (deal: Deal) => Promise<void>;
  distance?: number | null;
  onOpenMaps?: () => void;
  onViewDeal: () => void;
  isLocked?: boolean;
  isPulsing?: boolean;
  theme?: "dark" | "light";
};

export default function DealCard({
  deal,
  onToggleSave,
  distance,
  onOpenMaps,
  onViewDeal,
  isLocked,
  isPulsing,
  theme = "dark",
}: Props) {
  const { user } = useAuth();
  const [localSaved, setLocalSaved] = useState(!!deal.isSaved);
  const [saving, setSaving] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlistPrice, setWishlistPrice] = useState("");

  useEffect(() => { setLocalSaved(!!deal.isSaved); }, [deal.isSaved]);

  const toggleFavorite = async () => {
    if (onToggleSave) {
      setSaving(true);
      try {
        await onToggleSave(deal);
        setLocalSaved(!localSaved);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const ref = db.collection("users").doc(user?.uid || "").collection("favorites").doc(deal.id);
      if (localSaved) {
        await ref.delete();
      } else {
        await ref.set({ ...deal, isSaved: true }, { merge: true });
      }
      setLocalSaved(!localSaved);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const addToWishlist = async () => {
    if (!wishlistPrice || isNaN(parseFloat(wishlistPrice))) {
      Alert.alert("Enter a valid target price");
      return;
    }
    try {
      if (!user) return;
      const targetPrice = parseFloat(wishlistPrice);
      const currentPrice = deal.price || 0;
      const newItem = {
        id: deal.id,
        title: deal.title,
        imageUrl: deal.image || deal.imageUrl || "",
        url: deal.url || deal.affiliateUrl || deal.merchantUrl || "",
        currentPrice,
        targetPrice,
        notifyWhenBelow: true,
        addedAt: new Date(),
      };
      const snap = await db.collection("wishlists").doc(user.uid).get();
      const items = snap.data()?.items || [];
      const exists = items.find((i: any) => i.id === deal.id);
      if (exists) {
        Alert.alert("Already in wishlist");
      } else {
        await db.collection("wishlists").doc(user.uid).set({ items: [...items, newItem] });
        Alert.alert("Added to wishlist!");
        setShowWishlistModal(false);
        setWishlistPrice("");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error adding to wishlist");
    }
  };

  const handleShare = async (d: Deal) => {
    try {
      await Linking.openURL(d.affiliateUrl || d.url || "");
    } catch (err) {
      console.error(err);
    }
  };

  const safePrice = deal.price || 0;

  return (
    <>
      <View style={cs.card}>
        <TouchableOpacity activeOpacity={0.8} onPress={onViewDeal}>
          <Image
            source={{ uri: deal.image || deal.imageUrl || "https://via.placeholder.com/150" }}
            style={cs.image}
          />
          {isLocked && <View style={cs.lockOverlay}><Ionicons name="lock-closed" size={32} color="#fff" /></View>}
        </TouchableOpacity>

        <View style={cs.body}>
          <Text style={cs.title} numberOfLines={2}>{deal.title}</Text>
          <Text style={cs.store}>{deal.store}</Text>
          
          <View style={cs.priceRow}>
            <Text style={cs.price}>${safePrice.toFixed(2)}</Text>
            {deal.discountPercent ? <Text style={cs.discount}>{deal.discountPercent}% OFF</Text> : null}
          </View>

          {distance ? <Text style={cs.distance}>{distance.toFixed(1)} mi away</Text> : null}
        </View>

        <TouchableOpacity
          onPress={toggleFavorite}
          disabled={saving}
          style={cs.saveBtn}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name={localSaved ? "heart" : "heart-outline"} size={13} color={localSaved ? "#ef4444" : "#fff"} />
          }
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowWishlistModal(true)}
          style={cs.saveBtnRight}
        >
          <Ionicons name="star-outline" size={13} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleShare(deal)}
          style={cs.shareBtn}
        >
          <Ionicons name="share-social" size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showWishlistModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWishlistModal(false)}
      >
        <View style={cs.modalOverlay}>
          <View style={cs.modalContent}>
            <Text style={cs.modalTitle}>Add to Wishlist</Text>
            <Text style={cs.modalSubtitle} numberOfLines={2}>{deal.title}</Text>
            <Text style={cs.currentPrice}>Current: ${safePrice.toFixed(2)}</Text>
            
            <TextInput
              placeholder="Target price"
              keyboardType="decimal-pad"
              value={wishlistPrice}
              onChangeText={setWishlistPrice}
              style={cs.priceInput}
              placeholderTextColor="#999"
            />
            
            <TouchableOpacity onPress={addToWishlist} style={cs.addBtn}>
              <Text style={cs.addBtnText}>Add to Wishlist</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setShowWishlistModal(false)} style={cs.cancelBtn}>
              <Text style={cs.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const cs = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flex: 1,
    margin: 4,
  },
  image: { width: "100%", height: 120 },
  lockOverlay: { position: "absolute", width: "100%", height: 120, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  body: { padding: 8 },
  title: { fontSize: 12, fontWeight: "700", color: "#fff", marginBottom: 4 },
  store: { fontSize: 10, color: "#aaa", marginBottom: 6 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: "900", color: "#FF7A00" },
  discount: { fontSize: 9, fontWeight: "700", color: "#22c55e", backgroundColor: "rgba(34,197,94,0.2)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  distance: { fontSize: 9, color: "#888" },
  saveBtn: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(255,122,0,0.8)", width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  saveBtnRight: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,122,0,0.8)", width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  shareBtn: { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(255,122,0,0.8)", width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "80%", gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#000" },
  modalSubtitle: { fontSize: 12, color: "#666" },
  currentPrice: { fontSize: 13, fontWeight: "600", color: "#FF7A00" },
  priceInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#000" },
  addBtn: { backgroundColor: "#FF7A00", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { color: "#666", fontSize: 14 },
});

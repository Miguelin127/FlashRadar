// flashradar/screens/MapScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Text,
  PanResponder,
  Linking,
  Platform,
  Alert,
  ActionSheetIOS,
  TextInput,
  Keyboard,
  ScrollView,
} from "react-native";
import MapView, { Marker, Region, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { db } from "../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;
  latitude: number;
  longitude: number;
  address?: string;
  rare?: boolean;
  category?: string;
  timestamp?: any;
};

const categories = [
  { key: "All", label: "All 💰" },
  { key: "Electronics", label: "💻 Electronics" },
  { key: "Grocery", label: "🛒 Grocery" },
  { key: "Clothing", label: "👕 Clothing" },
  { key: "Auto", label: "🚗 Auto" },
  { key: "Other", label: "🧩 Other" },
];

export default function MapScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const mapRef = useRef<MapView>(null);
  const { theme, colors } = useTheme();

  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Draggable legend
  const pan = useRef(new Animated.ValueXY({ x: 20, y: SCREEN_HEIGHT - 200 })).current;
  const lastOffset = useRef({ x: 20, y: SCREEN_HEIGHT - 200 });

  const legendResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset(lastOffset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        lastOffset.current = {
          x: lastOffset.current.x + gestureState.dx,
          y: lastOffset.current.y + gestureState.dy,
        };
        let snapX = lastOffset.current.x < SCREEN_WIDTH / 2 ? 20 : SCREEN_WIDTH - 160;
        let snapY = Math.min(Math.max(lastOffset.current.y, 100), SCREEN_HEIGHT - 250);
        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
        }).start();
        lastOffset.current = { x: snapX, y: snapY };
      },
    })
  ).current;

  // Pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Fetch deals + user location
  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snapshot = await getDocs(collection(db, "deals"));
        const items: Deal[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));
        setDeals(items);
        setFilteredDeals(items);
      } catch (error) {
        console.error("Error fetching deals for map:", error);
      }
    };

    const fetchUserLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      setRegion({ latitude, longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    };

    Promise.all([fetchDeals(), fetchUserLocation()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let results = deals;
    if (selectedCategory !== "All") {
      results = results.filter((d) => d.category === selectedCategory);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.store.toLowerCase().includes(q) ||
          (d.address && d.address.toLowerCase().includes(q))
      );
    }
    setFilteredDeals(results);
    setHighlightedIds(results.map((d) => d.id));
  }, [searchQuery, selectedCategory, deals]);

  const openDirections = (lat: number, lng: number, address?: string) => {
    const label = address ? encodeURIComponent(address) : "Deal";
    const appleUrl = `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Open in...",
          options: ["Cancel", "Apple Maps", "Google Maps", "Waze"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) Linking.openURL(appleUrl);
          if (buttonIndex === 2) Linking.openURL(googleUrl);
          if (buttonIndex === 3) Linking.openURL(wazeUrl);
        }
      );
    } else {
      Alert.alert("Open in...", "Choose a navigation app", [
        { text: "Google Maps", onPress: () => Linking.openURL(googleUrl) },
        { text: "Waze", onPress: () => Linking.openURL(wazeUrl) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const handleSearchSubmit = () => {
    if (filteredDeals.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        filteredDeals.map((d) => ({ latitude: d.latitude, longitude: d.longitude })),
        { edgePadding: { top: 100, right: 100, bottom: 100, left: 100 }, animated: true }
      );
      Keyboard.dismiss();
    }
  };

  const handleRecenter = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  };

  const handleZoom = (zoomIn: boolean) => {
    if (region && mapRef.current) {
      const newRegion = {
        ...region,
        latitudeDelta: zoomIn ? region.latitudeDelta / 2 : region.latitudeDelta * 2,
        longitudeDelta: zoomIn ? region.longitudeDelta / 2 : region.longitudeDelta * 2,
      };
      setRegion(newRegion);
      mapRef.current.animateToRegion(newRegion);
    }
  };

  if (loading || !region) {
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6600" />
        </View>
      </View>
    );
  }

  const Tag = ({ text, color }: { text: string; color: string }) => (
    <View style={{ position: "relative", marginRight: 6 }}>
      <Animated.View
        style={[
          styles.tagPulse,
          {
            transform: [
              {
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.3],
                }),
              },
            ],
            opacity: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.1],
            }),
            backgroundColor: color,
          },
        ]}
      />
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );

  const getTags = (deal: Deal) => {
    const isHot = deal.price < 10;
    const isRare = deal.rare;
    const isLive =
      deal.timestamp && Date.now() / 1000 - (deal.timestamp.seconds || 0) < 600;

    return (
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {isLive && <Tag text="🟢 Live" color="green" />}
        {isHot && <Tag text="🔥 Hot" color="red" />}
        {isRare && <Tag text="🦄 Rare" color="purple" />}
      </View>
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.text} style={{ marginRight: 6 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search deals..."
          placeholderTextColor={colors.text}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryChip,
              selectedCategory === cat.key && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === cat.key && styles.categoryTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map + Tags */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={theme === "dark" ? darkMapStyle : []}
      >
        {filteredDeals.map((deal) => (
          <Marker
            key={deal.id}
            coordinate={{ latitude: deal.latitude, longitude: deal.longitude }}
            pinColor={deal.rare ? "#800080" : deal.price < 10 ? "red" : "green"}
          >
            {highlightedIds.includes(deal.id) && (
              <Animated.View
                style={[
                  styles.highlightGlow,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2],
                        }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 0],
                    }),
                  },
                ]}
              />
            )}
            <Callout>
              <View style={{ minWidth: 180 }}>
                <Text style={{ fontWeight: "bold", color: colors.text }}>{deal.title}</Text>
                <Text style={{ color: colors.text }}>
                  ${deal.price} - {deal.store}
                </Text>
                {getTags(deal)}
                {deal.address && (
                  <Text style={{ fontSize: 12, color: colors.text, marginTop: 2 }}>
                    📍 {deal.address}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.driveButton}
                  onPress={() => openDirections(deal.latitude, deal.longitude, deal.address)}
                >
                  <Text style={styles.driveButtonText}>🚗 Drive to</Text>
                </TouchableOpacity>
              </View>
            </Callout>
          </Marker>
        ))}

        {userLocation && (
          <Marker coordinate={userLocation}>
            <View style={styles.userMarkerContainer}>
              <Animated.View
                style={[
                  styles.pulse,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 3],
                        }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0],
                    }),
                  },
                ]}
              />
              <View style={styles.userMarker} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Controls */}
      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(false)}>
          <Ionicons name="remove" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <Animated.View
        {...legendResponder.panHandlers}
        style={[
          styles.legendBox,
          { transform: pan.getTranslateTransform(), backgroundColor: colors.card },
        ]}
      >
        <Text style={[styles.legendItem, { color: colors.text }]}>🔵 You</Text>
        <Text style={[styles.legendItem, { color: colors.text }]}>🟣 Rare Deal</Text>
        <Text style={[styles.legendItem, { color: colors.text }]}>🔴 Hot Deal (&lt;$10)</Text>
        <Text style={[styles.legendItem, { color: colors.text }]}>🟢 Deal</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  map: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 16 },
  categoryBar: { position: "absolute", top: 100, left: 0, right: 0, zIndex: 9 },
  categoryChip: {
    backgroundColor: "#eee",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: "#FF6600" },
  categoryText: { fontSize: 13, color: "#333", fontWeight: "500" },
  categoryTextActive: { color: "#fff", fontWeight: "700" },
  recenterButton: {
    position: "absolute",
    left: 20,
    bottom: 120,
    backgroundColor: "#FF6600",
    padding: 10,
    borderRadius: 50,
    elevation: 3,
  },
  zoomControls: { position: "absolute", right: 20, top: 150 },
  zoomButton: {
    backgroundColor: "#FF6600",
    padding: 10,
    borderRadius: 50,
    marginVertical: 5,
    elevation: 3,
  },
  userMarkerContainer: { alignItems: "center", justifyContent: "center" },
  pulse: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 102, 0, 0.4)",
  },
  userMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FF6600",
    borderWidth: 2,
    borderColor: "#fff",
  },
  tagText: { fontSize: 12, fontWeight: "600" },
  tagPulse: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignSelf: "center",
  },
  legendBox: {
    position: "absolute",
    width: 140,
    padding: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 15,
  },
  legendItem: { fontSize: 14, marginBottom: 4 },
  highlightGlow: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,165,0,0.4)",
    alignSelf: "center",
  },
  driveButton: { marginTop: 6, backgroundColor: "#FF6600", padding: 6, borderRadius: 6 },
  driveButtonText: { color: "#fff", fontWeight: "600", textAlign: "center" },
});

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
];

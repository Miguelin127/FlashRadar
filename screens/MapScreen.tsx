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

  if (loading || !region) {
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6600" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={theme === "dark" ? darkMapStyle : []}
      >
        {filteredDeals.map((deal) => {
          // 🔥 FIX — PREVENT NULL COORDINATES CRASH
          if (
            typeof deal.latitude !== "number" ||
            typeof deal.longitude !== "number"
          ) {
            return null;
          }

          return (
            <Marker
              key={deal.id}
              coordinate={{
                latitude: deal.latitude,
                longitude: deal.longitude,
              }}
              pinColor={deal.rare ? "#800080" : deal.price < 10 ? "red" : "green"}
            >
              <Callout>
                <View style={{ minWidth: 180 }}>
                  <Text style={{ fontWeight: "bold", color: colors.text }}>{deal.title}</Text>
                  <Text style={{ color: colors.text }}>
                    ${deal.price} - {deal.store}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {userLocation && (
          <Marker coordinate={userLocation}>
            <View style={styles.userMarkerContainer}>
              <View style={styles.userMarker} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  map: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  userMarkerContainer: { alignItems: "center", justifyContent: "center" },
  userMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FF6600",
    borderWidth: 2,
    borderColor: "#fff",
  },
});

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
];

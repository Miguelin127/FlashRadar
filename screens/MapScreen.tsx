import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Linking, ActivityIndicator, TextInput, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { db, functions } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const CHAIN_KEYS: { key: string; match: RegExp }[] = [
  { key: 'walmart', match: /walmart/i },
  { key: 'target', match: /target/i },
  { key: 'homedepot', match: /home\s*depot/i },
  { key: 'bestbuy', match: /best\s*buy/i },
  { key: 'costco', match: /costco/i },
];

function storeNameToKey(name: string): string {
  for (const c of CHAIN_KEYS) {
    if (c.match.test(name)) return c.key;
  }
  return '';
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s1 = Math.sin(toRad(bLat - aLat) / 2);
  const s2 = Math.sin(toRad(bLng - aLng) / 2);
  const h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface PhysicalStore {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  chainKey?: string;
}

interface Deal {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  imageUrl?: string;
  store: string;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  affiliateUrl?: string;
  merchantUrl?: string;
  url?: string;
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const navigation = useNavigation();
  const [region, setRegion] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [stores, setStores] = useState<PhysicalStore[]>([]);
  const [selected, setSelected] = useState<PhysicalStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    initMap();
  }, []);

  const fetchDealsForStore = async (store: PhysicalStore) => {
    setLoadingDeals(true);
    try {
      const chainKey = store.chainKey || storeNameToKey(store.name);
      if (chainKey === '') {
        setSelectedDeals([]);
        return;
      }
      const q = query(
        collection(db, 'deals_live'),
        where('storeKey', '==', chainKey),
        where('live', '==', true),
        limit(10)
      );
      const dealsSnap = await getDocs(q);
      const deals: Deal[] = dealsSnap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title,
          price: data.price,
          originalPrice: data.originalPrice,
          discountPercent: data.discountPercent,
          imageUrl: data.imageUrl,
          store: data.store,
          hot: data.hot,
          rare: data.rare,
          lightning: data.lightning,
          affiliateUrl: data.affiliateUrl,
          merchantUrl: data.merchantUrl,
          url: data.url,
        };
      });
      setSelectedDeals(deals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      setSelectedDeals([]);
    } finally {
      setLoadingDeals(false);
    }
  };

  // Free path: pins come from the shared Firestore cache. No Places API call.
  const loadCachedStores = async (latitude: number, longitude: number) => {
    try {
      const snap = await getDoc(doc(db, 'config', 'storeLocationCache'));
      const locations = (snap.data()?.locations ?? {}) as Record<string, any[]>;
      const pins: PhysicalStore[] = [];
      Object.keys(locations).forEach(chainKey => {
        (locations[chainKey] || []).forEach((pl: any) => {
          const lat = pl?.location?.latitude;
          const lng = pl?.location?.longitude;
          if (typeof lat === 'number' && typeof lng === 'number') {
            if (distanceMeters(latitude, longitude, lat, lng) <= 40000) {
              pins.push({
                id: String(pl.id ?? lat + '_' + lng),
                name: pl?.displayName?.text ?? chainKey,
                address: pl?.formattedAddress ?? '',
                latitude: lat,
                longitude: lng,
                chainKey,
              });
            }
          }
        });
      });
      setStores(pins);
      setShowSearchButton(pins.length === 0);
      console.log('Cached stores loaded:', pins.length);
    } catch (error) {
      console.error('Error loading cached stores:', error);
    } finally {
      setLoading(false);
    }
  };

  // Paid path: only runs on an explicit user search, behind the callable.
  const fetchStoresNearLocation = async (latitude: number, longitude: number, searchText?: string) => {
    try {
      const call = httpsCallable(functions, 'searchStoresNearby');
      const res: any = await call({ lat: latitude, lng: longitude, query: searchText ?? '' });
      const places = (res?.data?.places ?? []) as PhysicalStore[];
      setStores(places);
      setShowSearchButton(false);
      console.log('Stores loaded:', places.length, 'source:', res?.data?.source);
    } catch (error: any) {
      console.error('Error fetching stores:', error?.message);
      Alert.alert('Store search', error?.message || 'Could not search stores right now.');
    } finally {
      setLoading(false);
    }
  };

  const initMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      setRegion(newRegion);
      setMapRegion(newRegion);

      await loadCachedStores(latitude, longitude);
    } catch (error) {
      console.error('Map error:', error);
      setLoading(false);
    }
  };

  const handleRegionChange = (newRegion: any) => {
    setMapRegion(newRegion);
    setShowSearchButton(true);
  };

  const handleSearchThisArea = async () => {
    if (mapRegion) {
      setLoading(true);
      await fetchStoresNearLocation(mapRegion.latitude, mapRegion.longitude);
    }
  };

  const handleSearchStore = async () => {
    if (!searchQuery.trim() || !userLocation) return;
    setLoading(true);
    await fetchStoresNearLocation(userLocation.latitude, userLocation.longitude, searchQuery);
  };

  const openDirections = (store: PhysicalStore) => {
    const url = `https://maps.apple.com/?address=${encodeURIComponent(store.address)}&ll=${store.latitude},${store.longitude}`;
    Linking.openURL(url).catch(() => {
      const androidUrl = `geo:${store.latitude},${store.longitude}?q=${encodeURIComponent(store.address)}`;
      Linking.openURL(androidUrl);
    });
  };

  const handleViewDeal = (deal: Deal) => {
    navigation.navigate('Explore', { screen: 'DealDetail', params: { deal } });
  };

  const handleShowDeals = async (store: PhysicalStore) => {
    await fetchDealsForStore(store);
  };

  if (loading && !region) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={{ color: darkMode ? '#fff' : '#000', marginTop: 12 }}>Loading stores...</Text>
      </View>
    );
  }

  if (!region) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <MapView 
        style={{ flex: 1 }} 
        initialRegion={region} 
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation
      >
        {stores.map(store => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
            pinColor="#FF7A00"
            onPress={() => {
              setSelected(store);
              handleShowDeals(store);
            }}
          />
        ))}
      </MapView>

      <View style={[styles.searchContainer, { backgroundColor: darkMode ? '#111' : '#fff' }]}>
        <View style={[styles.searchInput, { borderColor: darkMode ? '#333' : '#e0e0e0' }]}>
          <Ionicons name="search" size={18} color="#FF7A00" />
          <TextInput
            placeholder="Search stores (Nike, CVS, Target...)"
            placeholderTextColor={darkMode ? '#666' : '#999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchStore}
            style={[styles.input, { color: darkMode ? '#fff' : '#000' }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#FF7A00" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {showSearchButton && !selected && (
        <TouchableOpacity 
          style={styles.searchBtn}
          onPress={handleSearchThisArea}
        >
          <Ionicons name="search" size={16} color="#fff" />
          <Text style={styles.searchBtnText}>Search This Area</Text>
        </TouchableOpacity>
      )}

      {selected && (
        <View style={[styles.sheet, { backgroundColor: darkMode ? '#111' : '#fff' }]}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={darkMode ? '#fff' : '#000'} />
          </TouchableOpacity>

          <Text style={[styles.name, { color: darkMode ? '#fff' : '#000' }]}>
            {selected.name}
          </Text>
          <Text style={[styles.address, { color: darkMode ? '#aaa' : '#666' }]}>
            {selected.address}
          </Text>

          <Text style={[styles.dealsHeader, { color: darkMode ? '#fff' : '#000' }]}>
            🔥 {selectedDeals.length} FlashRadar Deals
          </Text>

          {selectedDeals.length === 0 && !loadingDeals && (
            <Text style={[styles.noDeals, { color: darkMode ? '#aaa' : '#666' }]}>
              No FlashRadar deals found for this retailer.
            </Text>
          )}

          {loadingDeals ? (
            <ActivityIndicator color="#FF7A00" size="small" />
          ) : selectedDeals.length > 0 ? (
            <FlatList
              data={selectedDeals.slice(0, 3)}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.dealItem, { borderBottomColor: darkMode ? '#333' : '#eee' }]}
                  onPress={() => handleViewDeal(item)}
                >
                  <Text style={[styles.dealTitle, { color: darkMode ? '#fff' : '#000' }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.dealRow}>
                    <Text style={[styles.price, { color: '#FF7A00' }]}>
                      ${item.price}
                    </Text>
                    {item.discountPercent && (
                      <Text style={[styles.discount, { color: '#22c55e' }]}>
                        {item.discountPercent}% OFF
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : null}

          <TouchableOpacity style={styles.directionBtn} onPress={() => openDirections(selected)}>
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.directionText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  searchBtn: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#FF7A00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  address: { fontSize: 14, marginBottom: 12 },
  dealsHeader: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  noDeals: { fontSize: 13, marginBottom: 12 },
  dealItem: { paddingVertical: 10, borderBottomWidth: 1 },
  dealTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  dealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 14, fontWeight: 'bold' },
  discount: { fontSize: 11, fontWeight: '700' },
  directionBtn: { flexDirection: 'row', backgroundColor: '#FF7A00', paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 8 },
  directionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

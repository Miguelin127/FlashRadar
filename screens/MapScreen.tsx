import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Linking, ActivityIndicator, TextInput, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { db, functions } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, orderBy, startAt, endAt } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
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
  distanceM?: number;
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
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [chainCounts, setChainCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    initMap();
  }, []);

  const fetchDealsForStore = async (store: PhysicalStore) => {
    setLoadingDeals(true);
    try {
      const chainKey = store.chainKey || storeNameToKey(store.name);
      if (chainKey === '') { setSelectedDeals([]); setSelectedTier(''); return; }
      const snap = await getDoc(doc(db, 'chainDeals', chainKey));
      const data = snap.data() as any;
      if (data == null) { setSelectedDeals([]); setSelectedTier(''); return; }
      setSelectedTier(String(data.inventoryTier || 'retailer_only'));
      const list = (data.deals || []) as any[];
      setSelectedDeals(list.map((d: any, i: number) => ({
        id: String(d.dealId || i),
        title: d.title || '',
        price: d.price,
        originalPrice: d.originalPrice,
        discountPercent: d.discountPercent,
        imageUrl: d.imageUrl,
        store: data.label || chainKey,
        affiliateUrl: d.affiliateUrl,
        merchantUrl: d.merchantUrl,
        url: d.url,
      })));
    } catch (error) {
      console.error('Error fetching deals:', error);
      setSelectedDeals([]);
    } finally {
      setLoadingDeals(false);
    }
  };

  // Per-chain deal counts, so a marker can show a real number.
  const loadChainCounts = async () => {
    try {
      const snap = await getDocs(collection(db, 'chainDeals'));
      const counts: Record<string, number> = {};
      snap.docs.forEach(d => { counts[d.id] = Number((d.data() as any).dealCount || 0); });
      setChainCounts(counts);
    } catch (error) {
      console.error('Error loading chain counts:', error);
    }
  };

  // Verified stores near the user: geohash bounds, then true distance.
  const loadNearbyStores = async (latitude: number, longitude: number) => {
    try {
      const radiusM = 40000;
      const bounds = geohashQueryBounds([latitude, longitude], radiusM);
      const snaps = await Promise.all(bounds.map(b =>
        getDocs(query(collection(db, 'stores'), orderBy('geohash'), startAt(b[0]), endAt(b[1])))
      ));
      const pins: PhysicalStore[] = [];
      snaps.forEach(snap => snap.docs.forEach(docSnap => {
        const x = docSnap.data() as any;
        if (x.active === false || x.verified === false) return;
        const dMeters = distanceBetween([x.lat, x.lng], [latitude, longitude]) * 1000;
        if (dMeters > radiusM) return;
        pins.push({
          id: docSnap.id,
          name: x.name,
          address: x.address + ', ' + x.city + ', ' + x.state,
          latitude: x.lat,
          longitude: x.lng,
          chainKey: x.storeKey,
          distanceM: dMeters,
        });
      }));
      pins.sort((a, b) => (a.distanceM || 0) - (b.distanceM || 0));
      setStores(pins.slice(0, 120));
      setShowSearchButton(pins.length === 0);
      console.log('Nearby verified stores:', pins.length);
    } catch (error) {
      console.error('Error loading nearby stores:', error);
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

      await Promise.all([loadNearbyStores(latitude, longitude), loadChainCounts()]);
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
    navigation.navigate('DealDetail', { deal });
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
        {stores.map(store => {
          const count = chainCounts[store.chainKey || ''] || 0;
          return (
            <Marker
              key={store.id}
              coordinate={{ latitude: store.latitude, longitude: store.longitude }}
              onPress={() => {
                setSelected(store);
                handleShowDeals(store);
              }}
              tracksViewChanges={false}
            >
              {count > 0 ? (
                <View style={styles.pinBubble}>
                  <Text style={styles.pinBubbleText}>{count}</Text>
                </View>
              ) : (
                <View style={styles.pinDot} />
              )}
            </Marker>
          );
        })}
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
            {selected.distanceM ? '  ·  ' + (selected.distanceM / 1609).toFixed(1) + ' mi' : ''}
          </Text>

          <Text style={[styles.dealsHeader, { color: darkMode ? '#fff' : '#000' }]}>
            {selectedDeals.length} deal{selectedDeals.length === 1 ? '' : 's'} at {selected.name}
          </Text>
          {selectedDeals.length > 0 && selectedTier !== 'verified' && (
            <Text style={styles.tierNote}>
              Carried by this retailer. In-store stock is not verified.
            </Text>
          )}

          {selectedDeals.length === 0 && !loadingDeals && (
            <Text style={[styles.noDeals, { color: darkMode ? '#aaa' : '#666' }]}>
              No verified FlashRadar deals for this retailer yet.
            </Text>
          )}

          {loadingDeals ? (
            <ActivityIndicator color="#FF7A00" size="small" />
          ) : selectedDeals.length > 0 ? (
            <FlatList
              data={selectedDeals}
              keyExtractor={item => item.id}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
              style={styles.dealList}
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
                  <Text style={[styles.stockNote, selectedTier === 'verified' ? styles.stockOk : styles.stockUnknown]}>
                    {selectedTier === 'verified' ? '✓ In stock' : 'Online at this retailer'}
                  </Text>
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
  dealList: { flexShrink: 1 },
  pinBubble: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 15,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinBubbleText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(120,120,120,0.85)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  tierNote: { fontSize: 11, color: '#f59e0b', marginBottom: 8 },
  stockNote: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  stockOk: { color: '#22c55e' },
  stockUnknown: { color: '#94a3b8' },
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
    maxHeight: '75%',
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

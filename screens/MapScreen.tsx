import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Linking, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

const GOOGLE_API_KEY = 'AIzaSyBeldwLWhSlf0bYzJHBmtce4R1XoEnXBXc';
const STORE_TYPES = ['Target', 'Walmart', 'Best Buy', 'CVS', 'Home Depot', 'Walgreens', 'Sephora'];

interface PhysicalStore {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
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

  useEffect(() => {
    initMap();
  }, []);

  const normalizeRetailer = (name: string): string => {
    return name.toLowerCase().replace(/\.com|\.ca/g, '').trim();
  };

  const fetchDealsForStore = async (storeName: string) => {
    setLoadingDeals(true);
    try {
      const normalizedStore = normalizeRetailer(storeName);
      const dealsSnap = await getDocs(collection(db, 'deals_live'));
      
      const deals: Deal[] = [];
      dealsSnap.forEach(doc => {
        const data = doc.data();
        if (data.store && normalizeRetailer(data.store).includes(normalizedStore)) {
          deals.push({
            id: doc.id,
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
          });
        }
      });

      setSelectedDeals(deals);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoadingDeals(false);
    }
  };

  const fetchStoresNearLocation = async (latitude: number, longitude: number) => {
    try {
      const allStores: PhysicalStore[] = [];

      for (const storeType of STORE_TYPES) {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress',
          },
          body: JSON.stringify({
            textQuery: storeType,
            maxResultCount: 5,
            locationBias: {
              circle: {
                center: { latitude, longitude },
                radius: 20000.0,
              },
            },
          }),
        });

        const data = await res.json();
        if (data.places) {
          data.places.forEach((place: any) => {
            allStores.push({
              id: place.id,
              name: place.displayName?.text || storeType,
              address: place.formattedAddress || '',
              latitude: place.location?.latitude || 0,
              longitude: place.location?.longitude || 0,
            });
          });
        }
      }

      setStores(allStores);
      setShowSearchButton(false);
      setLoading(false);
      console.log('Real stores loaded:', allStores.length);
    } catch (error) {
      console.error('Error fetching stores:', error);
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

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      setRegion(newRegion);
      setMapRegion(newRegion);

      await fetchStoresNearLocation(latitude, longitude);
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

  const openDirections = (store: PhysicalStore) => {
    const url = `https://maps.apple.com/?address=${encodeURIComponent(store.address)}&ll=${store.latitude},${store.longitude}`;
    Linking.openURL(url).catch(() => {
      const androidUrl = `geo:${store.latitude},${store.longitude}?q=${encodeURIComponent(store.address)}`;
      Linking.openURL(androidUrl);
    });
  };

  const handleViewDeal = (deal: Deal) => {
    navigation.navigate('DealDetail', { deal, dealId: deal.id });
  };

  const handleShowDeals = async (store: PhysicalStore) => {
    await fetchDealsForStore(store.name);
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

      {showSearchButton && (
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
  searchBtn: {
    position: 'absolute',
    top: 60,
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

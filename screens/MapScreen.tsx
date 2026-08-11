import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

interface Store {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  dealCount: number;
}

interface Deal {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  image: string;
  store: string;
  url?: string;
  affiliateUrl?: string;
  merchantUrl?: string;
}

const GOOGLE_PLACES_API_KEY = 'AIzaSyCKn73y--LsPxw5vJBknf8VURDWiO84ZME';
const STORE_TYPES = ['Walmart', 'Target', 'Best Buy', 'CVS', 'Walgreens', 'Home Depot', 'Costco'];

const FALLBACK_STORES: { [key: string]: { lat: number; lng: number; address: string }[] } = {
  'Walmart': [
    { lat: 41.9094, lng: -87.7123, address: '4650 W North Ave, Chicago, IL 60639' },
    { lat: 41.6945, lng: -87.6234, address: '10900 S Doty Ave, Chicago, IL 60628' },
  ],
  'Target': [
    { lat: 41.8847, lng: -87.6191, address: '830 N State St, Chicago, IL 60610' },
  ],
  'Best Buy': [
    { lat: 41.8906, lng: -87.6188, address: '540 N Michigan Ave, Chicago, IL 60611' },
  ],
  'CVS': [
    { lat: 41.8781, lng: -87.6298, address: '100 E Chicago Ave, Chicago, IL 60611' },
  ],
};

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [userLocation, setUserLocation] = useState({ latitude: 41.8781, longitude: -87.6298 });
  const [stores, setStores] = useState<Store[]>([]);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeDeal, setStoreDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(5);

  useEffect(() => {
    initLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchDealsAndStores();
    }
  }, [userLocation, radius]);

  const initLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch (error) {
      console.warn('Location error:', error);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const searchNearbyStores = async () => {
    try {
      const storeLocations: Store[] = [];
      let foundAny = false;

      for (const storeType of STORE_TYPES) {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLocation.latitude},${userLocation.longitude}&radius=${radius * 1609}&keyword=${storeType}&key=${GOOGLE_PLACES_API_KEY}`;
          
          const response = await fetch(url);
          const data = await response.json();

          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            foundAny = true;
            data.results.slice(0, 3).forEach((place: any) => {
              const distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                place.geometry.location.lat,
                place.geometry.location.lng
              );

              storeLocations.push({
                id: place.place_id,
                name: storeType,
                address: place.vicinity,
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                distance,
                dealCount: 0,
              });
            });
          }
        } catch (error) {
          console.warn(`Error fetching ${storeType}:`, error);
        }
      }

      if (!foundAny) {
        console.warn('Google Places API failed, using fallback');
        Object.entries(FALLBACK_STORES).forEach(([storeName, locations]) => {
          locations.forEach((loc, idx) => {
            const distance = calculateDistance(userLocation.latitude, userLocation.longitude, loc.lat, loc.lng);
            if (distance <= radius) {
              storeLocations.push({
                id: `${storeName}-${idx}`,
                name: storeName,
                address: loc.address,
                latitude: loc.lat,
                longitude: loc.lng,
                distance,
                dealCount: 0,
              });
            }
          });
        });
      }

      setStores(storeLocations.sort((a, b) => a.distance - b.distance));
    } catch (error) {
      console.error('Store search error:', error);
    }
  };

  const isAmazonDeal = (deal: Deal): boolean => {
    const store = deal.store?.toLowerCase?.() || '';
    const url = (deal.url || deal.affiliateUrl || deal.merchantUrl || '').toLowerCase();
    return store.includes('amazon') || url.includes('amazon');
  };

  const isValidForStore = (deal: Deal, storeName: string): boolean => {
    const url = (deal.url || deal.affiliateUrl || deal.merchantUrl || '').toLowerCase();
    const storeNameLower = storeName.toLowerCase();

    if (storeNameLower.includes('walmart')) return url.includes('walmart');
    if (storeNameLower.includes('target')) return url.includes('target');
    if (storeNameLower.includes('best buy')) return url.includes('bestbuy');
    if (storeNameLower.includes('cvs')) return url.includes('cvs');
    if (storeNameLower.includes('walgreens')) return url.includes('walgreens');
    if (storeNameLower.includes('home depot')) return url.includes('homedepot');
    if (storeNameLower.includes('costco')) return url.includes('costco');

    return false;
  };

  const fetchDealsAndStores = async () => {
    try {
      setLoading(true);

      const [liveSnaps, instoreSnaps] = await Promise.all([
        db.collection('deals_live').limit(500).get(),
        db.collection('deals_instore').limit(500).get(),
      ]);

      const dealsData: Deal[] = [...liveSnaps.docs, ...instoreSnaps.docs]
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            price: data.price || 0,
            originalPrice: data.originalPrice || 0,
            discountPercent: data.discountPercent || 0,
            image: data.image || '',
            store: data.store || '',
            url: data.url || '',
            affiliateUrl: data.affiliateUrl || '',
            merchantUrl: data.merchantUrl || '',
          };
        })
        .filter(d => {
          if (d.price <= 0) return false;
          if (isAmazonDeal(d)) return false;
          const discount = ((d.originalPrice - d.price) / d.originalPrice) * 100;
          return discount >= 40;
        });

      setAllDeals(dealsData);

      await searchNearbyStores();

      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    const deals = allDeals.filter(d => d.store && isValidForStore(d, store.name));
    setStoreDeals(deals);
  };

  const handleGetDirections = async (store: Store) => {
    const url = `https://maps.apple.com/?daddr=${store.latitude},${store.longitude}&saddr=${userLocation.latitude},${userLocation.longitude}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not open directions');
    }
  };

  const bgColor = darkMode ? '#000' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';
  const cardBg = darkMode ? '#1a1a1a' : '#f5f5f5';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bgColor }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <MapView
        style={{ flex: selectedStore ? 0.5 : 1 }}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {stores.map(store => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            onPress={() => handleStoreSelect(store)}
          >
            <View style={{
              backgroundColor: '#FF7A00',
              borderRadius: 50,
              padding: 10,
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderWidth: 2,
              borderColor: '#fff',
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
                {allDeals.filter(d => d.store && isValidForStore(d, store.name)).length}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={{ position: 'absolute', top: 50, left: 15, right: 15 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[2, 5, 10, 25].map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => setRadius(r)}
              style={{
                flex: 1,
                backgroundColor: radius === r ? '#FF7A00' : cardBg,
                paddingVertical: 8,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: radius === r ? '#fff' : textColor, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
                {r}mi
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selectedStore && (
        <View style={{ flex: 0.5, backgroundColor: bgColor, borderTopWidth: 2, borderTopColor: '#FF7A00' }}>
          <ScrollView style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <View>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18 }}>
                  {selectedStore.name}
                </Text>
                <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
                  {selectedStore.address}
                </Text>
                <Text style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                  {selectedStore.distance.toFixed(1)} mi away
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStore(null)}>
                <Text style={{ fontSize: 24, color: textColor }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: '#2196F3', padding: 12, borderRadius: 8, marginBottom: 15 }}
              onPress={() => handleGetDirections(selectedStore)}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                🚗 Get Directions
              </Text>
            </TouchableOpacity>

            {storeDeal.length === 0 ? (
              <Text style={{ color: '#999', textAlign: 'center', marginTop: 20 }}>
                No verified deals at this location
              </Text>
            ) : (
              <>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14, marginBottom: 10 }}>
                  {storeDeal.length} Deals Available
                </Text>
                {storeDeal.map(deal => (
                  <TouchableOpacity
                    key={deal.id}
                    onPress={() => {
                      const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
                      if (url) Linking.openURL(url);
                    }}
                    style={{ backgroundColor: cardBg, borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' }}
                  >
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 12, marginBottom: 6 }} numberOfLines={2}>
                      {deal.title}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 14 }}>
                          ${deal.price.toFixed(2)}
                        </Text>
                        <Text style={{ color: '#999', fontSize: 10, textDecorationLine: 'line-through' }}>
                          ${deal.originalPrice.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={{ color: '#fff', backgroundColor: '#FF7A00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: 'bold', fontSize: 11 }}>
                        {deal.discountPercent}% OFF
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

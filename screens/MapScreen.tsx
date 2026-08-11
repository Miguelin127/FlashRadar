import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Alert, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

interface StoreLocation {
  id: string;
  retailer: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
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

const CANONICAL_STORES: StoreLocation[] = [
  { id: 'walmart-01', retailer: 'Walmart', name: 'Walmart', address: '4650 W North Ave', city: 'Chicago', state: 'IL', latitude: 41.9094, longitude: -87.7123 },
  { id: 'target-01', retailer: 'Target', name: 'Target', address: '830 N State St', city: 'Chicago', state: 'IL', latitude: 41.8847, longitude: -87.6191 },
  { id: 'bestbuy-01', retailer: 'Best Buy', name: 'Best Buy', address: '540 N Michigan Ave', city: 'Chicago', state: 'IL', latitude: 41.8906, longitude: -87.6188 },
  { id: 'cvs-01', retailer: 'CVS', name: 'CVS', address: '100 E Chicago Ave', city: 'Chicago', state: 'IL', latitude: 41.8781, longitude: -87.6298 },
  { id: 'walgreens-01', retailer: 'Walgreens', name: 'Walgreens', address: '757 N Michigan Ave', city: 'Chicago', state: 'IL', latitude: 41.8850, longitude: -87.6300 },
  { id: 'homedepot-01', retailer: 'Home Depot', name: 'Home Depot', address: '2151 W 35th St', city: 'Chicago', state: 'IL', latitude: 41.7435, longitude: -87.5640 },
];

const STORE_ALIASES: { [key: string]: string } = {
  'walmart': 'Walmart',
  'target': 'Target',
  'best buy': 'Best Buy',
  'bestbuy': 'Best Buy',
  'cvs': 'CVS',
  'walgreens': 'Walgreens',
  'home depot': 'Home Depot',
  'homedepot': 'Home Depot',
};

const normalizeStoreName = (storeName: string): string => {
  return storeName.toLowerCase().trim().replace('.com', '').replace(' store', '');
};

const getCanonicalStoreName = (storeName: string): string | null => {
  const normalized = normalizeStoreName(storeName);
  return STORE_ALIASES[normalized] || null;
};

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [userLocation, setUserLocation] = useState({ latitude: 41.8781, longitude: -87.6298 });
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null);
  const [storeDeal, setStoreDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initLocation();
  }, []);

  useEffect(() => {
    fetchDeals();
  }, []);

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

  const fetchDeals = async () => {
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
          if (d.store.toLowerCase().includes('amazon')) return false;
          const discount = ((d.originalPrice - d.price) / d.originalPrice) * 100;
          return discount >= 40;
        });

      console.log('Loaded deals:', dealsData.length);
      dealsData.forEach(d => {
        const canonical = getCanonicalStoreName(d.store);
        console.log(`DEAL MATCH: "${d.title}" storeName: ${d.store} canonical: ${canonical}`);
      });

      setAllDeals(dealsData);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const getStoreDeals = (store: StoreLocation): Deal[] => {
    return allDeals.filter(deal => {
      const canonical = getCanonicalStoreName(deal.store);
      return canonical === store.retailer;
    });
  };

  const handleStoreSelect = (store: StoreLocation) => {
    setSelectedStore(store);
    const deals = getStoreDeals(store);
    setStoreDeals(deals);
    console.log(`Selected ${store.retailer}: ${deals.length} deals`);
  };

  const handleGetDirections = async (store: StoreLocation) => {
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
        {CANONICAL_STORES.map(store => {
          const dealCount = getStoreDeals(store).length;
          return (
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
                  {dealCount}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {selectedStore && (
        <View style={{ flex: 0.5, backgroundColor: bgColor, borderTopWidth: 2, borderTopColor: '#FF7A00' }}>
          <ScrollView style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <View>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18 }}>
                  {selectedStore.retailer}
                </Text>
                <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
                  {selectedStore.address}
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
                No deals at this location
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

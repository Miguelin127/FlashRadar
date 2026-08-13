import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

type MapStore = {
  id: string;
  storeName: string;
  address: string;
  latitude: number;
  longitude: number;
};

type Deal = {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  storeName: string;
  dealUrl: string;
};

const MAP_STORES: MapStore[] = [
  { id: 'walmart', storeName: 'Walmart', address: '4650 W North Ave, Chicago, IL 60639', latitude: 41.9094, longitude: -87.7123 },
  { id: 'target', storeName: 'Target', address: '830 N State St, Chicago, IL 60610', latitude: 41.8847, longitude: -87.6191 },
  { id: 'bestbuy', storeName: 'Best Buy', address: '540 N Michigan Ave, Chicago, IL 60611', latitude: 41.8906, longitude: -87.6188 },
  { id: 'cvs', storeName: 'CVS', address: '100 E Chicago Ave, Chicago, IL 60611', latitude: 41.8781, longitude: -87.6298 },
  { id: 'homedepot', storeName: 'Home Depot', address: '2151 W 35th St, Chicago, IL 60609', latitude: 41.7435, longitude: -87.5640 },
];

const STORE_ID_MAP: { [key: string]: string } = {
  'walmart': 'walmart',
  'walmart supercenter': 'walmart',
  'target': 'target',
  'best buy': 'bestbuy',
  'bestbuy': 'bestbuy',
  'cvs': 'cvs',
  'walgreens': 'walgreens',
  'home depot': 'homedepot',
  'homedepot': 'homedepot',
};

const normalizeStoreName = (name: string): string => {
  return name.toLowerCase().trim().replace('.com', '').replace(' store', '');
};

const getStoreId = (storeName: string): string | null => {
  const normalized = normalizeStoreName(storeName);
  return STORE_ID_MAP[normalized] || null;
};

const isValidDealForStore = (dealUrl: string, storeId: string): boolean => {
  const url = dealUrl.toLowerCase();
  
  if (url.includes('amazon')) return false;
  
  if (storeId === 'walmart' && url.includes('walmart')) return true;
  if (storeId === 'target' && url.includes('target')) return true;
  if (storeId === 'bestbuy' && url.includes('bestbuy')) return true;
  if (storeId === 'cvs' && url.includes('cvs')) return true;
  if (storeId === 'homedepot' && url.includes('homedepot')) return true;
  
  return false;
};

const isHomepage = (url: string): boolean => {
  const normalized = url.toLowerCase();
  return normalized === 'https://www.walmart.com/' || 
         normalized === 'https://www.target.com/' ||
         normalized === 'https://www.bestbuy.com/' ||
         normalized === 'https://www.cvs.com/' ||
         normalized === 'https://www.homedepot.com/' ||
         normalized.endsWith('.com/') ||
         normalized.endsWith('.com');
};

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [selectedStore, setSelectedStore] = useState<MapStore | null>(null);
  const [storeDeal, setStoreDeal] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, []);

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
          const url = data.url || data.affiliateUrl || data.merchantUrl || '';
          return {
            id: doc.id,
            title: data.title || '',
            price: data.price || 0,
            originalPrice: data.originalPrice || 0,
            discountPercent: data.discountPercent || 0,
            storeName: data.store || '',
            dealUrl: url,
          };
        })
        .filter(d => {
          if (d.price <= 0) return false;
          if (!d.dealUrl) return false;
          if (d.dealUrl.toLowerCase().includes('amazon')) return false;
          if (d.storeName.toLowerCase().includes('amazon')) return false;
          if (isHomepage(d.dealUrl)) {
            console.log(`REJECTED HOMEPAGE: "${d.title}" → ${d.dealUrl}`);
            return false;
          }
          const discount = ((d.originalPrice - d.price) / d.originalPrice) * 100;
          if (discount < 40) return false;
          const storeId = getStoreId(d.storeName);
          if (!storeId) return false;
          if (!isValidDealForStore(d.dealUrl, storeId)) return false;
          return true;
        });

      console.log(`Loaded ${dealsData.length} valid deals`);
      dealsData.forEach(d => {
        console.log(`DEAL: "${d.title}" → URL: ${d.dealUrl}`);
      });

      setAllDeals(dealsData);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const getStoreDealCount = (storeId: string): number => {
    return allDeals.filter(d => getStoreId(d.storeName) === storeId).length;
  };

  const getStoreDeals = (storeId: string): Deal[] => {
    return allDeals.filter(d => getStoreId(d.storeName) === storeId);
  };

  const handleStoreSelect = (store: MapStore) => {
    setSelectedStore(store);
    const deals = getStoreDeals(store.id);
    setStoreDeal(deals);
  };

  const handleGetDirections = async (store: MapStore) => {
    const url = `https://maps.apple.com/?daddr=${store.latitude},${store.longitude}`;
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
          latitude: 41.8781,
          longitude: -87.6298,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {MAP_STORES.map(store => {
          const dealCount = getStoreDealCount(store.id);
          return dealCount > 0 ? (
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
          ) : null;
        })}
      </MapView>

      {selectedStore && (
        <View style={{ flex: 0.5, backgroundColor: bgColor, borderTopWidth: 2, borderTopColor: '#FF7A00' }}>
          <ScrollView style={{ padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <View>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18 }}>
                  {selectedStore.storeName}
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
                  {storeDeal.length} Deals
                </Text>
                {storeDeal.map(deal => (
                  <TouchableOpacity
                    key={deal.id}
                    onPress={() => {
                      if (deal.dealUrl) Linking.openURL(deal.dealUrl);
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

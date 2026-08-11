import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { db } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

interface Deal {
  id: string;
  title: string;
  store: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
}

const STORE_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  'Walmart': { lat: 41.8781, lng: -87.6298 },
  'Target': { lat: 41.8820, lng: -87.6295 },
  'Best Buy': { lat: 41.8850, lng: -87.6200 },
  'CVS': { lat: 41.8750, lng: -87.6350 },
  'Walgreens': { lat: 41.8900, lng: -87.6400 },
  'Home Depot': { lat: 41.8700, lng: -87.6100 },
  'Costco': { lat: 41.8600, lng: -87.6500 },
  'Nike': { lat: 41.8880, lng: -87.6180 },
  'Lowes': { lat: 41.8550, lng: -87.5950 },
  'Walmart Supercenter': { lat: 41.8781, lng: -87.6298 },
};

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const [liveSnaps, instoreSnaps] = await Promise.all([
        db.collection('deals_live').limit(300).get(),
        db.collection('deals_instore').limit(300).get(),
      ]);

      const dealsData: Deal[] = [...liveSnaps.docs, ...instoreSnaps.docs]
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            store: data.store || '',
            price: data.price || 0,
            originalPrice: data.originalPrice || 0,
            discountPercent: data.discountPercent || 0,
          };
        })
        .filter(d => d.price > 0 && !d.store?.toLowerCase?.().includes('amazon') && ((d.originalPrice - d.price) / d.originalPrice) * 100 >= 40);

      setDeals(dealsData);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const storeLocations = Array.from(new Set(deals.map(d => d.store)))
    .map(store => ({
      store,
      count: deals.filter(d => d.store === store).length,
      ...STORE_COORDINATES[store] || { lat: 41.8781, lng: -87.6298 },
    }));

  const bgColor = darkMode ? '#000' : '#fff';

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
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 41.8781,
          longitude: -87.6298,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {storeLocations.map((loc) => (
          <Marker
            key={loc.store}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            title={loc.store}
            description={`${loc.count} deals`}
          >
            <View style={{
              backgroundColor: '#FF7A00',
              borderRadius: 50,
              padding: 10,
              alignItems: 'center',
              justifyContent: 'center',
              width: 55,
              height: 55,
              borderWidth: 2,
              borderColor: '#fff',
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>
                {loc.count}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={{ position: 'absolute', top: 50, left: 15, right: 15, backgroundColor: '#4CAF50', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
          🏪 {storeLocations.length} Stores • 💰 {deals.length} Deals
        </Text>
      </View>
    </View>
  );
}

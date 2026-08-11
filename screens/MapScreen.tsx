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

// Real store locations in Chicago (searched from Google Maps)
const REAL_STORE_COORDS: { [key: string]: { lat: number; lng: number } } = {
  'Walmart': [
    { lat: 41.7378, lng: -87.5527 }, // Walmart Marquette Park
    { lat: 41.8082, lng: -87.6154 }, // Walmart Loop
  ],
  'Target': [
    { lat: 41.8847, lng: -87.6191 }, // Target downtown
    { lat: 41.7945, lng: -87.6230 }, // Target south loop
  ],
  'Best Buy': [
    { lat: 41.8906, lng: -87.6188 }, // Best Buy Loop
    { lat: 41.8733, lng: -87.6183 }, // Best Buy downtown
  ],
  'CVS': [
    { lat: 41.8781, lng: -87.6298 }, // CVS downtown
    { lat: 41.8850, lng: -87.6200 }, // CVS north
  ],
  'Walgreens': [
    { lat: 41.8850, lng: -87.6300 }, // Walgreens downtown
  ],
  'Home Depot': [
    { lat: 41.7435, lng: -87.5640 }, // Home Depot Marquette
  ],
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

  const getStoreMarkers = () => {
    const markers: any[] = [];
    const countMap = new Map<string, number>();

    deals.forEach(deal => {
      countMap.set(deal.store, (countMap.get(deal.store) || 0) + 1);
    });

    countMap.forEach((count, store) => {
      const coords = REAL_STORE_COORDS[store];
      if (coords) {
        if (Array.isArray(coords)) {
          coords.forEach((coord, idx) => {
            markers.push({
              key: `${store}-${idx}`,
              store,
              count,
              lat: coord.lat,
              lng: coord.lng,
            });
          });
        }
      }
    });

    return markers;
  };

  const bgColor = darkMode ? '#000' : '#fff';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bgColor }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  const markers = getStoreMarkers();

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 41.8781,
          longitude: -87.6298,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.key}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.store}
            description={`${marker.count} deals`}
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
                {marker.count}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={{ position: 'absolute', top: 50, left: 15, right: 15, backgroundColor: '#4CAF50', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
          🏪 {Array.from(new Set(deals.map(d => d.store))).length} Stores • 💰 {deals.length} Deals
        </Text>
      </View>
    </View>
  );
}

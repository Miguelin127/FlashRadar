import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
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

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [location, setLocation] = useState({ latitude: 41.8781, longitude: -87.6298 });
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

  // Group deals by store
  const storeLocations = Array.from(new Set(deals.map(d => d.store)))
    .map(store => ({
      store,
      count: deals.filter(d => d.store === store).length,
      lat: 41.8781 + Math.random() * 0.05,
      lng: -87.6298 + Math.random() * 0.05,
    }));

  const bgColor = darkMode ? '#000' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';

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
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
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
              padding: 8, 
              alignItems: 'center',
              justifyContent: 'center',
              width: 50,
              height: 50,
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
                {loc.count}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Info Overlay */}
      <View style={{ position: 'absolute', top: 50, left: 15, right: 15, backgroundColor: '#4CAF50', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
          🏪 {storeLocations.length} Stores • 💰 {deals.length} Deals
        </Text>
      </View>
    </View>
  );
}

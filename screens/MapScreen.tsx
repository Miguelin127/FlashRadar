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

interface StoreLocation {
  store: string;
  count: number;
  lat: number;
  lng: number;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyCKn73y--LsPxw5vJBknf8VURDWiO84ZME';
const CHICAGO_LAT = 41.8781;
const CHICAGO_LNG = -87.6298;

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, []);

  const geocodeStore = async (storeName: string): Promise<{ lat: number; lng: number }> => {
    try {
      const query = `${storeName} Chicago Illinois`;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      }
    } catch (error) {
      console.warn(`Geocoding failed for ${storeName}:`, error);
    }
    
    // Fallback to Chicago center
    return { lat: CHICAGO_LAT, lng: CHICAGO_LNG };
  };

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

      // Geocode all unique stores
      const uniqueStores = Array.from(new Set(dealsData.map(d => d.store)));
      const locations: StoreLocation[] = [];

      for (const store of uniqueStores) {
        const coords = await geocodeStore(store);
        locations.push({
          store,
          count: dealsData.filter(d => d.store === store).length,
          lat: coords.lat,
          lng: coords.lng,
        });
      }

      setStoreLocations(locations.sort((a, b) => b.count - a.count));
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

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
          latitude: CHICAGO_LAT,
          longitude: CHICAGO_LNG,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
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
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 3,
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

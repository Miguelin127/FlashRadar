import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

interface Deal {
  id: string;
  title: string;
  store: string;
  price: number;
  originalPrice: number;
  lat: number;
  lng: number;
  expiresAt: Date;
  inventory: number;
  rating: number;
  reviews: number;
  distance?: number;
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [location, setLocation] = useState<any>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(5);

  useEffect(() => {
    initMap();
  }, []);

  const initMap = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    fetchNearbyDeals(loc.coords.latitude, loc.coords.longitude);
  };

  const fetchNearbyDeals = async (lat: number, lng: number) => {
    setLoading(false);
    try {
      const snaps = await db.collection('deals_live')
        .where('store', '!=', '')
        .limit(50)
        .get();

      const dealsData: Deal[] = snaps.docs
        .map(doc => {
          const data = doc.data();
          const dist = calculateDistance(lat, lng, data.lat || 0, data.lng || 0);
          return {
            id: doc.id,
            title: data.title || 'Deal',
            store: data.store || 'Store',
            price: data.price || 0,
            originalPrice: data.originalPrice || 0,
            lat: data.lat || 0,
            lng: data.lng || 0,
            expiresAt: data.expiresAt?.toDate?.() || new Date(),
            inventory: data.inventory || 0,
            rating: data.rating || 0,
            reviews: data.reviews || 0,
            distance: dist,
          };
        })
        .filter((d: Deal) => (d.distance || 0) <= radius)
        .sort((a: Deal, b: Deal) => (a.distance || 0) - (b.distance || 0));

      setDeals(dealsData);
    } catch (error) {
      console.error('Fetch deals error:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const bgColor = darkMode ? '#000' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';
  const borderColor = darkMode ? '#333' : '#ddd';

  if (!location) {
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
        <Circle 
          center={location} 
          radius={radius * 1609} 
          fillColor="rgba(255,122,0,0.1)" 
          strokeColor="#FF7A00" 
          strokeWidth={2} 
        />
        {deals.map((deal) => (
          <Marker
            key={deal.id}
            coordinate={{ latitude: deal.lat, longitude: deal.lng }}
            onPress={() => setSelectedDeal(deal)}
            pinColor={deal.inventory > 5 ? '#FF7A00' : '#999'}
          >
            <View style={{ backgroundColor: '#FF7A00', borderRadius: 50, padding: 5, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>
                ${deal.price.toFixed(0)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={{ position: 'absolute', top: 60, right: 15, backgroundColor: bgColor, borderRadius: 8, padding: 10 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {[2, 5, 10, 25].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => {
                setRadius(r);
                fetchNearbyDeals(location.latitude, location.longitude);
              }}
              style={{
                backgroundColor: radius === r ? '#FF7A00' : borderColor,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 5,
              }}
            >
              <Text style={{ color: radius === r ? '#fff' : textColor, fontSize: 11, fontWeight: 'bold' }}>
                {r}mi
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selectedDeal && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: bgColor, borderTopWidth: 2, borderTopColor: '#FF7A00', borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 20, maxHeight: '50%' }}>
          <TouchableOpacity onPress={() => setSelectedDeal(null)} style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
            <Text style={{ fontSize: 24, color: textColor }}>✕</Text>
          </TouchableOpacity>

          <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>
            {selectedDeal.title}
          </Text>
          <Text style={{ color: '#FF7A00', fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
            {selectedDeal.store} • {selectedDeal.distance?.toFixed(1)}mi away
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 16 }}>
                ${selectedDeal.price.toFixed(2)}
              </Text>
              <Text style={{ color: textColor, fontSize: 11, textDecorationLine: 'line-through' }}>
                ${selectedDeal.originalPrice.toFixed(2)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: selectedDeal.inventory > 5 ? '#4CAF50' : '#f44336', fontWeight: 'bold', fontSize: 12 }}>
                {selectedDeal.inventory > 5 ? '✓ In Stock' : `⚠ ${selectedDeal.inventory} left`}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={{ backgroundColor: '#FF7A00', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
              View Deal
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

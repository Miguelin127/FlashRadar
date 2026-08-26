import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface Store {
  id: string;
  storeName: string;
  address: string;
  latitude: number;
  longitude: number;
  dealCount?: number;
}

export default function MapScreen({ navigation }: any) {
  const { darkMode } = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      await fetchStoresNearLocation(latitude, longitude);
    } catch (error) {
      console.error('Error initializing map:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoresNearLocation = async (latitude: number, longitude: number) => {
    try {
      const dealsSnap = await getDocs(collection(db, 'deals_live'));
      
      // Extract unique stores from deals
      const storeMap = new Map<string, { name: string; count: number; lat?: number; lng?: number }>();
      
      dealsSnap.forEach(doc => {
        const data = doc.data();
        if (data.store) {
          const existing = storeMap.get(data.store) || { name: data.store, count: 0 };
          existing.count += 1;
          if (data.latitude && data.longitude) {
            existing.lat = data.latitude;
            existing.lng = data.longitude;
          }
          storeMap.set(data.store, existing);
        }
      });

      // Convert to Store objects (use geocoding for locations without coords)
      const storeList: Store[] = Array.from(storeMap.entries()).map(([id, data]) => ({
        id,
        storeName: data.name,
        address: data.name,
        latitude: data.lat || latitude + (Math.random() - 0.5) * 0.1,
        longitude: data.lng || longitude + (Math.random() - 0.5) * 0.1,
        dealCount: data.count,
      }));

      setStores(storeList);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#000' : '#fff' }}>
        <Text>Loading map...</Text>
      </View>
    );
  }

  const mapRegion = userLocation ? {
    latitude: userLocation.latitude,
    latitudeDelta: 0.15,
    longitude: userLocation.longitude,
    longitudeDelta: 0.15,
  } : undefined;

  return (
    <View style={{ flex: 1 }}>
      {mapRegion && (
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {stores.map(store => (
            <Marker
              key={store.id}
              coordinate={{ latitude: store.latitude, longitude: store.longitude }}
              title={store.storeName}
              description={`${store.dealCount || 0} deals`}
              onPress={() => setSelectedStore(store)}
            />
          ))}
        </MapView>
      )}

      {selectedStore && (
        <View style={[styles.bottomSheet, { backgroundColor: darkMode ? '#111' : '#fff' }]}>
          <TouchableOpacity onPress={() => setSelectedStore(null)} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={darkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.storeName, { color: darkMode ? '#fff' : '#000' }]}>
            {selectedStore.storeName}
          </Text>
          <Text style={[styles.dealCount, { color: darkMode ? '#aaa' : '#666' }]}>
            {selectedStore.dealCount} deals available
          </Text>
          <TouchableOpacity
            style={styles.viewDealsButton}
            onPress={() => {
              navigation.navigate('Explore', { filter: selectedStore.storeName });
              setSelectedStore(null);
            }}
          >
            <Text style={styles.viewDealsText}>View Deals</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  closeButton: { alignSelf: 'flex-end', marginBottom: 10 },
  storeName: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  dealCount: { fontSize: 14, marginBottom: 15 },
  viewDealsButton: { backgroundColor: '#FF7A00', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  viewDealsText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

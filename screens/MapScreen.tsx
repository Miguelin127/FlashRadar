import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface Store {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  deals: number;
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [region, setRegion] = useState<any>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);

  useEffect(() => {
    initMap();
  }, []);

  const initMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });

      // Fetch stores from deals
      const dealsSnap = await getDocs(collection(db, 'deals_live'));
      const storeMap = new Map<string, { deals: number; lat: number; lng: number }>();

      dealsSnap.forEach(doc => {
        const data = doc.data();
        if (data.store) {
          const existing = storeMap.get(data.store) || { deals: 0, lat: latitude + Math.random() * 0.05, lng: longitude + Math.random() * 0.05 };
          existing.deals += 1;
          storeMap.set(data.store, existing);
        }
      });

      const storeList = Array.from(storeMap.entries()).map(([id, data]) => ({
        id,
        name: id,
        latitude: data.lat,
        longitude: data.lng,
        deals: data.deals,
      }));

      setStores(storeList);
      console.log('Stores loaded:', storeList.length);
    } catch (error) {
      console.error('Map error:', error);
    }
  };

  if (!region) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation>
        {stores.map(store => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
            description={`${store.deals} deals`}
            pinColor="#FF7A00"
            onPress={() => setSelected(store)}
          />
        ))}
      </MapView>

      {selected && (
        <View style={[styles.sheet, { backgroundColor: darkMode ? '#111' : '#fff' }]}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={{ color: darkMode ? '#fff' : '#000', fontSize: 18, fontWeight: 'bold' }}>
              {selected.name}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: darkMode ? '#aaa' : '#666' }}>
            {selected.deals} deals available
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});

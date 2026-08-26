import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

const STORE_LOCATIONS: { [key: string]: { lat: number; lng: number } } = {
  'walmart': { lat: 41.8950, lng: -87.6500 },
  'target': { lat: 41.8847, lng: -87.6191 },
  'best buy': { lat: 41.8906, lng: -87.6188 },
  'cvs': { lat: 41.8781, lng: -87.6298 },
  'home depot': { lat: 41.7435, lng: -87.5640 },
  'sephora': { lat: 41.8839, lng: -87.6278 },
  'walgreens': { lat: 41.8800, lng: -87.6300 },
  'lowes': { lat: 41.7500, lng: -87.5500 },
};

const PHYSICAL_STORES = Object.keys(STORE_LOCATIONS);

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

      const dealsSnap = await getDocs(collection(db, 'deals_live'));
      const storeMap = new Map<string, number>();

      dealsSnap.forEach(doc => {
        const data = doc.data();
        if (!data.store) return;

        const isPhysical = PHYSICAL_STORES.some(s => data.store.toLowerCase().includes(s));
        if (!isPhysical) return;

        storeMap.set(data.store, (storeMap.get(data.store) || 0) + 1);
      });

      const storeList = Array.from(storeMap.entries())
        .filter(([name]) => STORE_LOCATIONS[name.toLowerCase()])
        .map(([name, deals]) => {
          const coords = STORE_LOCATIONS[name.toLowerCase()];
          return {
            id: name,
            name,
            latitude: coords.lat,
            longitude: coords.lng,
            deals,
          };
        });

      setStores(storeList);
      console.log('Physical stores loaded:', storeList.length);
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

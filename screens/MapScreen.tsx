import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Linking, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const GOOGLE_API_KEY = 'AIzaSyBeldwLWhSlf0bYzJHBmtce4R1XoEnXBXc';
const STORE_TYPES = ['Target', 'Walmart', 'Best Buy', 'CVS', 'Home Depot', 'Walgreens', 'Sephora'];

interface PhysicalStore {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [region, setRegion] = useState<any>(null);
  const [stores, setStores] = useState<PhysicalStore[]>([]);
  const [selected, setSelected] = useState<PhysicalStore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initMap();
  }, []);

  const fetchStoresNearLocation = async (latitude: number, longitude: number) => {
    try {
      const allStores: PhysicalStore[] = [];

      for (const storeType of STORE_TYPES) {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress',
          },
          body: JSON.stringify({
            textQuery: storeType,
            maxResultCount: 5,
            locationBias: {
              circle: {
                center: { latitude, longitude },
                radius: 20000.0,
              },
            },
          }),
        });

        const data = await res.json();
        if (data.places) {
          data.places.forEach((place: any) => {
            allStores.push({
              id: place.id,
              name: place.displayName?.text || storeType,
              address: place.formattedAddress || '',
              latitude: place.location?.latitude || 0,
              longitude: place.location?.longitude || 0,
            });
          });
        }
      }

      setStores(allStores);
      console.log('Real stores loaded:', allStores.length);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const initMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });

      await fetchStoresNearLocation(latitude, longitude);
    } catch (error) {
      console.error('Map error:', error);
      setLoading(false);
    }
  };

  const openDirections = (store: PhysicalStore) => {
    const url = `https://maps.apple.com/?address=${encodeURIComponent(store.address)}&ll=${store.latitude},${store.longitude}`;
    Linking.openURL(url).catch(() => {
      const androidUrl = `geo:${store.latitude},${store.longitude}?q=${encodeURIComponent(store.address)}`;
      Linking.openURL(androidUrl);
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={{ color: darkMode ? '#fff' : '#000', marginTop: 12 }}>Loading stores...</Text>
      </View>
    );
  }

  if (!region) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation>
        {stores.map(store => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
            pinColor="#FF7A00"
            onPress={() => setSelected(store)}
          />
        ))}
      </MapView>

      {selected && (
        <View style={[styles.sheet, { backgroundColor: darkMode ? '#111' : '#fff' }]}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={darkMode ? '#fff' : '#000'} />
          </TouchableOpacity>

          <Text style={[styles.name, { color: darkMode ? '#fff' : '#000' }]}>
            {selected.name}
          </Text>
          <Text style={[styles.address, { color: darkMode ? '#aaa' : '#666' }]}>
            {selected.address}
          </Text>

          <TouchableOpacity style={styles.directionBtn} onPress={() => openDirections(selected)}>
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.directionText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  address: { fontSize: 14, marginBottom: 16 },
  directionBtn: { flexDirection: 'row', backgroundColor: '#FF7A00', paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 8 },
  directionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

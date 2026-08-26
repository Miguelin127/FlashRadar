import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface Deal {
  id: string;
  title: string;
  store: string;
  price: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  discountPercent?: number;
  imageUrl?: string;
}

interface PhysicalStore {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  retailer: string;
  dealCount: number;
  deals: Deal[];
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [region, setRegion] = useState<any>(null);
  const [stores, setStores] = useState<PhysicalStore[]>([]);
  const [selected, setSelected] = useState<PhysicalStore | null>(null);

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

      // Fetch REAL deal locations from Firestore
      const dealsSnap = await getDocs(collection(db, 'deals_live'));
      const storeMap = new Map<string, PhysicalStore>();

      dealsSnap.forEach(doc => {
        const data = doc.data() as Deal;
        
        // Only use deals with real physical addresses and coordinates
        if (!data.address || data.latitude === undefined || data.longitude === undefined) {
          console.log('Skipping deal - missing address or coordinates:', data.title);
          return;
        }

        // Validate coordinates are reasonable
        if (data.latitude === 0 || data.longitude === 0) {
          console.log('Skipping store - invalid coordinates (0,0):', data.address);
          return;
        }

        const key = `${data.latitude},${data.longitude}`;
        const existing = storeMap.get(key);

        if (existing) {
          existing.dealCount += 1;
          existing.deals.push(data);
        } else {
          storeMap.set(key, {
            id: key,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            retailer: data.store,
            dealCount: 1,
            deals: [data],
          });
        }
      });

      const storeList = Array.from(storeMap.values());
      setStores(storeList);
      console.log('Physical stores loaded:', storeList.length);
    } catch (error) {
      console.error('Map error:', error);
    }
  };

  const openDirections = (store: PhysicalStore) => {
    const url = `https://maps.apple.com/?address=${encodeURIComponent(store.address)}&ll=${store.latitude},${store.longitude}`;
    Linking.openURL(url).catch(() => {
      const androidUrl = `geo:${store.latitude},${store.longitude}?q=${encodeURIComponent(store.address)}`;
      Linking.openURL(androidUrl);
    });
  };

  if (!region) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation>
        {stores.map(store => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.retailer}
            description={`${store.dealCount} deals`}
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

          <Text style={[styles.retailer, { color: darkMode ? '#fff' : '#000' }]}>
            {selected.retailer}
          </Text>
          <Text style={[styles.address, { color: darkMode ? '#aaa' : '#666' }]}>
            {selected.address}
          </Text>

          <Text style={[styles.dealsHeader, { color: darkMode ? '#fff' : '#000' }]}>
            🔥 {selected.dealCount} FlashRadar Deals
          </Text>

          <FlatList
            data={selected.deals.slice(0, 3)}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.dealItem, { borderBottomColor: darkMode ? '#333' : '#eee' }]}>
                <Text style={[styles.dealTitle, { color: darkMode ? '#fff' : '#000' }]}>
                  {item.title}
                </Text>
                <View style={styles.dealRow}>
                  <Text style={[styles.price, { color: '#FF7A00' }]}>
                    ${item.price}
                  </Text>
                  {item.discountPercent && (
                    <Text style={[styles.discount, { color: '#22c55e' }]}>
                      {item.discountPercent}% OFF
                    </Text>
                  )}
                </View>
              </View>
            )}
          />

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
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  retailer: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  address: { fontSize: 13, marginBottom: 12 },
  dealsHeader: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  dealItem: { paddingVertical: 10, borderBottomWidth: 1 },
  dealTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  dealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 14, fontWeight: 'bold' },
  discount: { fontSize: 11, fontWeight: '700' },
  directionBtn: { flexDirection: 'row', backgroundColor: '#FF7A00', paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 8 },
  directionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

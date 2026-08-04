import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Image, Linking } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
// @ts-ignore
import ClusteredMarker from 'react-native-maps-clustering';
import * as Location from 'expo-location';
import { db } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

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
  storeHours?: string;
  url?: string;
  productUrl?: string;
  image?: string;
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [location, setLocation] = useState<any>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showStoreList, setShowStoreList] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  useEffect(() => {
    initMap();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [deals, searchQuery, filterStore, radius]);

  const initMap = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    fetchNearbyDeals(loc.coords.latitude, loc.coords.longitude);
  };

  const fetchNearbyDeals = async (lat: number, lng: number) => {
    try {
      const snaps = await db.collection('deals_live')
        .where('lat', '!=', null)
        .limit(100)
        .get();

      const dealsData: Deal[] = snaps.docs
        .map(doc => {
          const data = doc.data();
          if (!data.lat) return null;
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
            storeHours: data.storeHours || '9AM-9PM',
            url: data.url || '',
            productUrl: data.productUrl || '',
            image: data.image || '',
          };
        })
        .filter((d: any) => d !== null)
        .sort((a: any, b: any) => {
          if (!a || !b) return 0;
          return (a.distance || 0) - (b.distance || 0);
        })
        .filter((d: any) => d !== null) as Deal[];

      setDeals(dealsData);
      setLoading(false);
    } catch (error) {
      console.error('Fetch deals error:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = deals.filter((d: Deal) => (d.distance || 0) <= radius);

    if (searchQuery) {
      filtered = filtered.filter((d: Deal) =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStore) {
      filtered = filtered.filter((d: Deal) =>
        d.store.toLowerCase().includes(filterStore.toLowerCase())
      );
    }

    setFilteredDeals(filtered);
  };

  const storeList = Array.from(new Set(filteredDeals.map(d => d.store))).map(store => ({
    name: store,
    count: filteredDeals.filter(d => d.store === store).length
  })).sort((a, b) => b.count - a.count);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const getMarkerColor = (deal: Deal) => {
    if (showHeatmap) {
      const discountPercent = ((deal.originalPrice - deal.price) / deal.originalPrice) * 100;
      if (discountPercent > 50) return '#FF0000'; // Red - hot deals
      if (discountPercent > 30) return '#FF7A00'; // Orange
      if (discountPercent > 10) return '#FFD700'; // Gold
      return '#90EE90'; // Green - mild deals
    }
    return deal.inventory > 5 ? '#FF7A00' : '#999';
  };

  const bgColor = darkMode ? '#000' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';
  const cardBg = darkMode ? '#1a1a1a' : '#f5f5f5';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bgColor }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  if (!location) return null;

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Map */}
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
        
        {(selectedStore ? filteredDeals.filter(d => d.store === selectedStore) : filteredDeals).map((deal) => (
          <Marker
            key={deal.id}
            coordinate={{ latitude: deal.lat, longitude: deal.lng }}
            onPress={() => setSelectedDeal(deal)}
            pinColor={getMarkerColor(deal)}
          >
            <View style={{ backgroundColor: getMarkerColor(deal), borderRadius: 50, padding: 5, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>
                ${deal.price.toFixed(0)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Controls Overlay */}
      <View style={{ position: 'absolute', top: 60, left: 15, right: 15 }}>
        {/* Search */}
        <TextInput
          placeholder="Search deals..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: bgColor,
            borderColor: '#ddd',
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            color: textColor,
            marginBottom: 10,
          }}
          placeholderTextColor={textColor}
        />

        {/* Store Filter */}
        <TextInput
          placeholder="Filter by store..."
          value={filterStore}
          onChangeText={setFilterStore}
          style={{
            backgroundColor: bgColor,
            borderColor: '#ddd',
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            color: textColor,
            marginBottom: 10,
          }}
          placeholderTextColor={textColor}
        />

        {/* Radius & Options */}
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 10 }}>
          {[2, 5, 10, 25].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRadius(r)}
              style={{
                backgroundColor: radius === r ? '#FF7A00' : '#ddd',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 5,
              }}
            >
              <Text style={{ color: radius === r ? '#fff' : '#000', fontSize: 11, fontWeight: 'bold' }}>
                {r}mi
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search This Area Button */}
        <TouchableOpacity
          onPress={() => setShowStoreList(!showStoreList)}
          style={{
            backgroundColor: '#4CAF50',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 5,
            marginBottom: 5,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
            🔍 ${storeList.length} Stores • ${filteredDeals.length} Deals
          </Text>
        </TouchableOpacity>

        {/* Heatmap Toggle */}
        <TouchableOpacity
          onPress={() => setShowHeatmap(!showHeatmap)}
          style={{
            backgroundColor: showHeatmap ? '#FF7A00' : '#ddd',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 5,
          }}
        >
          <Text style={{ color: showHeatmap ? '#fff' : '#000', fontWeight: 'bold', fontSize: 12 }}>
            🔥 Heatmap {showHeatmap ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Store List */}
      {showStoreList && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: bgColor, borderTopWidth: 2, borderTopColor: '#FF7A00', borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 15, maxHeight: '60%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>
              Stores ({storeList.length})
            </Text>
            <TouchableOpacity onPress={() => setShowStoreList(false)}>
              <Text style={{ fontSize: 24, color: textColor }}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView>
            {storeList.map((store, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setSelectedStore(store.name);
                  setShowStoreList(false);
                  setSelectedDeal(null);
                }}
                style={{
                  backgroundColor: selectedStore === store.name ? '#FF7A00' : cardBg,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: selectedStore === store.name ? '#fff' : textColor, fontWeight: 'bold' }}>
                  {store.name}
                </Text>
                <Text style={{ color: selectedStore === store.name ? '#fff' : textColor, fontSize: 12, backgroundColor: selectedStore === store.name ? 'rgba(0,0,0,0.2)' : '#ddd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                  {store.count} deals
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Deal Details Bottom Sheet */}
      {selectedDeal && !showStoreList && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: bgColor, borderTopWidth: 2, borderTopColor: '#FF7A00', borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 20, maxHeight: '60%' }}>
          <TouchableOpacity onPress={() => setSelectedDeal(null)} style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
            <Text style={{ fontSize: 24, color: textColor }}>✕</Text>
          </TouchableOpacity>

          {selectedDeal.image && (
            <Image 
              source={{ uri: selectedDeal.image }}
              style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 15 }}
            />
          )}

          <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>
            {selectedDeal.title}
          </Text>
          <Text style={{ color: '#FF7A00', fontSize: 14, fontWeight: 'bold', marginBottom: 5 }}>
            {selectedDeal.store} • {selectedDeal.distance?.toFixed(1)}mi
          </Text>

          {/* Store Hours */}
          <Text style={{ color: textColor, fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
            Hours: {selectedDeal.storeHours}
          </Text>

          {/* Pricing */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 16 }}>
                ${selectedDeal.price.toFixed(2)}
              </Text>
              <Text style={{ color: textColor, fontSize: 11, textDecorationLine: 'line-through' }}>
                ${selectedDeal.originalPrice.toFixed(2)}
              </Text>
            </View>

            {/* Inventory */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: selectedDeal.inventory > 5 ? '#4CAF50' : '#f44336', fontWeight: 'bold', fontSize: 12 }}>
                {selectedDeal.inventory > 5 ? '✓ In Stock' : `⚠ ${selectedDeal.inventory} left`}
              </Text>
            </View>
          </View>

          {/* Rating */}
          <Text style={{ color: textColor, fontSize: 12, marginBottom: 10 }}>
            ⭐ {selectedDeal.rating.toFixed(1)} ({selectedDeal.reviews} reviews)
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: '#FF7A00', padding: 12, borderRadius: 8 }}
              onPress={async () => {
                const url = selectedDeal.productUrl;
                if (!url) {
                  Alert.alert('No Product URL', 'This deal does not have a direct link yet');
                  return;
                }
                
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                  Linking.openURL(url);
                } else {
                  Alert.alert('Error', 'Cannot open URL');
                }
              }}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                🛒 Get Deal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: '#2196F3', padding: 12, borderRadius: 8 }}
              onPress={() => {
                const url = `https://maps.apple.com/?q=${selectedDeal.lat},${selectedDeal.lng}`;
                require('react-native').Linking.openURL(url);
              }}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                🗺️ Drive
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Image, Linking, Alert } from 'react-native';
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
  url?: string;
  affiliateUrl?: string;
  merchantUrl?: string;
  image?: string;
  distance?: number;
}

export default function MapScreen() {
  const { darkMode } = useTheme();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDeals();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [deals, searchQuery, radius, selectedStore]);

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
            url: data.url || '',
            affiliateUrl: data.affiliateUrl || '',
            merchantUrl: data.merchantUrl || '',
            image: data.image || '',
          };
        })
        .filter(d => d.price > 0 && ((d.originalPrice - d.price) / d.originalPrice) * 100 >= 40);

      setDeals(dealsData);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = deals
      .filter(d => !d.store?.toLowerCase?.().includes('amazon'))
      .filter(d => {
        if (!selectedStore) return true;
        return d.store === selectedStore;
      });

    if (searchQuery) {
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredDeals(filtered);
  };

  const storeList = Array.from(new Set(deals.map(d => d.store)))
    .map(store => ({
      name: store,
      count: deals.filter(d => d.store === store).length
    }))
    .sort((a, b) => b.count - a.count);

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

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView style={{ flex: 1, padding: 15 }}>
        {/* Stats */}
        <View style={{ backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, marginBottom: 15 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
            🏪 {storeList.length} Stores • 💰 {deals.length} Deals
          </Text>
        </View>

        {/* Search */}
        <TextInput
          placeholder="Search deals..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: cardBg,
            borderColor: '#ddd',
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: textColor,
            marginBottom: 12,
          }}
          placeholderTextColor={textColor}
        />

        {/* Radius Filter */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15 }}>
          {[2, 5, 10, 25].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRadius(r)}
              style={{
                flex: 1,
                backgroundColor: radius === r ? '#FF7A00' : cardBg,
                paddingVertical: 8,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#ddd',
              }}
            >
              <Text style={{ color: radius === r ? '#fff' : textColor, fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                {r}mi
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stores List */}
        {storeList.map((store) => (
          <TouchableOpacity
            key={store.name}
            onPress={() => setSelectedStore(selectedStore === store.name ? null : store.name)}
            style={{
              backgroundColor: selectedStore === store.name ? '#FF7A00' : cardBg,
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: selectedStore === store.name ? '#FF7A00' : '#ddd',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: selectedStore === store.name ? '#fff' : textColor, fontWeight: 'bold', fontSize: 16 }}>
                {store.name}
              </Text>
              <Text style={{ color: selectedStore === store.name ? '#fff' : '#666', fontWeight: 'bold', fontSize: 14 }}>
                {store.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Deals List */}
        {selectedStore && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
              Deals at {selectedStore}
            </Text>
            {filteredDeals.map((deal) => (
              <View key={deal.id} style={{ backgroundColor: cardBg, borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' }}>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14, marginBottom: 4 }} numberOfLines={2}>
                  {deal.title}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View>
                    <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 16 }}>
                      ${deal.price.toFixed(2)}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 11, textDecorationLine: 'line-through' }}>
                      ${deal.originalPrice.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ color: '#fff', backgroundColor: '#FF7A00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: 'bold', fontSize: 12 }}>
                    {deal.discountPercent}% OFF
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#FF7A00', paddingVertical: 8, borderRadius: 6 }}
                    onPress={() => {
                      const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
                      if (url) Linking.openURL(url);
                    }}
                  >
                    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>View Deal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#2196F3', paddingVertical: 8, borderRadius: 6 }}
                    onPress={() => {
                      const msg = `${deal.title}\n$${deal.price} (${deal.discountPercent}% OFF)\n${deal.affiliateUrl || deal.url}`;
                      require('react-native').Share.share({ message: msg });
                    }}
                  >
                    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

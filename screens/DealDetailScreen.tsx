import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function DealDetailScreen() {
  const { darkMode } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const deal = route.params?.deal;

  if (!deal) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#000' : '#fff' }}>
        <Text style={{ color: darkMode ? '#fff' : '#000' }}>Deal not found</Text>
      </View>
    );
  }

  const bgColor = darkMode ? '#000' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';
  const cardBg = darkMode ? '#1a1a1a' : '#f5f5f5';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bgColor }}>
      <View style={{ padding: 15 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 15 }}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>

        {deal.imageUrl && (
          <Image
            source={{ uri: deal.imageUrl }}
            style={{ width: '100%', height: 300, borderRadius: 8, marginBottom: 16 }}
            resizeMode="cover"
          />
        )}

        <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
          {deal.title}
        </Text>

        <Text style={{ color: '#999', fontSize: 14, marginBottom: 16 }}>
          {deal.store}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 28 }}>
              ${deal.price?.toFixed(2) || 'See deal'}
            </Text>
            {deal.originalPrice && (
              <Text style={{ color: '#999', fontSize: 12, textDecorationLine: 'line-through' }}>
                ${deal.originalPrice.toFixed(2)}
              </Text>
            )}
          </View>
          {deal.discountPercent && (
            <View style={{ backgroundColor: '#FF7A00', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                {deal.discountPercent}% OFF
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={{ backgroundColor: '#FF7A00', padding: 14, borderRadius: 8, marginBottom: 10 }}
          onPress={() => {
            const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
            if (url) Linking.openURL(url);
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
            View Deal
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

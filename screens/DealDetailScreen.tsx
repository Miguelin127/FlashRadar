import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Linking, Share } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

export default function DealDetailScreen() {
  const { darkMode } = useTheme();
  const { language } = useLanguage();
  const route = useRoute();
  const navigation = useNavigation();
  const deal = route.params?.deal;
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    if (deal?.createdAt?.seconds) {
      const createdDate = new Date(deal.createdAt.seconds * 1000);
      const expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const today = new Date();
      const diff = Math.max(0, Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)));
      setDaysLeft(diff);
    }
  }, [deal]);

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

  const handleShare = () => {
    const encodedId = encodeURIComponent(deal.id);
    const deepLink = `https://flashradarapp.com/deal/${encodedId}`;
    const message = `🎉 ${deal.title}\n💰 $${deal.price?.toFixed(2)} (${deal.discountPercent}% OFF)\n🏪 ${deal.store}\n\n${deepLink}`;
    Share.share({ message, title: deal.title }).catch(console.error);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bgColor }}>
      <View style={{ backgroundColor: bgColor }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: cardBg }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={{ color: '#FF7A00', fontWeight: 'bold' }}>
            Listing expires in {daysLeft} days
          </Text>
          <TouchableOpacity onPress={handleShare}>
            <Ionicons name="share-social" size={24} color={textColor} />
          </TouchableOpacity>
        </View>

        {deal.imageUrl && (
          <Image
            source={{ uri: deal.imageUrl }}
            style={{ width: '100%', height: 280, backgroundColor: '#f5f5f5' }}
            resizeMode="contain"
          />
        )}

        <View style={{ padding: 15 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#999', fontSize: 12, marginBottom: 5 }}>
                {deal.store?.toUpperCase()}
              </Text>
              <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>
                {deal.title}
              </Text>
            </View>
            <View style={{ backgroundColor: '#FF7A00', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, marginLeft: 10 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                {deal.discountPercent}%
              </Text>
              <Text style={{ color: '#fff', fontSize: 10 }}>OFF</Text>
            </View>
          </View>

          <View style={{ backgroundColor: cardBg, padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 }}>
              <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 32 }}>
                ${deal.price?.toFixed(2)}
              </Text>
              {deal.originalPrice && (
                <Text style={{ color: '#999', fontSize: 14, marginLeft: 10, textDecorationLine: 'line-through' }}>
                  ${deal.originalPrice.toFixed(2)}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={{ backgroundColor: '#FF7A00', padding: 16, borderRadius: 8, marginBottom: 15 }}
            onPress={() => {
              const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
              if (url) Linking.openURL(url);
            }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
              VIEW DEAL
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

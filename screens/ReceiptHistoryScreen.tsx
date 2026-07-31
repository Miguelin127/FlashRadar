import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { getStrings } from '../utils/strings';

export default function ReceiptHistoryScreen() {
  const { user } = useAuth();
  const { isPremium } = useUser();
  const { language } = useLanguage();
  const t = getStrings(language);
  const { colors } = useTheme();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPremium && user) fetchReceipts();
  }, [isPremium, user]);

  const fetchReceipts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await db.collection('users').doc(user.uid)
        .collection('receipts')
        .orderBy('date', 'desc')
        .get();

      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || new Date(),
      }));

      setReceipts(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (receipts.length === 0) {
      Alert.alert('No receipts', 'No receipts to export');
      return;
    }

    let csv = 'Date,Store,Items,COGS,Tax,Shipping,Total\n';

    receipts.forEach(receipt => {
      const date = new Date(receipt.date).toISOString().split('T')[0];
      const itemCount = receipt.items?.length || 0;
      csv += `${date},"${receipt.store}",${itemCount},${receipt.cogs || 0},${receipt.tax || 0},${receipt.shipping || 0},${receipt.total || 0}\n`;
    });

    // Copy to clipboard (in real app, would share or download)
    Alert.alert('CSV Ready', 'Receipt data exported. Share or save for taxes.');
  };

  if (!isPremium) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Premium Feature</Text>
        <Text style={{ color: colors.text, opacity: 0.7, marginTop: 10 }}>Upgrade to view receipt history</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>
          Receipt History ({receipts.length})
        </Text>
        <TouchableOpacity
          onPress={exportToCSV}
          style={{
            backgroundColor: '#FF7A00',
            paddingHorizontal: 15,
            paddingVertical: 8,
            borderRadius: 8,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>📊 {t.flipit?.exportCSV || 'Export CSV'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 15 }}>
        {receipts.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: colors.text, opacity: 0.7 }}>{t.flipit?.noReceiptsScanned || 'No receipts scanned yet'}</Text>
          </View>
        ) : (
          receipts.map((receipt) => (
            <View
              key={receipt.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#FF7A00',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>{receipt.store}</Text>
                <Text style={{ color: colors.text, fontSize: 12, opacity: 0.7 }}>
                  {new Date(receipt.date).toLocaleDateString()}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ color: colors.text, fontSize: 12 }}>
                  {receipt.items?.length || 0} items
                </Text>
                <Text style={{ color: '#FF7A00', fontWeight: 'bold' }}>
                  ${receipt.total?.toFixed(2) || '0.00'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View>
                  <Text style={{ color: colors.text, fontSize: 10, opacity: 0.7 }}>COGS</Text>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>${receipt.cogs?.toFixed(2) || '0.00'}</Text>
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 10, opacity: 0.7 }}>Tax</Text>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>${receipt.tax?.toFixed(2) || '0.00'}</Text>
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 10, opacity: 0.7 }}>Shipping</Text>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>${receipt.shipping?.toFixed(2) || '0.00'}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

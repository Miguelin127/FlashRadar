import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getStrings } from '../utils/strings';

export default function TaxDashboardScreen() {
  const { isPremium } = useUser();
  const { darkMode } = useTheme();
  const { language } = useLanguage();
  const t = getStrings(language);
  const [taxReport, setTaxReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('month'); // month, quarter, year

  useEffect(() => {
    if (isPremium) fetchTaxReport();
  }, [period, isPremium]);

  const fetchTaxReport = async () => {
    if (!isPremium) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();

      if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(now.getMonth() - 3);
      } else {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      const fn = httpsCallable(functions, 'getTaxReport');
      const result = await fn({
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      });
      setTaxReport((result as any).data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#000' : '#fff' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? '#fff' : '#000' }}>
          Premium Feature
        </Text>
        <Text style={{ color: darkMode ? '#ccc' : '#666', marginTop: 10 }}>
          Upgrade to track your tax data
        </Text>
      </View>
    );
  }

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
    <ScrollView style={{ flex: 1, backgroundColor: bgColor, padding: 15 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: textColor, marginBottom: 20 }}>
        Tax Report
      </Text>

      {/* Period Selector */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {['month', 'quarter', 'year'].map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              backgroundColor: period === p ? '#FF7A00' : darkMode ? '#333' : '#ddd',
              paddingHorizontal: 15,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: period === p ? '#fff' : textColor,
                fontWeight: 'bold',
                textTransform: 'capitalize',
              }}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {taxReport ? (
        <>
          {/* Summary Cards */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {/* COGS */}
            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                padding: 15,
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#FF7A00',
              }}
            >
              <Text style={{ color: textColor, fontSize: 12, opacity: 0.7 }}>COGS</Text>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: 'bold', marginTop: 5 }}>
                ${taxReport.totalCOGS.toFixed(2)}
              </Text>
            </View>

            {/* Revenue */}
            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                padding: 15,
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#4CAF50',
              }}
            >
              <Text style={{ color: textColor, fontSize: 12, opacity: 0.7 }}>Revenue</Text>
              <Text style={{ color: '#4CAF50', fontSize: 20, fontWeight: 'bold', marginTop: 5 }}>
                ${taxReport.totalRevenue.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Profit & Margin */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {/* Profit */}
            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                padding: 15,
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#2196F3',
              }}
            >
              <Text style={{ color: textColor, fontSize: 12, opacity: 0.7 }}>Gross Profit</Text>
              <Text style={{ color: '#2196F3', fontSize: 20, fontWeight: 'bold', marginTop: 5 }}>
                ${taxReport.totalProfit.toFixed(2)}
              </Text>
            </View>

            {/* Margin */}
            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                padding: 15,
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#9C27B0',
              }}
            >
              <Text style={{ color: textColor, fontSize: 12, opacity: 0.7 }}>Profit Margin</Text>
              <Text style={{ color: '#9C27B0', fontSize: 20, fontWeight: 'bold', marginTop: 5 }}>
                {taxReport.profitMargin}%
              </Text>
            </View>
          </View>

          {/* Flips Sold */}
          <View
            style={{
              backgroundColor: cardBg,
              padding: 15,
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: textColor, fontSize: 12, opacity: 0.7 }}>Flips Sold</Text>
            <Text style={{ color: textColor, fontSize: 24, fontWeight: 'bold', marginTop: 5 }}>
              {taxReport.flipsSold}
            </Text>
            <Text style={{ color: textColor, fontSize: 12, opacity: 0.7, marginTop: 5 }}>
              Avg per flip: ${(taxReport.totalRevenue / (taxReport.flipsSold || 1)).toFixed(2)}
            </Text>
          </View>

          {/* Export */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FF7A00',
              padding: 15,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              📊 Export Report
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: textColor }}>No data for this period</Text>
        </View>
      )}
    </ScrollView>
  );
}

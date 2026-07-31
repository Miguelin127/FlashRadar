import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { getStrings } from '../utils/strings';

export default function ExpenseDashboardScreen() {
  const { isPremium } = useUser();
  const { language } = useLanguage();
  const t = getStrings(language);
  const { colors } = useTheme();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPremium) fetchExpenses();
  }, [isPremium]);

  const fetchExpenses = async () => {
    if (!isPremium) return;
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'getExpenseDashboard');
      const result = await fn({});
      setDashboard((result as any).data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Premium Feature</Text>
        <Text style={{ color: colors.text, opacity: 0.7, marginTop: 10 }}>Upgrade to track expenses</Text>
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.background, padding: 15 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>
        {t.flipit?.expenseDashboard || 'Expense Dashboard'}
      </Text>

      {dashboard ? (
        <>
          {/* Total Spent Card */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              borderLeftWidth: 4,
              borderLeftColor: '#FF7A00',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, opacity: 0.7 }}>{t.flipit?.last30Days || 'Last 30 Days'}</Text>
            <Text style={{ color: '#FF7A00', fontSize: 36, fontWeight: 'bold', marginTop: 10 }}>
              ${dashboard.totalSpent.toFixed(2)}
            </Text>
            <Text style={{ color: colors.text, fontSize: 12, opacity: 0.7, marginTop: 5 }}>{t.flipit?.totalSpent || 'Total spent'}</Text>
          </View>

          {/* By Store Breakdown */}
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 15 }}>{t.flipit?.spendingByStore || 'Spending by Store'}</Text>

            {dashboard.byStore && dashboard.byStore.length > 0 ? (
              dashboard.byStore.map((item: [string, number], idx: number) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item[0]}</Text>
                  </View>
                  <Text style={{ color: '#FF7A00', fontWeight: 'bold', fontSize: 16 }}>
                    ${item[1].toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ color: colors.text, opacity: 0.7 }}>{t.flipit?.noExpenseData || 'No expense data'}</Text>
              </View>
            )}
          </View>

          {/* Refresh Button */}
          <TouchableOpacity
            onPress={fetchExpenses}
            style={{
              backgroundColor: '#FF7A00',
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
              marginTop: 20,
              marginBottom: 30,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔄 {t.flipit?.refresh || 'Refresh'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ color: colors.text, opacity: 0.7 }}>{t.flipit?.noDataAvailable || 'No data available'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

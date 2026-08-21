import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const STORES = ['Walmart', 'Target', 'Best Buy', 'CVS', 'Home Depot', 'Sephora', 'Nike', "Victoria's Secret"];

export default function NotificationPreferencesScreen({ navigation }: any) {
  const { darkMode } = useTheme();
  const [preferences, setPreferences] = useState<{ [key: string]: boolean }>({});
  const [minDiscount, setMinDiscount] = useState(40);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPreferences(data.notificationPreferences || {});
        setMinDiscount(data.minNotificationDiscount || 40);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      await setDoc(doc(db, 'users', user.uid), {
        notificationPreferences: preferences,
        minNotificationDiscount: minDiscount,
      }, { merge: true });
      
      alert('Preferences saved!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences');
    }
  };

  const toggleStore = (store: string) => {
    setPreferences(prev => ({
      ...prev,
      [store]: !prev[store],
    }));
  };

  const bgColor = darkMode ? '#050505' : '#F7F7F8';
  const cardBg = darkMode ? '#111111' : '#FFFFFF';
  const textColor = darkMode ? '#FFFFFF' : '#111111';
  const secondaryText = darkMode ? '#A5A5A5' : '#666666';
  const borderColor = darkMode ? '#242424' : '#E7E7E7';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 20 }}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: textColor }]}>Notification Preferences</Text>

          <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Stores to Follow</Text>
            <Text style={[styles.sectionDescription, { color: secondaryText }]}>
              Get notifications for deals at these stores
            </Text>

            {STORES.map(store => (
              <View key={store} style={[styles.storeRow, { borderBottomColor: borderColor }]}>
                <Text style={[styles.storeName, { color: textColor }]}>{store}</Text>
                <Switch
                  value={preferences[store] || false}
                  onValueChange={() => toggleStore(store)}
                  trackColor={{ false: '#767577', true: '#FF7A00' }}
                  thumbColor={preferences[store] ? '#fff' : '#f4f3f4'}
                />
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Minimum Discount</Text>
            <Text style={[styles.sectionDescription, { color: secondaryText }]}>
              Only notify for deals with {minDiscount}% or more off
            </Text>

            <View style={styles.discountOptions}>
              {[20, 30, 40, 50, 60].map(discount => (
                <TouchableOpacity
                  key={discount}
                  onPress={() => setMinDiscount(discount)}
                  style={[
                    styles.discountButton,
                    minDiscount === discount && styles.discountButtonActive,
                    { borderColor: minDiscount === discount ? '#FF7A00' : borderColor },
                  ]}
                >
                  <Text style={[styles.discountText, { color: minDiscount === discount ? '#FF7A00' : textColor }]}>
                    {discount}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={savePreferences}>
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.disableAllButton} onPress={() => setPreferences({})}>
            <Text style={[styles.disableAllText, { color: secondaryText }]}>Disable All Notifications</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 20 },
  section: { borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  sectionDescription: { fontSize: 13, marginBottom: 16 },
  storeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  storeName: { fontSize: 15, fontWeight: '600' },
  discountOptions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  discountButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 2 },
  discountButtonActive: { backgroundColor: 'rgba(255, 122, 0, 0.1)' },
  discountText: { fontSize: 13, fontWeight: '700' },
  saveButton: { backgroundColor: '#FF7A00', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  disableAllButton: { alignItems: 'center', paddingVertical: 12 },
  disableAllText: { fontSize: 13, fontWeight: '600' },
});

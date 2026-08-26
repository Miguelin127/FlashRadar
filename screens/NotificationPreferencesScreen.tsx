import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationPreferencesScreen({ navigation }: any) {
  const { darkMode } = useTheme();
  const [discountThresholds, setDiscountThresholds] = useState<{ [key: number]: boolean }>({});
  const [keywordAlerts, setKeywordAlerts] = useState<Array<{ keyword: string; discount: number }>>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newDiscount, setNewDiscount] = useState('35');
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
        setDiscountThresholds(data.discountThresholds || {});
        setKeywordAlerts(data.keywordAlerts || []);
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
        discountThresholds,
        keywordAlerts,
      }, { merge: true });
      
      Alert.alert('Success', 'Preferences saved!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    }
  };

  const toggleDiscount = (discount: number) => {
    setDiscountThresholds(prev => ({
      ...prev,
      [discount]: !prev[discount],
    }));
  };

  const addKeywordAlert = () => {
    if (!newKeyword.trim()) {
      Alert.alert('Error', 'Enter a keyword');
      return;
    }
    
    if (keywordAlerts.find(k => k.keyword.toLowerCase() === newKeyword.toLowerCase())) {
      Alert.alert('Error', 'Keyword already exists');
      return;
    }

    setKeywordAlerts([...keywordAlerts, { keyword: newKeyword, discount: parseInt(newDiscount) || 35 }]);
    setNewKeyword('');
    setNewDiscount('35');
  };

  const removeKeywordAlert = (index: number) => {
    setKeywordAlerts(keywordAlerts.filter((_, i) => i !== index));
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

          <Text style={[styles.title, { color: textColor }]}>Notification Alerts</Text>

          {/* DISCOUNT THRESHOLDS */}
          <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Global Discount Alerts</Text>
            <Text style={[styles.sectionDescription, { color: secondaryText }]}>
              Get notified for deals at or above these discounts (any store, any product)
            </Text>

            <View style={styles.discountGrid}>
              {[40, 50, 60].map(discount => (
                <TouchableOpacity
                  key={discount}
                  onPress={() => toggleDiscount(discount)}
                  style={[
                    styles.discountButton,
                    discountThresholds[discount] && styles.discountButtonActive,
                    { borderColor: discountThresholds[discount] ? '#FF7A00' : borderColor },
                  ]}
                >
                  <View style={styles.checkboxContainer}>
                    {discountThresholds[discount] && (
                      <Ionicons name="checkmark-circle" size={20} color="#FF7A00" />
                    )}
                  </View>
                  <Text style={[styles.discountText, { color: discountThresholds[discount] ? '#FF7A00' : textColor }]}>
                    {discount}%+
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* KEYWORD ALERTS */}
          <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Keyword Alerts</Text>
            <Text style={[styles.sectionDescription, { color: secondaryText }]}>
              Get notified for specific products (e.g., "Headphones", "Beats", "Nintendo Switch")
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Enter keyword (e.g., Headphones)"
                placeholderTextColor={secondaryText}
                value={newKeyword}
                onChangeText={setNewKeyword}
                style={[styles.input, { borderColor, color: textColor }]}
              />
              <TextInput
                placeholder="Min discount %"
                placeholderTextColor={secondaryText}
                value={newDiscount}
                onChangeText={setNewDiscount}
                keyboardType="number-pad"
                style={[styles.inputSmall, { borderColor, color: textColor }]}
              />
              <TouchableOpacity style={styles.addButton} onPress={addKeywordAlert}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {keywordAlerts.length > 0 ? (
              <View>
                {keywordAlerts.map((alert, index) => (
                  <View key={index} style={[styles.keywordItem, { borderBottomColor: borderColor }]}>
                    <View>
                      <Text style={[styles.keywordName, { color: textColor }]}>{alert.keyword}</Text>
                      <Text style={[styles.keywordDiscount, { color: secondaryText }]}>{alert.discount}% or more</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeKeywordAlert(index)}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: secondaryText }]}>No keyword alerts yet</Text>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={savePreferences}>
            <Text style={styles.saveButtonText}>Save All Preferences</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.disableAllButton} onPress={() => {
            setDiscountThresholds({});
            setKeywordAlerts([]);
          }}>
            <Text style={[styles.disableAllText, { color: secondaryText }]}>Clear All Alerts</Text>
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
  discountGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  discountButton: { flex: 1, minWidth: '30%', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  discountButtonActive: { backgroundColor: 'rgba(255, 122, 0, 0.1)' },
  checkboxContainer: { marginBottom: 6 },
  discountText: { fontSize: 14, fontWeight: '700' },
  inputContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  inputSmall: { width: 70, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 10, fontSize: 12 },
  addButton: { width: 44, height: 44, backgroundColor: '#FF7A00', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  keywordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  keywordName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  keywordDiscount: { fontSize: 12 },
  emptyText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  saveButton: { backgroundColor: '#FF7A00', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  disableAllButton: { alignItems: 'center', paddingVertical: 12 },
  disableAllText: { fontSize: 13, fontWeight: '600' },
});

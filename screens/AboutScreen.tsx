import React from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'react-native';

export function AboutScreen() {
  const isDark = useColorScheme() === 'dark';
  const bgColor = isDark ? '#1a1a1a' : '#fff';
  const textColor = isDark ? '#fff' : '#000';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: bgColor }]}>
        <Text style={[styles.header, { color: '#FF7A00' }]}>FlashRadar LLC</Text>
        
        <View style={[styles.card, { borderColor: '#FF7A00' }]}>
          <Text style={[styles.title, { color: textColor }]}>About</Text>
          <Text style={[styles.text, { color: textColor }]}>FlashRadar is a deal discovery and reseller arbitrage app for iOS, Android, and web.</Text>
        </View>

        <View style={[styles.card, { borderColor: '#FF7A00' }]}>
          <Text style={[styles.title, { color: textColor }]}>Company</Text>
          <Text style={[styles.text, { color: textColor }]}>FlashRadar LLC</Text>
          <Text style={[styles.text, { color: '#888', fontSize: 12 }]}>File #18467046 • State of Illinois</Text>
        </View>

        <View style={[styles.card, { borderColor: '#FF7A00' }]}>
          <Text style={[styles.title, { color: textColor }]}>Contact</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:contact@flashradarapp.com')}>
            <Text style={[styles.link, { color: '#FF7A00' }]}>contact@flashradarapp.com</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { borderColor: '#FF7A00' }]}>
          <Text style={[styles.title, { color: textColor }]}>Legal</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://flashradarapp.com/privacy')}>
            <Text style={[styles.link, { color: '#FF7A00' }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://flashradarapp.com/terms')}>
            <Text style={[styles.link, { color: '#FF7A00', marginTop: 8 }]}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: '#666' }]}>v1.3.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  card: { borderWidth: 2, borderRadius: 12, padding: 16, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  text: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  version: { fontSize: 12, textAlign: 'center', marginTop: 20 },
});

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

export default function ReceiptScannerScreen() {
  const { isPremium } = useUser();
  const { colors } = useTheme();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  if (!isPremium) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>
          Premium Feature
        </Text>
        <Text style={{ color: colors.text, opacity: 0.7 }}>Upgrade to scan receipts</Text>
      </View>
    );
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImage(result.assets[0].uri);
      scanReceipt(result.assets[0].base64, result.assets[0].type || 'image/jpeg');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImage(result.assets[0].uri);
      scanReceipt(result.assets[0].base64, result.assets[0].type || 'image/jpeg');
    }
  };

  const scanReceipt = async (base64: string, mimeType: string) => {
    setLoading(true);
    try {
      const scanFn = httpsCallable(functions, 'scanReceiptEnhanced');
      const result = await scanFn({ imageBase64: base64, mimeType });
      setReceipt((result as any).data);
      setSelectedItems((result as any).data.items.map((_: any, i: number) => i));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmFlips = async () => {
    if (!receipt) return;
    setLoading(true);
    try {
      const confirmFn = httpsCallable(functions, 'confirmReceiptFlips');
      const items = receipt.items.filter((_: any, i: number) => selectedItems.includes(i));
      const result = await confirmFn({ receiptId: receipt.receiptId, items });
      Alert.alert('Success', `Created ${(result as any).data.flipsCreated} flips`);
      setReceipt(null);
      setImage(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!image) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 15 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>Scan Receipt</Text>
        <TouchableOpacity
          onPress={takePhoto}
          style={{
            backgroundColor: '#FF7A00',
            paddingHorizontal: 30,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>📷 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={pickImage}
          style={{
            backgroundColor: '#FF7A00',
            paddingHorizontal: 30,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>📁 Choose Photo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={{ color: colors.text, marginTop: 15 }}>Scanning receipt...</Text>
      </View>
    );
  }

  if (receipt) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background, padding: 15 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 15 }}>Review Items</Text>
        <Text style={{ color: colors.text, marginBottom: 5 }}><Text style={{fontWeight:'bold'}}>Store:</Text> {receipt.store}</Text>
        <Text style={{ color: colors.text, marginBottom: 15 }}><Text style={{fontWeight:'bold'}}>Date:</Text> {receipt.date}</Text>

        {receipt.items.map((item: any, i: number) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              setSelectedItems(
                selectedItems.includes(i)
                  ? selectedItems.filter(idx => idx !== i)
                  : [...selectedItems, i]
              );
            }}
            style={{
              borderColor: selectedItems.includes(i) ? '#FF7A00' : colors.border,
              borderWidth: selectedItems.includes(i) ? 2 : 1,
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.name}</Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {item.quantity}x @ ${item.unitPrice.toFixed(2)} = ${item.total.toFixed(2)}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={{ color: colors.text, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>
          Total: ${receipt.total.toFixed(2)}
        </Text>

        <TouchableOpacity
          onPress={confirmFlips}
          style={{
            backgroundColor: '#FF7A00',
            paddingVertical: 15,
            borderRadius: 8,
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
            ✓ Create Flips
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setReceipt(null);
            setImage(null);
          }}
          style={{
            backgroundColor: colors.border,
            paddingVertical: 12,
            borderRadius: 8,
            marginBottom: 30,
          }}
        >
          <Text style={{ color: colors.text, textAlign: 'center', fontWeight: 'bold' }}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

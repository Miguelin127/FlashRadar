import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Share, ActivityIndicator, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { useTheme } from '../context/ThemeContext';

interface ShareModalProps {
  visible: boolean;
  deal: { id: string; title: string; price: number; image?: string };
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ visible, deal, onClose }) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState<any>(null);

  const generateLink = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'generateShareLink');
      const result = await fn({
        dealId: deal.id,
        title: deal.title,
        price: deal.price,
        imageUrl: deal.image,
      });
      setShareLink((result as any).data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!shareLink) {
      await generateLink();
      return;
    }

    try {
      await Share.share({
        message: `${shareLink.shareText}\n\nDownload FlashRadar: ${shareLink.appStoreLink}`,
        url: shareLink.webLink,
        title: deal.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const bgColor = darkMode ? '#000' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: bgColor, borderRadius: 12, padding: 20, width: '85%' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor, marginBottom: 15 }}>
            Share Deal
          </Text>

          {shareLink && (
            <>
              <View style={{ backgroundColor: darkMode ? '#1a1a1a' : '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 15 }}>
                <Text style={{ color: textColor, fontSize: 14, fontWeight: 'bold' }}>Preview</Text>
                <Text style={{ color: textColor, fontSize: 12, marginTop: 5 }}>
                  {shareLink.shareText}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  Share.share({ message: shareLink.webLink });
                  Alert.alert('Copied', 'Share link copied to clipboard');
                }}
                style={{ backgroundColor: '#FF7A00', padding: 12, borderRadius: 8, marginBottom: 10 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                  📋 Copy Link
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={handleShare}
            disabled={loading}
            style={{ backgroundColor: '#FF7A00', padding: 12, borderRadius: 8, marginBottom: 10 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                📤 {shareLink ? 'Share' : 'Generate Link'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={{ backgroundColor: darkMode ? '#333' : '#ddd', padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: textColor, textAlign: 'center', fontWeight: 'bold' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadProfilePicture, removeProfilePicture } from '../api/user';
import { hapticLight } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { getImageUrl } from '../utils/imageUrl';

interface ProfilePictureUploadProps {
  currentImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onRemoveSuccess?: () => void;
}

export default function ProfilePictureUpload({ 
  currentImageUrl, 
  onUploadSuccess, 
  onRemoveSuccess 
}: ProfilePictureUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshUser } = useAuth();

  useEffect(() => {
    const imageUrl = getImageUrl(currentImageUrl);
    setPreview(imageUrl || null);
  }, [currentImageUrl]);

  const handleImagePick = async () => {
    hapticLight();
    
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 400,
      maxHeight: 400,
      includeBase64: false,
    }, async (response) => {
      if (response.didCancel || response.errorCode || !response.assets?.[0]) {
        if (response.errorCode === 'permission') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a profile picture.');
        }
      return;
    }

      const asset = response.assets[0];
      if (!asset.uri) return;
      
    setError(null);

    try {
      setPreview(asset.uri);
      setUploading(true);

        const fetchResponse = await fetch(asset.uri);
        const blob = await fetchResponse.blob();

      const url = await uploadProfilePicture(blob);
      const processedUrl = getImageUrl(url);
      setPreview(processedUrl || url);
      onUploadSuccess(url);
      await refreshUser();
      hapticLight();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview(currentImageUrl || null);
    } finally {
      setUploading(false);
    }
    });
  };

  const handleRemove = async () => {
    hapticLight();
    if (currentImageUrl) {
      setRemoving(true);
      setError(null);
      try {
        await removeProfilePicture();
        setPreview(null);
        if (onRemoveSuccess) onRemoveSuccess();
        await refreshUser();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove picture');
      } finally {
        setRemoving(false);
      }
    } else {
      setPreview(null);
    }
  };

  return (
    <View className="flex-col items-center gap-4">
      <View className="relative flex-col items-center gap-3">
        {preview ? (
          <>
            <View className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20">
              <ExpoImage source={{ uri: preview }} style={styles.image} cachePolicy="memory-disk" transition={200} contentFit="cover" />
              {uploading && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}
            </View>
            {!uploading && (
              <TouchableOpacity
                onPress={handleRemove}
                disabled={removing}
                className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg min-h-[36px]"
                style={{ opacity: removing ? 0.5 : 1 }}
                activeOpacity={0.8}
              >
                <Text className="text-red-400 text-sm font-medium">
                  {removing ? 'Removing...' : 'Remove Picture'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <LinearGradient
            colors={['#3b82f6', '#06b6d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.placeholderCircle}
          >
            <Feather name="camera" size={48} color="rgba(255, 255, 255, 0.8)" />
          </LinearGradient>
        )}
      </View>

      <TouchableOpacity
        onPress={handleImagePick}
        disabled={uploading || removing}
        activeOpacity={0.9}
        style={{ opacity: (uploading || removing) ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={['#3b82f6', '#06b6d4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.uploadButton}
        >
          <Text className="text-white font-medium">
            {uploading ? 'Uploading...' : preview ? 'Change Picture' : 'Upload Picture'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {error && (
        <View className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg">
          <Text className="text-red-400 text-sm">{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

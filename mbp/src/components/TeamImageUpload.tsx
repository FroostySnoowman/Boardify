import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { wrapPickerResult, validateImageFile } from '../utils/imageCompression';
import { hapticLight } from '../utils/haptics';
import { getImageUrl } from '../utils/imageUrl';
import { useTeams } from '../contexts/TeamsContext';

interface TeamImageUploadProps {
  currentImageUrl?: string | null;
  onImageSelect: (blob: Blob) => Promise<void>;
  onImageRemove?: () => Promise<void>;
  disabled?: boolean;
  iconColorStart?: string;
  iconColorEnd?: string;
}

export default function TeamImageUpload({
  currentImageUrl,
  onImageSelect,
  onImageRemove,
  disabled,
  iconColorStart = '#3b82f6',
  iconColorEnd = '#06b6d4',
}: TeamImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useTeams();

  useEffect(() => {
    const imageUrl = getImageUrl(currentImageUrl);
    setPreview(imageUrl || null);
  }, [currentImageUrl]);

  const handleImagePick = async () => {
    if (disabled || uploading || removing) return;
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
          Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a team image.');
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

        await onImageSelect(blob);
        hapticLight();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setPreview(getImageUrl(currentImageUrl) || null);
      } finally {
        setUploading(false);
      }
    });
  };

  const handleRemove = async () => {
    if (!disabled && !uploading && !removing && currentImageUrl && onImageRemove) {
      hapticLight();
      setRemoving(true);
      setError(null);
      try {
        await onImageRemove();
        setPreview(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove image');
      } finally {
        setRemoving(false);
      }
    } else if (!currentImageUrl) {
      setPreview(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {preview ? (
          <>
            <View style={styles.imageWrapper}>
              <ExpoImage source={{ uri: preview }} style={styles.image} cachePolicy="memory-disk" transition={200} contentFit="cover" />
              {(uploading || removing) && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}
            </View>
            {!uploading && !removing && currentImageUrl && onImageRemove && (
              <TouchableOpacity
                onPress={handleRemove}
                disabled={disabled}
                style={[styles.removeButton, disabled && styles.removeButtonDisabled]}
                activeOpacity={0.7}
              >
                <Text style={styles.removeButtonText}>Remove Image</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <LinearGradient
            colors={[iconColorStart, iconColorEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.placeholder}
          >
            <Feather name="users" size={48} color="rgba(255, 255, 255, 0.9)" />
          </LinearGradient>
        )}
      </View>

      <TouchableOpacity
        onPress={handleImagePick}
        disabled={uploading || removing || disabled}
        style={[styles.uploadButton, (uploading || removing || disabled) && styles.uploadButtonDisabled]}
        activeOpacity={0.7}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <LinearGradient
            colors={['#3b82f6', '#06b6d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.uploadButtonGradient}
          >
            <Text style={styles.uploadButtonText}>
              {uploading ? 'Uploading...' : preview ? 'Change Image' : 'Upload Image'}
            </Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 4,
  },
  imageContainer: {
    alignItems: 'center',
    gap: 12,
  },
  imageWrapper: {
    width: 128,
    height: 128,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    minHeight: 36,
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
  placeholder: {
    width: 128,
    height: 128,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  uploadButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 44,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
});

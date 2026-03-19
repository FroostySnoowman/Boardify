import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { validateImageFile } from '../utils/imageCompression';

interface ImageAttachmentPickerProps {
  onImagesSelected: (uris: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
  clearTrigger?: number | string;
}

export interface ImageAttachmentPickerHandle {
  openPicker: () => void;
}

const ImageAttachmentPicker = forwardRef<ImageAttachmentPickerHandle, ImageAttachmentPickerProps>((
  {
    onImagesSelected,
    maxImages = 5,
    disabled = false,
    clearTrigger,
  },
  ref
) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const clearPreviews = useCallback(() => {
    setPreviews([]);
    onImagesSelected([]);
  }, [onImagesSelected]);

  useEffect(() => {
    if (clearTrigger !== undefined) {
      clearPreviews();
    }
  }, [clearTrigger, clearPreviews]);

  const handleImagePick = useCallback(async () => {
    if (disabled || picking) return;
    hapticLight();
    setPicking(true);

    launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: maxImages - previews.length,
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
    }, (response) => {
      if (response.didCancel || response.errorCode || !response.assets) {
        if (response.errorCode === 'permission') {
          Alert.alert('Permission needed', 'Please grant camera roll permissions to attach media.');
        }
      setPicking(false);
      return;
    }

    const validUris: string[] = [];
      for (const asset of response.assets) {
        if (!asset.uri) continue;
        
      if (previews.length + validUris.length >= maxImages) {
        Alert.alert('Limit reached', `Maximum of ${maxImages} attachments per message.`);
        break;
      }

        const mimeType = asset.type || 'image/jpeg';
      const validation = validateImageFile(asset.uri, mimeType);
      if (!validation.valid) {
        Alert.alert('Invalid file', validation.error || 'Invalid media file.');
        continue;
      }

      validUris.push(asset.uri);
    }

    if (validUris.length > 0) {
      const updatedPreviews = [...previews, ...validUris];
      setPreviews(updatedPreviews);
      onImagesSelected(updatedPreviews);
    }
    setPicking(false);
    });
  }, [disabled, picking, previews, maxImages, onImagesSelected]);

  useImperativeHandle(ref, () => ({
    openPicker: handleImagePick,
  }), [handleImagePick]);

  const handleRemove = useCallback((index: number) => {
    hapticLight();
    setPreviews(prev => {
      const updated = prev.filter((_, i) => i !== index);
      onImagesSelected(updated);
      return updated;
    });
  }, [onImagesSelected]);

  return (
    <View className="flex-row items-center gap-2">
      {previews.length > 0 && (
        <View className="flex-row gap-2 flex-wrap">
          {previews.map((uri, index) => (
            <View key={uri} className="relative w-10 h-10 rounded-lg overflow-hidden bg-black/30 border border-white/10">
              <ExpoImage source={{ uri }} style={{ width: '100%', height: '100%' }} cachePolicy="memory-disk" transition={150} contentFit="cover" />
              <TouchableOpacity
                onPress={() => handleRemove(index)}
                className="absolute top-0.5 right-0.5 bg-blue-500 rounded-full p-0.5"
                activeOpacity={0.7}
              >
                <Feather name="x" size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {previews.length < maxImages && (
        <TouchableOpacity
          onPress={handleImagePick}
          disabled={disabled || picking}
          className={`w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/15 ${(disabled || picking) ? 'opacity-50' : ''}`}
          activeOpacity={0.7}
        >
          {picking ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Feather name="image" size={20} color="#9ca3af" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

ImageAttachmentPicker.displayName = 'ImageAttachmentPicker';

export default ImageAttachmentPicker;

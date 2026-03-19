import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Text, Animated } from 'react-native';
import { Image as ExpoImage, ImageLoadEventData } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { getImageUrl } from '../utils/imageUrl';

interface MediaAttachmentProps {
  url: string;
  index: number;
  total: number;
  onImageClick: (images: string[], index: number) => void;
  allAttachments: string[];
  uploading?: boolean;
  onMessageLongPress?: () => void;
}

export default function MediaAttachment({
  url,
  index,
  total,
  onImageClick,
  allAttachments,
  uploading = false,
  onMessageLongPress,
}: MediaAttachmentProps) {
  const [imageError, setImageError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const mediaUrl = getImageUrl(url);
  const maxHeight = total === 1 ? 300 : 200;

  if (uploading || !mediaUrl) {
    return (
      <View className="rounded-lg overflow-hidden bg-white/5 flex items-center justify-center" style={{ minHeight: 120, maxHeight }}>
        <View className="flex-col items-center justify-center gap-3">
          <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.5)" />
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Uploading…</Text>
        </View>
      </View>
    );
  }

  if (imageError) {
    return (
      <View className="rounded-lg overflow-hidden bg-white/5 flex items-center justify-center" style={{ minHeight: 120, maxHeight }}>
        <View className="flex-col items-center justify-center gap-2">
          <Feather name="alert-circle" size={24} color="#9ca3af" />
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>Media unavailable</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => onImageClick(allAttachments, index)}
      onLongPress={onMessageLongPress}
      delayLongPress={300}
      className="rounded-lg overflow-hidden"
      activeOpacity={0.9}
    >
      <ExpoImage
        source={{ uri: mediaUrl }}
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        cachePolicy="memory-disk"
        transition={200}
        className="w-full"
        style={{ maxHeight, aspectRatio }}
        contentFit="cover"
        onLoad={(e: ImageLoadEventData) => {
          const { width, height } = e.source;
          if (width && height) setAspectRatio(width / height);
        }}
        onError={() => setImageError(true)}
      />
    </TouchableOpacity>
  );
}

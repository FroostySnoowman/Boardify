import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { validateImageFile } from '../src/utils/imageCompression';
import { attachmentPickerEvents } from '../src/utils/attachmentPickerEvents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = 100;

interface MediaItem {
  id: string;
  uri: string;
  mediaType: 'photo' | 'video';
  duration?: number;
}

export default function AttachmentPickerModal() {
  const params = useLocalSearchParams<{ maxImages?: string }>();
  const maxImages = parseInt(params.maxImages || '5', 10);

  const [recentMedia, setRecentMedia] = useState<MediaItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const loadRecentMedia = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionGranted(false);
        return;
      }
      setPermissionGranted(true);

      const media = await MediaLibrary.getAssetsAsync({
        first: 20,
        mediaType: ['photo', 'video'],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      const items: MediaItem[] = await Promise.all(
        media.assets.map(async (asset) => {
          const info = await MediaLibrary.getAssetInfoAsync(asset);
          return {
            id: asset.id,
            uri: info.localUri || asset.uri,
            mediaType: asset.mediaType === 'video' ? 'video' : 'photo',
            duration: asset.duration,
          };
        })
      );

      setRecentMedia(items);
    } catch (error) {
      console.error('Error loading media:', error);
    }
  }, []);

  useEffect(() => {
    loadRecentMedia();
  }, [loadRecentMedia]);

  const handleMediaSelect = useCallback((item: MediaItem) => {
    hapticLight();
    setSelectedItems(prev => {
      if (prev.includes(item.uri)) {
        return prev.filter(uri => uri !== item.uri);
      }
      if (prev.length >= maxImages) {
        Alert.alert('Limit reached', `Maximum of ${maxImages} attachments per message.`);
        return prev;
      }
      return [...prev, item.uri];
    });
  }, [maxImages]);

  const handleDone = useCallback(() => {
    if (selectedItems.length > 0) {
      hapticMedium();
      attachmentPickerEvents.emit(selectedItems);
      router.back();
    }
  }, [selectedItems]);

  const handleOpenCamera = useCallback(async () => {
    hapticLight();
    
    launchCamera({
      mediaType: 'mixed',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
    }, (response) => {
      if (!response.didCancel && !response.errorCode && response.assets?.[0]?.uri) {
        attachmentPickerEvents.emit([response.assets[0].uri]);
        router.back();
      }
    });
  }, []);

  const handleViewLibrary = useCallback(() => {
    hapticLight();
    
    launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: maxImages,
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
    }, (response) => {
      if (!response.didCancel && !response.errorCode && response.assets) {
        const validUris = response.assets
          .filter(a => a.uri)
          .map(a => a.uri!)
          .filter(uri => {
            const validation = validateImageFile(uri, 'image/jpeg');
            return validation.valid;
          });
        if (validUris.length > 0) {
          attachmentPickerEvents.emit(validUris);
          router.back();
        }
      }
    });
  }, [maxImages]);

  const handleRecordAudio = useCallback(() => {
    hapticLight();
    Alert.alert('Coming Soon', 'Audio recording will be available soon!');
  }, []);

  const handleRecordVideo = useCallback(() => {
    hapticLight();
    
    launchCamera({
      mediaType: 'video',
      videoQuality: 'high',
      durationLimit: 60,
    }, (response) => {
      if (!response.didCancel && !response.errorCode && response.assets?.[0]?.uri) {
        attachmentPickerEvents.emit([response.assets[0].uri]);
        router.back();
      }
    });
  }, []);

  const handleUploadFile = useCallback(() => {
    hapticLight();
    Alert.alert('Coming Soon', 'File uploads will be available soon!');
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const menuItems = [
    { icon: 'mic' as const, label: 'Record an Audio Clip', onPress: handleRecordAudio },
    { icon: 'video' as const, label: 'Record a Video Clip', onPress: handleRecordVideo },
    { icon: 'upload' as const, label: 'Upload a File', onPress: handleUploadFile },
  ];

  const mediaData: (MediaItem | 'camera')[] = ['camera', ...recentMedia];

  const renderMediaItem = (item: MediaItem | 'camera', index: number) => {
    if (item === 'camera') {
      return (
        <TouchableOpacity
          key="camera"
          onPress={handleOpenCamera}
          className="items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700"
          style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, marginRight: 8 }}
          activeOpacity={0.7}
        >
          <Feather name="camera" size={28} color="#9ca3af" />
        </TouchableOpacity>
      );
    }

    const isSelected = selectedItems.includes(item.uri);
    const selectionIndex = selectedItems.indexOf(item.uri) + 1;

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => handleMediaSelect(item)}
        className="rounded-xl overflow-hidden"
        style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, marginRight: 8 }}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        
        <View
          className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 items-center justify-center ${
            isSelected ? 'bg-blue-500 border-blue-500' : 'border-white bg-black/30'
          }`}
        >
          {isSelected && (
            <Text className="text-white text-[10px] font-semibold">{selectionIndex}</Text>
          )}
        </View>

        {item.mediaType === 'video' && item.duration && (
          <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded flex-row items-center">
            <Feather name="play" size={10} color="white" />
            <Text className="text-white text-[10px] ml-0.5">{formatDuration(item.duration)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView className="flex-1 bg-zinc-900" showsVerticalScrollIndicator={false}>
      <View className="flex-row justify-between items-center px-4 pt-4 pb-3">
        <Text className="text-white text-[17px] font-semibold">Photos & Videos</Text>
        <TouchableOpacity onPress={handleViewLibrary}>
          <Text style={{ color: '#0A84FF', fontSize: 17 }}>View Library</Text>
        </TouchableOpacity>
      </View>

      {!permissionGranted ? (
        <View className="h-24 items-center justify-center px-4">
          <Text className="text-gray-400 text-sm">Grant access to view your photos</Text>
          <TouchableOpacity
            onPress={loadRecentMedia}
            className="mt-2 px-4 py-2 bg-blue-500 rounded-lg"
          >
            <Text className="text-white text-sm font-medium">Grant Access</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="mb-6"
        >
          {mediaData.map((item, index) => renderMediaItem(item, index))}
        </ScrollView>
      )}

      {selectedItems.length > 0 && (
        <View className="px-4 pb-4">
          <TouchableOpacity
            onPress={handleDone}
            className="bg-blue-500 py-3 rounded-xl items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">
              Add {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Items'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="px-4 pb-8">
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            onPress={item.onPress}
            className="flex-row items-center py-3.5"
            activeOpacity={0.7}
          >
            <View className="w-10 items-center">
              <Feather name={item.icon} size={24} color="#9ca3af" />
            </View>
            <Text className="text-white text-[17px] ml-3">{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

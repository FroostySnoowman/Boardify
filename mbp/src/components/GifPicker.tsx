import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { searchGifs, getTrendingGifs, GifResult } from '../api/messages';
import { PlatformBottomSheet } from './PlatformBottomSheet';
import { KLIPY_ATTRIBUTION_ENABLED } from '../config/attribution';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const GAP = 8;
const ITEM_WIDTH = (SCREEN_WIDTH - 32 - GAP) / COLUMN_COUNT;

interface GifPickerProps {
  isOpened: boolean;
  onClose: () => void;
  onSelectGif: (gif: GifResult) => void;
}

export function GifPicker({ isOpened, onClose, onSelectGif }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    try {
      const results = await getTrendingGifs(30);
      setGifs(results);
    } catch (e) {
      console.warn('Failed to load trending GIFs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpened) {
      loadTrending();
      setQuery('');
    }
  }, [isOpened, loadTrending]);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      loadTrending();
      return;
    }
    setLoading(true);
    try {
      const results = await searchGifs(q.trim(), 30);
      setGifs(results);
    } catch (e) {
      console.warn('GIF search failed:', e);
    } finally {
      setLoading(false);
    }
  }, [loadTrending]);

  const onChangeSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleSearch(text), 400);
  };

  return (
    <PlatformBottomSheet
      isOpened={isOpened}
      onIsOpenedChange={(opened) => !opened && onClose()}
      presentationDetents={[0.7]}
      presentationDragIndicator="visible"
    >
      <View style={s.header}>
        <Text style={s.title}>GIFs</Text>
        {KLIPY_ATTRIBUTION_ENABLED ? (
          <Text style={s.attributionHeader}>Powered by KLIPY</Text>
        ) : null}
      </View>

      <View style={s.searchContainer}>
        <View style={s.searchBar}>
          <Feather name="search" size={16} color="#6b7280" />
          <TextInput
            value={query}
            onChangeText={onChangeSearch}
            placeholder={KLIPY_ATTRIBUTION_ENABLED ? 'Search GIFs by KLIPY...' : 'Search GIFs...'}
            placeholderTextColor="#6b7280"
            style={s.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                loadTrending();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x-circle" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      ) : (
        <FlatList<GifResult>
          data={gifs}
          numColumns={COLUMN_COUNT}
          keyExtractor={(item: GifResult) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: GifResult }) => {
            const aspectRatio = item.width / item.height;
            return (
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  onSelectGif(item);
                  onClose();
                }}
                style={{ width: ITEM_WIDTH, marginBottom: GAP }}
                activeOpacity={0.7}
              >
                <ExpoImage
                  source={{ uri: item.previewUrl || item.url }}
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                  cachePolicy="memory-disk"
                  transition={200}
                  style={{
                    width: ITEM_WIDTH,
                    height: ITEM_WIDTH / aspectRatio,
                    borderRadius: 10,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                  }}
                  contentFit="cover"
                />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyText}>No GIFs found</Text>
            </View>
          }
          ListFooterComponent={
            KLIPY_ATTRIBUTION_ENABLED ? (
              <View style={s.attribution}>
                <Text style={s.attributionText}>GIFs powered by KLIPY</Text>
              </View>
            ) : null
          }
        />
      )}
    </PlatformBottomSheet>
  );
}

const SEARCH_HEIGHT = 42;

const s = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  attributionHeader: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    height: SEARCH_HEIGHT,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 10,
    height: SEARCH_HEIGHT,
    padding: 0,
    ...Platform.select({
      android: { textAlignVertical: 'center' as const },
    }),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  attribution: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingTop: 16,
  },
  attributionText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
  },
});

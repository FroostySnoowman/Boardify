import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';

interface HighlightsPageProps {
  teamId: string;
}

export default function HighlightsPage({ teamId }: HighlightsPageProps) {
  const highlights = [
    { title: 'Epic Rally Pt.1', timestamp: '00:23' },
    { title: 'Amazing Backhand', timestamp: '01:12' },
    { title: 'Match Point', timestamp: '02:45' },
    { title: 'Trophy Lift', timestamp: '03:10' }
  ];

  return (
    <View className="flex-row flex-wrap gap-4">
      {highlights.map((h, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => { hapticLight(); }}
          className="w-[48%] relative"
          activeOpacity={0.8}
        >
          {/* Thumbnail */}
          <View className="aspect-video bg-gray-800 rounded-lg items-center justify-center overflow-hidden">
            <Feather name="zap" size={32} color="#4b5563" />
          </View>
          
          {/* Info */}
          <Text className="mt-2 text-white font-semibold">{h.title}</Text>
          <Text className="text-xs text-gray-400">{h.timestamp}</Text>
          
          {/* Play Overlay (shown on hover in web, we show it always but subtle) */}
          <View 
            className="absolute inset-0 bg-black/40 rounded-lg items-center justify-center"
            style={{ aspectRatio: 16/9 }}
          >
            <View className="px-3 py-1 bg-green-500 rounded-full">
              <Text className="text-sm font-semibold text-black">Play</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}


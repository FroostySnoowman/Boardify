import React from 'react';
import {
  View,
  Text,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

// Note: React Native doesn't have recharts. For a full implementation,
// you'd use victory-native or react-native-chart-kit
// This is a simplified placeholder version

interface StatsPageProps {
  teamId: string;
}

export default function StatsPage({ teamId }: StatsPageProps) {
  const serveData = [
    { point: 1, firstServe: 75 },
    { point: 2, firstServe: 68 },
    { point: 3, firstServe: 82 },
    { point: 4, firstServe: 70 },
    { point: 5, firstServe: 88 }
  ];

  const statsData = [
    { label: 'Winners', value: '12' },
    { label: 'Unforced Errors', value: '5' },
    { label: 'Double Faults', value: '2' },
  ];

  // Simple bar representation for first serve %
  const maxValue = Math.max(...serveData.map(d => d.firstServe));

  return (
    <View className="flex-row flex-wrap gap-4">
      {/* First Serve % Card */}
      <View className="flex-1 min-w-[280px] p-4 rounded-xl bg-white/5 border border-white/10">
        <View className="flex-row items-center mb-3">
          <Feather name="bar-chart-2" size={20} color="#4ade80" />
          <Text className="text-lg font-bold text-white ml-2">First Serve %</Text>
        </View>
        
        {/* Simple bar chart representation */}
        <View className="h-[200px] flex-row items-end justify-around">
          {serveData.map((item, index) => (
            <View key={index} className="items-center">
              <View
                style={{
                  width: 32,
                  height: (item.firstServe / maxValue) * 160,
                  backgroundColor: '#4ade80',
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              />
              <Text className="text-xs text-gray-400">{item.point}</Text>
              <Text className="text-xs text-white mt-1">{item.firstServe}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Winners/Errors Card */}
      <View className="flex-1 min-w-[280px] p-4 rounded-xl bg-white/5 border border-white/10">
        <View className="flex-row items-center mb-3">
          <Feather name="award" size={20} color="#facc15" />
          <Text className="text-lg font-bold text-white ml-2">Winners/Errors</Text>
        </View>
        
        <View className="gap-3">
          {statsData.map(({ label, value }) => (
            <View key={label} className="flex-row justify-between items-center">
              <Text className="text-gray-300">{label}</Text>
              <Text className="text-white font-semibold text-lg">{value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}


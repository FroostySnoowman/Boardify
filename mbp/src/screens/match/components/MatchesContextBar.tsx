import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../../../utils/haptics';

export type MatchesSection = 'match' | 'analytics' | 'notes';

export const matchesSections: { key: MatchesSection; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'match', label: 'Live Match', icon: 'activity' },
  { key: 'analytics', label: 'Statistics', icon: 'bar-chart-2' },
  { key: 'notes', label: 'Notes', icon: 'book' },
];

export default function MatchesContextBar({
  activeSection,
  onSectionChange,
}: {
  activeSection: MatchesSection;
  onSectionChange: (section: MatchesSection) => void;
}) {
  return (
    <View className="flex-row border-b border-white/5 bg-[#020617]">
      {matchesSections.map((section) => {
        const isActive = activeSection === section.key;
        return (
          <TouchableOpacity
            key={section.key}
            onPress={() => {
              hapticLight();
              onSectionChange(section.key);
            }}
            className="flex-1 items-center justify-center py-3 relative"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-2">
              <Feather name={section.icon} size={16} color={isActive ? '#ffffff' : '#9ca3af'} />
              <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {section.label}
              </Text>
            </View>
            {isActive && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


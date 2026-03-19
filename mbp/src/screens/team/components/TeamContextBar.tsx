import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../../../utils/haptics';

export type ContextSection = 'chat' | 'calendar' | 'roster' | 'statistics';

interface TeamContextBarProps {
  activeSection: ContextSection;
  onSectionChange: (section: ContextSection) => void;
  teamId?: string;
}

const sections: { key: ContextSection; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'chat', label: 'CHAT', icon: 'message-square' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'roster', label: 'Roster', icon: 'users' },
  { key: 'statistics', label: 'Statistics', icon: 'bar-chart-2' },
];

export default function TeamContextBar({ activeSection, onSectionChange, teamId }: TeamContextBarProps) {
  return (
    <View className="flex-row border-b border-white/5 bg-[#020617]">
      {sections.map((section) => {
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
              <Feather 
                name={section.icon} 
                size={16} 
                color={isActive ? '#ffffff' : '#9ca3af'} 
              />
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-white' : 'text-gray-400'
                }`}
              >
                {section.label}
              </Text>
            </View>
            {isActive && (
              <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

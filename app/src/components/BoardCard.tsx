import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { hapticLight } from '../utils/haptics';

const CARD_SHIFT = 4;

export interface BoardCardProps {
  title: string;
  subtitle?: string;
  labelColor?: string;
  onPress?: () => void;
}

export function BoardCard({ title, subtitle, labelColor, onPress }: BoardCardProps) {
  const handlePress = () => {
    hapticLight();
    onPress?.();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={styles.wrap}
    >
      <View style={styles.shadow} />
      <View style={[styles.card, labelColor ? { borderLeftWidth: 4, borderLeftColor: labelColor } : undefined]}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: CARD_SHIFT,
    marginRight: CARD_SHIFT,
  },
  shadow: {
    position: 'absolute',
    left: CARD_SHIFT,
    top: CARD_SHIFT,
    right: -CARD_SHIFT,
    bottom: -CARD_SHIFT,
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

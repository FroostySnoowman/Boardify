import React, { forwardRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { hapticLight } from '../utils/haptics';

const CARD_SHIFT = 4;

export interface BoardCardProps {
  title: string;
  subtitle?: string;
  labelColor?: string;
  onPress?: () => void;
  hidden?: boolean;
  /** When wrapped by DraggableBoardCard (gesture handles tap + long-press) */
  suppressPress?: boolean;
}

export const BoardCard = forwardRef<View, BoardCardProps>(function BoardCard(
  { title, subtitle, labelColor, onPress, hidden, suppressPress },
  ref
) {
  const handlePress = () => {
    hapticLight();
    onPress?.();
  };

  const face = (
    <>
      <View style={styles.shadow} pointerEvents="none" />
      <View style={[styles.card, labelColor ? { borderLeftWidth: 4, borderLeftColor: labelColor } : undefined]}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.wrap, { opacity: hidden ? 0 : 1 }]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      {suppressPress ? (
        <View style={styles.pressable}>{face}</View>
      ) : (
        <Pressable onPress={handlePress} style={styles.pressable}>
          {face}
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: CARD_SHIFT,
    marginRight: CARD_SHIFT,
  },
  pressable: {
    position: 'relative',
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
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '400',
  },
});

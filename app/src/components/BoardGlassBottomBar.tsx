import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { hapticLight } from '../utils/haptics';
import { GlassRoundIconButton } from './GlassRoundIconButton';

/** Extra scroll padding so column content clears the floating bar (buttons + margins). */
export const BOARD_GLASS_BOTTOM_BAR_CLEARANCE = 96;

const ICON_COLOR = '#0a0a0a';
const ICON_SIZE = 22;

export type BoardGlassBottomBarProps = {
  onFilterPress?: () => void;
  onBellPress?: () => void;
  onSettingsPress?: () => void;
  onExpandPress?: () => void;
};

type TripleStripProps = {
  onFilterPress: () => void;
  onBellPress: () => void;
  onSettingsPress: () => void;
};

function GlassTripleStrip({ onFilterPress, onBellPress, onSettingsPress }: TripleStripProps) {
  const isGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  // Single child View: Fabric mounts GlassView children into UIVisualEffectView.contentView;
  // multiple roots (e.g. Fragment) can break hit-testing for nested Pressables.
  const row = (
    <View style={styles.tripleInner} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter"
        hitSlop={8}
        onPress={onFilterPress}
        style={styles.tripleSlot}
      >
        <Feather name="sliders" size={ICON_SIZE} color={ICON_COLOR} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={8}
        onPress={onBellPress}
        style={styles.tripleSlot}
      >
        <Feather name="bell" size={ICON_SIZE} color={ICON_COLOR} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={8}
        onPress={onSettingsPress}
        style={styles.tripleSlot}
      >
        <Feather name="settings" size={ICON_SIZE} color={ICON_COLOR} />
      </Pressable>
    </View>
  );

  if (isGlass) {
    return (
      <GlassView
        isInteractive={false}
        colorScheme="light"
        tintColor="rgba(255, 255, 255, 0.42)"
        style={styles.tripleGlass}
      >
        {row}
      </GlassView>
    );
  }

  return <View style={[styles.tripleGlass, styles.tripleFallback]}>{row}</View>;
}

export function BoardGlassBottomBar({
  onFilterPress,
  onBellPress,
  onSettingsPress,
  onExpandPress,
}: BoardGlassBottomBarProps) {
  const insets = useSafeAreaInsets();
  const noop = () => {};

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <View
        style={[
          styles.inner,
          { paddingBottom: Math.max(insets.bottom, 10) + 10 },
        ]}
      >
        <View style={styles.row}>
          <GlassTripleStrip
            onFilterPress={() => {
              hapticLight();
              (onFilterPress ?? noop)();
            }}
            onBellPress={() => {
              hapticLight();
              (onBellPress ?? noop)();
            }}
            onSettingsPress={() => {
              hapticLight();
              (onSettingsPress ?? noop)();
            }}
          />
          <GlassRoundIconButton
            icon="maximize-2"
            accessibilityLabel="Expand"
            onPress={() => {
              hapticLight();
              (onExpandPress ?? noop)();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
    zIndex: 50,
  },
  inner: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripleGlass: {
    borderRadius: 26,
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  tripleInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripleFallback: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  tripleSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

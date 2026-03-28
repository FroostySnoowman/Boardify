import React from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GlassView,
  GlassContainer,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect';
import { hapticLight } from '../utils/haptics';
import { GlassRoundIconButton } from './GlassRoundIconButton';

export const BOARD_GLASS_BOTTOM_BAR_CLEARANCE = 96;

const ICON_COLOR = '#0a0a0a';
const ICON_SIZE = 22;

export type BoardGlassBottomBarProps = {
  onFilterPress?: () => void;
  onBellPress?: () => void;
  onSettingsPress?: () => void;
  onExpandPress?: () => void;
};

type GlassTripleStripProps = {
  onFilterPress: () => void;
  onBellPress: () => void;
  onSettingsPress: () => void;
};

/** Tight pill: 3× touch target + gaps; native `GlassView` needs explicit width. */
const TRIPLE_ICON_GAP = 10;
const TRIPLE_SLOT = 44;
const TRIPLE_PILL_PADDING_H = 6;
const TRIPLE_PILL_PADDING_V = 4;
const TRIPLE_INNER_WIDTH = TRIPLE_SLOT * 3 + TRIPLE_ICON_GAP * 2;
const TRIPLE_PILL_WIDTH = TRIPLE_INNER_WIDTH + TRIPLE_PILL_PADDING_H * 2;
const TRIPLE_ROW_HEIGHT = 44;

function TripleIconColumn({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.tripleColumn} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
        style={({ pressed }) => [styles.triplePressable, pressed && styles.tripleSlotPressed]}
      >
        {children}
      </Pressable>
    </View>
  );
}

function GlassTripleStrip({ onFilterPress, onBellPress, onSettingsPress }: GlassTripleStripProps) {
  const isGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  const row = (
    <View style={styles.tripleInner} collapsable={false} pointerEvents="box-none">
      <TripleIconColumn label="Filter" onPress={onFilterPress}>
        <Feather name="sliders" size={ICON_SIZE} color={ICON_COLOR} />
      </TripleIconColumn>
      <TripleIconColumn label="Notifications" onPress={onBellPress}>
        <Feather name="bell" size={ICON_SIZE} color={ICON_COLOR} />
      </TripleIconColumn>
      <TripleIconColumn label="Settings" onPress={onSettingsPress}>
        <Feather name="settings" size={ICON_SIZE} color={ICON_COLOR} />
      </TripleIconColumn>
    </View>
  );

  if (isGlass) {
    return (
      <GlassView
        isInteractive
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

/**
 * Expand control as direct `GlassView` sibling (required for `GlassContainer` liquid merge on iOS).
 */
function BoardExpandGlassNative({ onPress }: { onPress: () => void }) {
  return (
    <GlassView
      isInteractive
      colorScheme="light"
      tintColor="rgba(255, 255, 255, 0.42)"
      style={styles.expandGlass}
    >
      <Pressable
        onPress={onPress}
        hitSlop={12}
        accessibilityLabel="Expand"
        accessibilityRole="button"
        style={({ pressed }) => [styles.expandGlassInner, pressed && styles.expandGlassInnerPressed]}
      >
        <View style={styles.expandIconOptical} collapsable={false}>
          <Feather name="maximize-2" size={ICON_SIZE} color={ICON_COLOR} />
        </View>
      </Pressable>
    </GlassView>
  );
}

export function BoardGlassBottomBar({
  onFilterPress,
  onBellPress,
  onSettingsPress,
  onExpandPress,
}: BoardGlassBottomBarProps) {
  const insets = useSafeAreaInsets();
  const noop = () => {};
  const useNativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  const strip = (
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
  );

  const onExpand = () => {
    hapticLight();
    (onExpandPress ?? noop)();
  };

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <View
        style={[
          styles.inner,
          { paddingBottom: Math.max(insets.bottom, 10) + 4 },
        ]}
      >
        {useNativeGlass ? (
          <GlassContainer
            spacing={22}
            style={styles.row}
          >
            {strip}
            <BoardExpandGlassNative onPress={onExpand} />
          </GlassContainer>
        ) : (
          <View style={styles.row}>
            {strip}
            <GlassRoundIconButton
              icon="maximize-2"
              accessibilityLabel="Expand"
              onPress={onExpand}
            />
          </View>
        )}
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
    width: TRIPLE_PILL_WIDTH,
    minWidth: TRIPLE_PILL_WIDTH,
    height: TRIPLE_ROW_HEIGHT + TRIPLE_PILL_PADDING_V * 2,
    borderRadius: 26,
    overflow: 'hidden',
  },
  /**
   * `GlassView` on iOS often does not run normal RN flex for children; pin the row with insets
   * so icons span the full pill (same pattern as a bounded overlay).
   */
  tripleInner: {
    position: 'absolute',
    left: TRIPLE_PILL_PADDING_H,
    right: TRIPLE_PILL_PADDING_H,
    top: TRIPLE_PILL_PADDING_V,
    bottom: TRIPLE_PILL_PADDING_V,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TRIPLE_ICON_GAP,
  },
  tripleFallback: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  tripleColumn: {
    width: TRIPLE_SLOT,
    height: TRIPLE_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triplePressable: {
    width: TRIPLE_SLOT,
    height: TRIPLE_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    overflow: 'hidden',
  },
  tripleSlotPressed: {
    backgroundColor: Platform.select({
      ios: 'rgba(0, 0, 0, 0.08)',
      default: 'rgba(0, 0, 0, 0.06)',
    }),
  },
  expandGlass: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
  },
  expandGlassInner: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `maximize-2` glyph sits slightly high-right in the Feather bbox. */
  expandIconOptical: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -1 }, { translateY: 0.5 }],
  },
  expandGlassInnerPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
});

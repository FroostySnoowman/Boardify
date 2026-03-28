import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, Platform, useWindowDimensions } from 'react-native';
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
const TRIPLE_ICON_GAP = 6;
const TRIPLE_SLOT = 44;
const TRIPLE_PILL_PADDING_H = 4;
const TRIPLE_PILL_PADDING_V = 4;
const TRIPLE_INNER_WIDTH = TRIPLE_SLOT * 3 + TRIPLE_ICON_GAP * 2;
const TRIPLE_PILL_WIDTH = TRIPLE_INNER_WIDTH + TRIPLE_PILL_PADDING_H * 2;
const TRIPLE_ROW_HEIGHT = 44;

/** Gap between pill and expand. */
const ROW_GAP = 16;
const EXPAND_ORB_SIZE = 45;
const PILL_TRACK_HEIGHT = TRIPLE_ROW_HEIGHT + TRIPLE_PILL_PADDING_V * 2;
/** Explicit width so the bar shell matches pill + gap + orb. */
const ROW_TOTAL_WIDTH = TRIPLE_PILL_WIDTH + ROW_GAP + EXPAND_ORB_SIZE;
/** Horizontal distance from row’s left edge (pill’s left) to the bell column’s center. */
const BELL_CENTER_X_FROM_ROW_LEFT =
  TRIPLE_PILL_PADDING_H + TRIPLE_SLOT + TRIPLE_ICON_GAP + TRIPLE_SLOT / 2;

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
 * Same pattern as `GlassRoundIconButton`: `Pressable` wraps `GlassView` with `isInteractive`.
 * A sibling `Pressable` outside `GlassContainer` often loses hit tests to the native glass subtree.
 */
function BoardExpandGlassPressable({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      collapsable={false}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Expand"
      android_ripple={null}
      style={styles.expandPressable}
    >
      <GlassView
        isInteractive
        colorScheme="light"
        tintColor="rgba(255, 255, 255, 0.42)"
        style={styles.expandGlass}
      >
        <View style={styles.expandGlassInner} collapsable={false}>
          <Feather name="maximize-2" size={ICON_SIZE} color={ICON_COLOR} />
        </View>
      </GlassView>
    </Pressable>
  );
}

export function BoardGlassBottomBar({
  onFilterPress,
  onBellPress,
  onSettingsPress,
  onExpandPress,
}: BoardGlassBottomBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const noop = () => {};
  const useNativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  /** Align bell with window horizontal center (reference: centered “middle mark” toolbars). */
  const rowLeft = useMemo(
    () => windowWidth / 2 - BELL_CENTER_X_FROM_ROW_LEFT,
    [windowWidth],
  );

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
        <View style={styles.barTrack} pointerEvents="box-none">
          {useNativeGlass ? (
            <View
              collapsable={false}
              style={[styles.rowShell, { left: rowLeft, width: ROW_TOTAL_WIDTH }]}
            >
              <GlassContainer
                spacing={ROW_GAP}
                pointerEvents="box-none"
                style={styles.glassMergedRow}
              >
                {strip}
                <BoardExpandGlassPressable onPress={onExpand} />
              </GlassContainer>
            </View>
          ) : (
            <View style={[styles.row, { left: rowLeft }]}>
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
    width: '100%',
  },
  /** Full-bleed horizontal space so `left` matches screen coordinates (no padding skew). */
  barTrack: {
    width: '100%',
    minHeight: PILL_TRACK_HEIGHT,
    position: 'relative',
    overflow: 'visible',
  },
  rowShell: {
    position: 'absolute',
    top: 0,
    minHeight: PILL_TRACK_HEIGHT,
  },
  /** Fills `rowShell`; native glass merge for pill + orb. */
  glassMergedRow: {
    width: '100%',
    minHeight: PILL_TRACK_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  row: {
    position: 'absolute',
    top: 0,
    width: ROW_TOTAL_WIDTH,
    minHeight: PILL_TRACK_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  expandPressable: {
    opacity: 1,
    overflow: 'visible',
  },
  tripleGlass: {
    width: TRIPLE_PILL_WIDTH,
    minWidth: TRIPLE_PILL_WIDTH,
    height: PILL_TRACK_HEIGHT,
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
    width: EXPAND_ORB_SIZE,
    height: EXPAND_ORB_SIZE,
    borderRadius: EXPAND_ORB_SIZE / 2,
    overflow: 'hidden',
  },
  expandGlassInner: {
    width: EXPAND_ORB_SIZE,
    height: EXPAND_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

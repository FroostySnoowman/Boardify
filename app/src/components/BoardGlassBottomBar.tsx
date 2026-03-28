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
// import { ContextMenu } from './ContextMenu';

const ICON_COLOR = '#0a0a0a';
const ICON_SIZE = 22;

export type BoardBottomBarLayoutMode = 'board' | 'list' | 'calendar';

export type BoardGlassBottomBarProps = {
  onFilterPress?: () => void;
  onBellPress?: () => void;
  onSettingsPress?: () => void;
  onExpandPress?: () => void;
  /** When false, hides the fullscreen control (Table / Calendar / Dashboard). Default true. */
  showExpandButton?: boolean;
  /** When true, expand shows minimize icon — focused list mode is active. */
  expandActive?: boolean;
  /** Bottom “Board / List / Calendar” layout menu (left of the triple pill). */
  onLayoutMenuSelect?: (mode: BoardBottomBarLayoutMode) => void;
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
/** Pull fullscreen control slightly toward the pill (optical / layout tweak). */
const EXPAND_SHIFT_LEFT = 3;
const EXPAND_ORB_SIZE = 45;
const PILL_TRACK_HEIGHT = TRIPLE_ROW_HEIGHT + TRIPLE_PILL_PADDING_V * 2;
/**
 * Space inside the native glass row height so `isInteractive` morphs are not clipped by
 * `GlassContainer` / `UIVisualEffectView` bounds. Row content is bottom-aligned in this height.
 */
const EXPAND_INTERACTION_OVERFLOW = 40;
const GLASS_ROW_MIN_HEIGHT = PILL_TRACK_HEIGHT + EXPAND_INTERACTION_OVERFLOW;
export const BOARD_GLASS_BOTTOM_BAR_CLEARANCE = 96 + EXPAND_INTERACTION_OVERFLOW;
/** Left layout-menu orb (matches expand orb for symmetry). */
const LAYOUT_MENU_ORB_SIZE = 45;
/** Pill + gap + expand only (fallback row when native glass merge is off). */
const GLASS_PAIR_WIDTH = TRIPLE_PILL_WIDTH + ROW_GAP + EXPAND_ORB_SIZE;
/**
 * Full bar width (shell + fallback). Merged glass uses inner margins so visual gaps match `ROW_GAP - EXPAND_SHIFT_LEFT`.
 * (Layout menu orb omitted for now — add `LAYOUT_MENU_ORB_SIZE + ROW_GAP` when restoring left control.)
 */
const ROW_TOTAL_WIDTH_WITH_EXPAND = GLASS_PAIR_WIDTH - EXPAND_SHIFT_LEFT;
const ROW_TOTAL_WIDTH_PILL_ONLY = TRIPLE_PILL_WIDTH;
/** From **pill** left edge to bell column center (for window centering). */
const BELL_CENTER_X_FROM_PILL_LEFT =
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

/*
 * Left “Board / List / Calendar” layout orb — temporarily removed from the bar.
 * Uncomment this block and the `BoardBottomLayoutMenu` usages below; restore `ContextMenu` import;
 * set `ROW_TOTAL_WIDTH` back to `LAYOUT_MENU_ORB_SIZE + ROW_GAP + GLASS_PAIR_WIDTH - EXPAND_SHIFT_LEFT`;
 * restore `rowLeft` to subtract `LAYOUT_MENU_ORB_SIZE + ROW_GAP` before `EXPAND_SHIFT_LEFT`.
 *
function BoardBottomLayoutMenu({
  onSelect,
  inGlassMerge,
}: {
  onSelect?: (mode: BoardBottomBarLayoutMode) => void;
  inGlassMerge?: boolean;
}) {
  const noop = () => {};
  const options = useMemo(
    () =>
      (
        [
          { label: 'Board', value: 'board' as const },
          { label: 'List', value: 'list' as const },
          { label: 'Calendar', value: 'calendar' as const },
        ] as const
      ).map(({ label, value }) => ({
        label,
        value,
        onPress: () => {
          (onSelect ?? noop)(value);
        },
      })),
    [onSelect],
  );

  const menu = (
    <ContextMenu
      options={options}
      hostMatchContents
      iosGlassMenuTrigger
      triggerWrapperStyle={styles.leftMenuTriggerWrap}
      trigger={
        <GlassRoundIconButton
          icon="layout"
          size={ICON_SIZE}
          accessibilityLabel="Layout and views"
          embedInSwiftMenu={Platform.OS === 'ios'}
          onPress={() => {}}
        />
      }
    />
  );

  if (inGlassMerge) {
    return (
      <View style={styles.layoutMenuInGlassSlot} collapsable={false}>
        {menu}
      </View>
    );
  }

  return (
    <View style={styles.leftMenuOrbSlot} collapsable={false}>
      {menu}
    </View>
  );
}
*/

function BoardExpandGlassPressable({
  onPress,
  active,
}: {
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      collapsable={false}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Exit focused list view' : 'Focus one list at a time'}
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
          <Feather name={active ? 'minimize-2' : 'maximize-2'} size={ICON_SIZE} color={ICON_COLOR} />
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
  onLayoutMenuSelect,
  showExpandButton = true,
  expandActive = false,
}: BoardGlassBottomBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const noop = () => {};
  const useNativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  const rowTotalWidth = showExpandButton ? ROW_TOTAL_WIDTH_WITH_EXPAND : ROW_TOTAL_WIDTH_PILL_ONLY;

  /** Align bell with window horizontal center (reference: centered “middle mark” toolbars). */
  const rowLeft = useMemo(
    () =>
      showExpandButton
        ? windowWidth / 2 + EXPAND_SHIFT_LEFT - BELL_CENTER_X_FROM_PILL_LEFT
        : windowWidth / 2 - BELL_CENTER_X_FROM_PILL_LEFT,
    [windowWidth, showExpandButton],
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
          <View
            collapsable={false}
            style={[styles.rowShell, { left: rowLeft, width: rowTotalWidth }]}
          >
            {useNativeGlass ? (
              <GlassContainer
                spacing={ROW_GAP}
                pointerEvents="box-none"
                style={[styles.glassMergedRow, { width: rowTotalWidth }]}
              >
                {/* <BoardBottomLayoutMenu onSelect={onLayoutMenuSelect} inGlassMerge /> */}
                {strip}
                {showExpandButton ? (
                  <BoardExpandGlassPressable onPress={onExpand} active={expandActive} />
                ) : null}
              </GlassContainer>
            ) : (
              <View style={styles.bottomBarRow} pointerEvents="box-none">
                {/* <BoardBottomLayoutMenu onSelect={onLayoutMenuSelect} /> */}
                <View
                  style={[
                    styles.fallbackGlassPair,
                    !showExpandButton && styles.fallbackGlassPairCompact,
                  ]}
                  pointerEvents="box-none"
                >
                  {strip}
                  {showExpandButton ? (
                    <View style={styles.expandFallbackNudge}>
                      <GlassRoundIconButton
                        icon={expandActive ? 'minimize-2' : 'maximize-2'}
                        accessibilityLabel={expandActive ? 'Exit focused list view' : 'Focus one list at a time'}
                        onPress={onExpand}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </View>
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
    zIndex: 1000,
    elevation: 24,
    overflow: 'visible',
  },
  inner: {
    width: '100%',
    overflow: 'visible',
  },
  /**
   * Taller than the pill row: row is pinned to the bottom so interactive glass can move up
   * without hitting a hard clip at `top: 0`.
   */
  barTrack: {
    width: '100%',
    minHeight: GLASS_ROW_MIN_HEIGHT,
    position: 'relative',
    overflow: 'visible',
  },
  rowShell: {
    position: 'absolute',
    bottom: 0,
    minHeight: GLASS_ROW_MIN_HEIGHT,
    overflow: 'visible',
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    minHeight: GLASS_ROW_MIN_HEIGHT,
    overflow: 'visible',
  },
  /** Bounds Android `ContextMenu` root `width: '100%'` so the bottom row doesn’t stretch. */
  /** Match expand orb spacing: `expandPressable` uses `marginLeft: -EXPAND_SHIFT_LEFT` toward the pill. */
  leftMenuOrbSlot: {
    width: LAYOUT_MENU_ORB_SIZE,
    height: LAYOUT_MENU_ORB_SIZE,
    marginRight: -EXPAND_SHIFT_LEFT,
    overflow: 'visible',
  },
  leftMenuTriggerWrap: {
    width: LAYOUT_MENU_ORB_SIZE,
    height: LAYOUT_MENU_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Holds layout `ContextMenu` inside `GlassContainer` (Android width bound). */
  layoutMenuInGlassSlot: {
    width: LAYOUT_MENU_ORB_SIZE,
    height: LAYOUT_MENU_ORB_SIZE,
    marginRight: -EXPAND_SHIFT_LEFT,
    overflow: 'visible',
  },
  /**
   * Taller than the pill so native glass has room for morphs; `center` aligns 45px orb with 52px pill.
   * (`flex-end` matched bottoms and made the orb look visually low.)
   */
  glassMergedRow: {
    minHeight: GLASS_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    overflow: 'visible',
  },
  fallbackGlassPair: {
    width: GLASS_PAIR_WIDTH,
    minHeight: GLASS_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    overflow: 'visible',
  },
  fallbackGlassPairCompact: {
    width: TRIPLE_PILL_WIDTH,
    gap: 0,
  },
  expandPressable: {
    opacity: 1,
    overflow: 'visible',
    marginLeft: -EXPAND_SHIFT_LEFT,
  },
  expandFallbackNudge: {
    marginLeft: -EXPAND_SHIFT_LEFT,
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
    overflow: 'visible',
  },
  expandGlassInner: {
    width: EXPAND_ORB_SIZE,
    height: EXPAND_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

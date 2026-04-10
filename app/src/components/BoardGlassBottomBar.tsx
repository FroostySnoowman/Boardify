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
import { useTheme } from '../theme';

const ICON_SIZE = 22;

export type BoardBottomBarLayoutMode = 'board' | 'list' | 'calendar';

export type BoardGlassBottomBarProps = {
  onSearchCardsPress: () => void;
  onBellPress: () => void;
  onSettingsPress: () => void;
  onExpandPress?: () => void;
  showExpandButton?: boolean;
  expandActive?: boolean;
  expandDisabled?: boolean;
  onLayoutMenuSelect?: (mode: BoardBottomBarLayoutMode) => void;
};

type GlassIconStripProps = {
  onSearchCardsPress: () => void;
  onBellPress: () => void;
  onSettingsPress: () => void;
};

const TRIPLE_ICON_GAP = 6;
const TRIPLE_SLOT = 44;
const TRIPLE_PILL_PADDING_H = 4;
const TRIPLE_PILL_PADDING_V = 4;
const STRIP_ICON_COUNT = 3;
const TRIPLE_INNER_WIDTH =
  TRIPLE_SLOT * STRIP_ICON_COUNT + TRIPLE_ICON_GAP * (STRIP_ICON_COUNT - 1);
const TRIPLE_PILL_WIDTH = TRIPLE_INNER_WIDTH + TRIPLE_PILL_PADDING_H * 2;
const TRIPLE_ROW_HEIGHT = 44;
const ROW_GAP = 16;
const EXPAND_SHIFT_LEFT = 3;
const EXPAND_ORB_SIZE = 45;
const PILL_TRACK_HEIGHT = TRIPLE_ROW_HEIGHT + TRIPLE_PILL_PADDING_V * 2;
const EXPAND_INTERACTION_OVERFLOW = 40;
const GLASS_ROW_MIN_HEIGHT = PILL_TRACK_HEIGHT + EXPAND_INTERACTION_OVERFLOW;
export const BOARD_GLASS_BOTTOM_BAR_CLEARANCE = 96 + EXPAND_INTERACTION_OVERFLOW;
const LAYOUT_MENU_ORB_SIZE = 45;
const GLASS_PAIR_WIDTH = TRIPLE_PILL_WIDTH + ROW_GAP + EXPAND_ORB_SIZE;
const ROW_TOTAL_WIDTH_WITH_EXPAND = GLASS_PAIR_WIDTH - EXPAND_SHIFT_LEFT;
const ROW_TOTAL_WIDTH_PILL_ONLY = TRIPLE_PILL_WIDTH;
const BELL_CENTER_X_FROM_PILL_LEFT =
  TRIPLE_PILL_PADDING_H + TRIPLE_SLOT / 2 + (TRIPLE_SLOT + TRIPLE_ICON_GAP);

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

function GlassIconStrip({
  onSearchCardsPress,
  onBellPress,
  onSettingsPress,
}: GlassIconStripProps) {
  const { colors, resolvedScheme } = useTheme();
  const isGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const glassScheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);
  const glassTint =
    resolvedScheme === 'dark' ? 'rgba(40, 38, 36, 0.72)' : 'rgba(255, 255, 255, 0.42)';
  const iconColor = colors.iconPrimary;
  const tripleFallback = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.glassFallbackBorder,
      backgroundColor: colors.glassFallbackBg,
    }),
    [colors]
  );

  const row = (
    <View style={styles.tripleInner} collapsable={false} pointerEvents="box-none">
      <TripleIconColumn label="Search cards" onPress={onSearchCardsPress}>
        <Feather name="search" size={ICON_SIZE} color={iconColor} />
      </TripleIconColumn>
      <TripleIconColumn label="Notifications" onPress={onBellPress}>
        <Feather name="bell" size={ICON_SIZE} color={iconColor} />
      </TripleIconColumn>
      <TripleIconColumn label="Settings" onPress={onSettingsPress}>
        <Feather name="settings" size={ICON_SIZE} color={iconColor} />
      </TripleIconColumn>
    </View>
  );

  if (isGlass) {
    return (
      <GlassView
        isInteractive
        colorScheme={glassScheme}
        tintColor={glassTint}
        style={styles.tripleGlass}
      >
        {row}
      </GlassView>
    );
  }

  return <View style={[styles.tripleGlass, tripleFallback]}>{row}</View>;
}

function BoardExpandGlassPressable({
  onPress,
  active,
  disabled,
}: {
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const { colors, resolvedScheme } = useTheme();
  const glassScheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);
  const glassTint =
    resolvedScheme === 'dark' ? 'rgba(40, 38, 36, 0.72)' : 'rgba(255, 255, 255, 0.42)';
  const iconColor = colors.iconPrimary;

  return (
    <Pressable
      collapsable={false}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={
        disabled
          ? 'Finishing transition'
          : active
            ? 'Exit focused list view'
            : 'Focus one list at a time'
      }
      android_ripple={null}
      style={({ pressed }) => [
        styles.expandPressable,
        disabled && styles.expandPressableDisabled,
        pressed && !disabled && styles.expandPressablePressed,
      ]}
    >
      <GlassView
        isInteractive
        colorScheme={glassScheme}
        tintColor={glassTint}
        style={styles.expandGlass}
      >
        <View style={styles.expandGlassInner} collapsable={false}>
          <Feather name={active ? 'minimize-2' : 'maximize-2'} size={ICON_SIZE} color={iconColor} />
        </View>
      </GlassView>
    </Pressable>
  );
}

export function BoardGlassBottomBar({
  onSearchCardsPress,
  onBellPress,
  onSettingsPress,
  onExpandPress,
  onLayoutMenuSelect,
  showExpandButton = true,
  expandActive = false,
  expandDisabled = false,
}: BoardGlassBottomBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const useNativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  const rowTotalWidth = showExpandButton ? ROW_TOTAL_WIDTH_WITH_EXPAND : ROW_TOTAL_WIDTH_PILL_ONLY;

  const rowLeft = useMemo(
    () =>
      showExpandButton
        ? windowWidth / 2 + EXPAND_SHIFT_LEFT - BELL_CENTER_X_FROM_PILL_LEFT
        : windowWidth / 2 - BELL_CENTER_X_FROM_PILL_LEFT,
    [windowWidth, showExpandButton],
  );

  const strip = (
    <GlassIconStrip
      onSearchCardsPress={() => {
        hapticLight();
        onSearchCardsPress();
      }}
      onBellPress={() => {
        hapticLight();
        onBellPress();
      }}
      onSettingsPress={() => {
        hapticLight();
        onSettingsPress();
      }}
    />
  );

  const onExpand = () => {
    hapticLight();
    onExpandPress?.();
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
                {strip}
                {showExpandButton ? (
                  <BoardExpandGlassPressable
                    onPress={onExpand}
                    active={expandActive}
                    disabled={expandDisabled}
                  />
                ) : null}
              </GlassContainer>
            ) : (
              <View style={styles.bottomBarRow} pointerEvents="box-none">
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
                        accessibilityLabel={
                          expandDisabled
                            ? 'Finishing transition'
                            : expandActive
                              ? 'Exit focused list view'
                              : 'Focus one list at a time'
                        }
                        disabled={expandDisabled}
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
    zIndex: 20000,
    elevation: 20000,
    overflow: 'visible',
  },
  inner: {
    width: '100%',
    overflow: 'visible',
  },
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
  layoutMenuInGlassSlot: {
    width: LAYOUT_MENU_ORB_SIZE,
    height: LAYOUT_MENU_ORB_SIZE,
    marginRight: -EXPAND_SHIFT_LEFT,
    overflow: 'visible',
  },
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
  expandPressableDisabled: {
    opacity: 0.5,
  },
  expandPressablePressed: {
    opacity: 0.92,
  },
  expandFallbackNudge: {
    marginLeft: -EXPAND_SHIFT_LEFT,
  },
  tripleGlass: {
    width: TRIPLE_PILL_WIDTH,
    minWidth: TRIPLE_PILL_WIDTH,
    height: PILL_TRACK_HEIGHT,
    borderRadius: 26,
    overflow: 'visible',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
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

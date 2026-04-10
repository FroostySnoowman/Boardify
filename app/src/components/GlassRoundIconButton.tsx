import React, { useMemo } from 'react';
import { Pressable, View, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme';

export type GlassRoundIconButtonProps = {
  icon: keyof typeof Feather.glyphMap;
  size?: number;
  onPress: () => void;
  accessibilityLabel: string;
  hitSlop?: number;
  disabled?: boolean;
  embedInSwiftMenu?: boolean;
  iconOpticalNudge?: { x?: number; y?: number };
};

export function GlassRoundIconButton({
  icon,
  size = 22,
  onPress,
  accessibilityLabel,
  hitSlop = 12,
  disabled,
  embedInSwiftMenu,
  iconOpticalNudge,
}: GlassRoundIconButtonProps) {
  const { colors, resolvedScheme } = useTheme();
  const isGlass =
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable() &&
    !(embedInSwiftMenu && Platform.OS === 'ios');
  const glassScheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);
  const glassTint =
    resolvedScheme === 'dark' ? 'rgba(40, 38, 36, 0.72)' : 'rgba(255, 255, 255, 0.42)';

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        fallback: {
          borderWidth: 1,
          borderColor: colors.glassFallbackBorder,
          backgroundColor: colors.glassFallbackBg,
        },
      }),
    [colors.glassFallbackBg, colors.glassFallbackBorder]
  );

  const feather = <Feather name={icon} size={size} color={colors.iconPrimary} />;
  const hasNudge =
    iconOpticalNudge != null &&
    (iconOpticalNudge.x != null || iconOpticalNudge.y != null);
  const glyph =
    embedInSwiftMenu && Platform.OS === 'ios' ? (
      <View style={styles.menuLabelGlyphNudge} collapsable={false}>
        {feather}
      </View>
    ) : hasNudge ? (
      <View
        style={[
          styles.iconOpticalWrap,
          {
            transform: [
              { translateX: iconOpticalNudge?.x ?? 0 },
              { translateY: iconOpticalNudge?.y ?? 0 },
            ],
          },
        ]}
        collapsable={false}
      >
        {feather}
      </View>
    ) : (
      feather
    );

  const face = isGlass ? (
    <GlassView
      isInteractive
      colorScheme={glassScheme}
      tintColor={glassTint}
      style={styles.circle}
    >
      {glyph}
    </GlassView>
  ) : (
    <View
      style={[
        styles.circle,
        embedInSwiftMenu && Platform.OS === 'ios' ? styles.swiftMenuLabel : dynamicStyles.fallback,
      ]}
    >
      {glyph}
    </View>
  );

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={styles.pressable}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    opacity: 1,
    overflow: 'visible',
  },
  circle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  swiftMenuLabel: {
    backgroundColor: 'transparent',
  },
  menuLabelGlyphNudge: {
    transform: [{ translateX: -11 }, { translateY: -6 }],
  },
  iconOpticalWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

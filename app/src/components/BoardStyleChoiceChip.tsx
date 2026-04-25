import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

/** Matches `BoardStyleActionButton` offset so the selected face reads “pressed in”. */
const SHIFT = 5;

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function BoardStyleChoiceChip({ label, selected, onPress }: Props) {
  const { colors } = useTheme();
  const themed = useMemo(
    () =>
      StyleSheet.create({
        shadow: {
          position: 'absolute',
          left: SHIFT,
          top: SHIFT,
          right: -SHIFT,
          bottom: -SHIFT,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 0,
          backgroundColor: colors.shadowFill,
        },
        face: {
          position: 'relative',
          zIndex: 1,
          elevation: 3,
          backgroundColor: colors.surfaceElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          paddingHorizontal: 10,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
        },
        facePressed: {
          transform: [{ translateX: SHIFT }, { translateY: SHIFT }],
        },
        label: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.textPrimary,
          textAlign: 'center',
        },
      }),
    [colors]
  );

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={themed.shadow} pointerEvents="none" />
      <View style={[themed.face, selected && themed.facePressed]}>
        <Text style={themed.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    marginBottom: SHIFT,
  },
});

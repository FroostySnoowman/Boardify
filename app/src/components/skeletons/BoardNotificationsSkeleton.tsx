import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SkeletonBlock } from './SkeletonBlock';
import { useTheme } from '../../theme';

function ToggleRowSkeleton({
  hasSublabel,
  styles,
}: {
  hasSublabel?: boolean;
  styles: { toggleRow: object; toggleText: object };
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <SkeletonBlock height={17} width="70%" borderRadius={5} variant="onWhite" />
        {hasSublabel ? (
          <SkeletonBlock
            height={14}
            width="90%"
            borderRadius={5}
            variant="onWhite"
            style={{ marginTop: 6 }}
          />
        ) : null}
      </View>
      <SkeletonBlock width={51} height={31} borderRadius={16} variant="onWhite" />
    </View>
  );
}

export function BoardNotificationsSkeleton() {
  const { colors } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          alignSelf: 'stretch',
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: colors.border,
          padding: 24,
        },
        section: {
          marginTop: 22,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.calendarGridLine,
          marginVertical: 4,
        },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 6,
        },
        toggleText: {
          flex: 1,
          minWidth: 0,
          paddingRight: 8,
        },
        timeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 8,
        },
      }),
    [colors]
  );

  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

  return (
    <View style={[s.card, cardShadow]}>
      <SkeletonBlock height={16} width="100%" borderRadius={5} variant="onWhite" />
      <SkeletonBlock
        height={16}
        width="95%"
        borderRadius={5}
        variant="onWhite"
        style={{ marginTop: 8 }}
      />
      <SkeletonBlock
        height={16}
        width="60%"
        borderRadius={5}
        variant="onWhite"
        style={{ marginTop: 8, marginBottom: 8 }}
      />

      <View style={s.section}>
        <SkeletonBlock
          height={12}
          width={88}
          borderRadius={4}
          variant="onWhite"
          style={{ marginBottom: 12 }}
        />
        <ToggleRowSkeleton hasSublabel styles={s} />
        <View style={s.divider} />
        <ToggleRowSkeleton hasSublabel styles={s} />
      </View>

      <View style={s.section}>
        <SkeletonBlock
          height={12}
          width={140}
          borderRadius={4}
          variant="onWhite"
          style={{ marginBottom: 12 }}
        />
        <ToggleRowSkeleton styles={s} />
        <View style={s.divider} />
        <ToggleRowSkeleton styles={s} />
        <View style={s.divider} />
        <ToggleRowSkeleton styles={s} />
        <View style={s.divider} />
        <ToggleRowSkeleton styles={s} />
      </View>

      <View style={s.section}>
        <SkeletonBlock
          height={12}
          width={100}
          borderRadius={4}
          variant="onWhite"
          style={{ marginBottom: 12 }}
        />
        <ToggleRowSkeleton hasSublabel styles={s} />
        <View style={s.divider} />
        <View style={s.timeRow}>
          <SkeletonBlock height={16} width={100} borderRadius={5} variant="onWhite" />
          <SkeletonBlock height={36} width={120} borderRadius={8} variant="onWhite" />
        </View>
        <View style={s.divider} />
        <View style={s.timeRow}>
          <SkeletonBlock height={16} width={88} borderRadius={5} variant="onWhite" />
          <SkeletonBlock height={36} width={120} borderRadius={8} variant="onWhite" />
        </View>
      </View>
    </View>
  );
}

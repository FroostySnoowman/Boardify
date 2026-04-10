import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBlock } from './SkeletonBlock';
import { getNeuListRowCardBase } from '../NeuListRowPressable';
import { useTheme } from '../../theme';

type Props = {
  contentPaddingTop: number;
  contentPaddingBottom: number;
  horizontalPadding: number;
  isWeb?: boolean;
};

function BoardRowSkeleton({
  shadowTint,
}: {
  shadowTint: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(
    () =>
      StyleSheet.create({
        rowWrap: {
          position: 'relative',
        },
        neuShadow: {
          position: 'absolute',
          left: 5,
          top: 5,
          right: -5,
          bottom: -5,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        boardFace: {
          flexDirection: 'row',
          alignItems: 'center',
        },
      }),
    [colors.border]
  );

  return (
    <View style={s.rowWrap}>
      <View style={[s.neuShadow, { backgroundColor: shadowTint }]} />
      <View style={[getNeuListRowCardBase(colors), s.boardFace]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SkeletonBlock height={20} width="85%" borderRadius={6} />
        </View>
        <SkeletonBlock height={18} width={18} borderRadius={4} />
      </View>
    </View>
  );
}

export function HomeScreenSkeleton({
  contentPaddingTop,
  contentPaddingBottom,
  horizontalPadding,
  isWeb = false,
}: Props) {
  const { colors } = useTheme();
  const shadows = ['#c5e1c5', '#e8d4b8', '#c9b8e0', '#d4d4d4', '#b8d4e8'];

  const s = useMemo(
    () =>
      StyleSheet.create({
        hero: {
          marginBottom: 28,
        },
        section: {
          marginBottom: 24,
        },
        grid: {
          gap: 12,
        },
        rowWrap: {
          position: 'relative',
        },
        neuShadow: {
          position: 'absolute',
          left: 5,
          top: 5,
          right: -5,
          bottom: -5,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        createFace: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: colors.columnSurface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 20,
          paddingHorizontal: 24,
        },
      }),
    [colors]
  );

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: contentPaddingTop,
        paddingBottom: contentPaddingBottom,
        paddingHorizontal: horizontalPadding,
        flexGrow: 1,
        maxWidth: isWeb ? 800 : undefined,
        alignSelf: isWeb ? 'center' : undefined,
        width: '100%',
      }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      <View style={s.hero}>
        <SkeletonBlock height={32} width={120} borderRadius={8} />
        <SkeletonBlock height={18} width={260} borderRadius={6} style={{ marginTop: 10 }} />
      </View>
      <View style={s.section}>
        <SkeletonBlock height={14} width={96} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={s.grid}>
          {shadows.map((c, i) => (
            <BoardRowSkeleton key={i} shadowTint={c} />
          ))}
          <View style={s.rowWrap}>
            <View style={[s.neuShadow, { backgroundColor: colors.shadowFill, opacity: 0.35 }]} />
            <View style={[getNeuListRowCardBase(colors), s.createFace]}>
              <SkeletonBlock height={22} width={22} borderRadius={6} />
              <SkeletonBlock height={16} width={100} borderRadius={6} style={{ marginLeft: 10 }} />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

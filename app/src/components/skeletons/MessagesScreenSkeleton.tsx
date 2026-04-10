import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  NEU_LIST_ROW_SHIFT,
  getNeuListRowCardBase,
  neuListRowShadowBase,
} from '../NeuListRowPressable';
import { SkeletonBlock } from './SkeletonBlock';
import { useTheme } from '../../theme';

const ACCENTS = ['#a5d6a5', '#F3D9B1', '#b39ddb', '#d0d0d0', '#c4c4c4'];

const NOTIFICATION_FACE = {
  alignItems: 'flex-start' as const,
  paddingVertical: 14,
  paddingHorizontal: 14,
  overflow: 'hidden' as const,
};

function RowSkeleton({
  accent,
  showUnread,
}: {
  accent: string;
  showUnread: boolean;
}) {
  const { colors } = useTheme();
  const row = useMemo(
    () =>
      StyleSheet.create({
        neuWrap: {
          position: 'relative',
          marginRight: NEU_LIST_ROW_SHIFT,
          marginBottom: NEU_LIST_ROW_SHIFT,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        rowText: {
          flex: 1,
          minWidth: 0,
          paddingRight: 8,
        },
        headlineRow: {
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 0,
        },
        headlineRest: {
          flex: 1,
          minWidth: 0,
          marginLeft: 4,
        },
        rowRight: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'center',
        },
        timeStack: {
          alignItems: 'flex-end',
          gap: 4,
        },
      }),
    [colors]
  );

  const leftBar = { borderLeftWidth: 4 as const, borderLeftColor: accent };

  return (
    <View style={row.neuWrap}>
      <View style={[neuListRowShadowBase, { backgroundColor: accent }]} />
      <View style={[getNeuListRowCardBase(colors), NOTIFICATION_FACE, leftBar]}>
        <View style={row.avatar}>
          <SkeletonBlock width={22} height={22} borderRadius={6} variant="warm" />
        </View>
        <View style={row.rowText}>
          <View style={row.headlineRow}>
            <SkeletonBlock height={15} width={68} borderRadius={5} variant="onWhite" />
            <View style={row.headlineRest}>
              <SkeletonBlock height={15} width="100%" borderRadius={5} variant="onWhite" />
            </View>
          </View>
          <SkeletonBlock
            height={13}
            width="72%"
            borderRadius={5}
            variant="onWhite"
            style={{ marginTop: 4 }}
          />
        </View>
        <View style={row.rowRight}>
          <View style={row.timeStack}>
            <SkeletonBlock height={12} width={38} borderRadius={4} variant="onWhite" />
            {showUnread ? (
              <SkeletonBlock width={8} height={8} borderRadius={4} variant="onWhite" />
            ) : null}
          </View>
          <SkeletonBlock width={18} height={18} borderRadius={4} variant="onWhite" />
        </View>
      </View>
    </View>
  );
}

/** Card rows only; parent screen supplies title, subtitle, and “Recent” like loaded state. */
export function MessagesScreenSkeleton() {
  return (
    <>
      {ACCENTS.map((a, i) => (
        <RowSkeleton key={i} accent={a} showUnread={i < 2} />
      ))}
    </>
  );
}

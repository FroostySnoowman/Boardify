import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { BOARD_GLASS_BOTTOM_BAR_CLEARANCE } from '../BoardGlassBottomBar';
import { SkeletonBlock } from './SkeletonBlock';
import { useTheme } from '../../theme';

const HEADER_H = 69;
const HEADER_ORB = 45;
const COL_W = 280;
const COL_GAP = 16;
const CARD_H = 88;

/** Matches BoardColumn: COLUMN_SHIFT 5, column shadow, grey inner shell. */
const COL_SHIFT = 5;

export function BoardScreenSkeleton({
  paddingTop,
  bottomInset,
  horizontalPadding = 16,
  titleBarWidth = 168,
}: {
  paddingTop: number;
  bottomInset: number;
  horizontalPadding?: number;
  titleBarWidth?: number;
}) {
  const { colors } = useTheme();
  const stripBottomPad = 24 + bottomInset + BOARD_GLASS_BOTTOM_BAR_CLEARANCE;

  const sheet = useMemo(() => {
    const s = StyleSheet.create({
      root: {
        flex: 1,
        backgroundColor: colors.boardHeaderBg,
        overflow: 'visible',
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.boardHeaderBg,
        zIndex: 20,
        overflow: 'visible',
      },
      headerSide: {
        width: HEADER_ORB,
        alignItems: 'flex-start',
        overflow: 'visible',
        zIndex: 2,
      },
      headerSideEnd: {
        alignItems: 'flex-end',
      },
      titleSlot: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        paddingHorizontal: 8,
      },
      boardArea: {
        flex: 1,
        minHeight: 0,
        overflow: 'visible',
      },
      columnsScrollView: {
        flexGrow: 1,
        zIndex: 0,
      },
      stripContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
    });

    const col = StyleSheet.create({
      outer: {
        position: 'relative',
        width: COL_W,
        flexShrink: 0,
      },
      columnShadow: {
        position: 'absolute',
        left: COL_SHIFT,
        top: COL_SHIFT,
        right: -COL_SHIFT,
        bottom: -COL_SHIFT,
        backgroundColor: colors.shadowFillColumn,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
      },
      columnFace: {
        position: 'relative',
        zIndex: 1,
        backgroundColor: colors.columnSurface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 12,
        paddingHorizontal: 12,
      },
      listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
        paddingVertical: 4,
      },
      cardList: {
        paddingBottom: 4,
      },
      addCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 8,
        marginTop: 4,
      },
    });

    const card = StyleSheet.create({
      wrap: {
        position: 'relative',
        marginBottom: 4,
        marginRight: 4,
      },
      shadow: {
        position: 'absolute',
        left: 4,
        top: 4,
        right: -4,
        bottom: -4,
        backgroundColor: colors.shadowFillColumn,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
      },
      face: {
        position: 'relative',
        zIndex: 1,
        minHeight: CARD_H,
        backgroundColor: colors.cardFaceOnColumn,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 10,
        paddingHorizontal: 12,
        justifyContent: 'center',
      },
    });

    return { s, col, card };
  }, [colors]);

  const CardSkeleton = () => (
    <View style={sheet.card.wrap}>
      <View style={sheet.card.shadow} />
      <View style={sheet.card.face}>
        <SkeletonBlock height={16} width="88%" borderRadius={4} variant="onWhite" />
        <SkeletonBlock
          height={13}
          width="45%"
          borderRadius={4}
          variant="onWhite"
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  );

  const ColumnSkeleton = ({ cardCount }: { cardCount: number }) => (
    <View style={[sheet.col.outer, { marginRight: COL_GAP }]}>
      <View style={sheet.col.columnShadow} />
      <View style={sheet.col.columnFace}>
        <View style={sheet.col.listHeader}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <SkeletonBlock height={17} width="75%" borderRadius={6} variant="warm" />
          </View>
          <SkeletonBlock height={15} width={22} borderRadius={5} variant="warm" />
        </View>
        <View style={sheet.col.cardList}>
          {Array.from({ length: cardCount }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
        <View style={sheet.col.addCard}>
          <SkeletonBlock width={18} height={18} borderRadius={5} variant="warm" />
          <SkeletonBlock height={14} width={64} borderRadius={4} variant="warm" />
        </View>
      </View>
    </View>
  );

  return (
    <View style={[sheet.s.root, { paddingTop }]}>
      <View style={[sheet.s.header, { height: HEADER_H }]}>
        <View style={sheet.s.headerSide}>
          <SkeletonBlock
            width={HEADER_ORB}
            height={HEADER_ORB}
            borderRadius={HEADER_ORB / 2}
          />
        </View>
        <View style={sheet.s.titleSlot}>
          <SkeletonBlock height={26} width={titleBarWidth} borderRadius={6} />
        </View>
        <View style={[sheet.s.headerSide, sheet.s.headerSideEnd]}>
          <SkeletonBlock
            width={HEADER_ORB}
            height={HEADER_ORB}
            borderRadius={HEADER_ORB / 2}
          />
        </View>
      </View>
      <View style={sheet.s.boardArea}>
        <ScrollView
          horizontal
          style={sheet.s.columnsScrollView}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            sheet.s.stripContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: stripBottomPad,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <ColumnSkeleton cardCount={2} />
          <ColumnSkeleton cardCount={3} />
        </ScrollView>
      </View>
    </View>
  );
}

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBlock } from './SkeletonBlock';

const HEADER_H = 69;
const COL_W = 280;
const COL_GAP = 16;
const CARD_H = 88;
const BOTTOM_PAD = 110;

/** Matches BoardColumn: COLUMN_SHIFT 5, column shadow, grey inner shell. */
const COL_SHIFT = 5;

function CardSkeleton() {
  return (
    <View style={card.wrap}>
      <View style={card.shadow} />
      <View style={card.face}>
        <SkeletonBlock height={16} width="88%" borderRadius={4} variant="onWhite" />
        <SkeletonBlock height={13} width="45%" borderRadius={4} variant="onWhite" style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

function ColumnSkeleton({ cardCount }: { cardCount: number }) {
  return (
    <View style={[col.outer, { marginRight: COL_GAP }]}>
      <View style={col.columnShadow} />
      <View style={col.columnFace}>
        <View style={col.listHeader}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <SkeletonBlock height={17} width="75%" borderRadius={6} variant="warm" />
          </View>
          <SkeletonBlock height={15} width={22} borderRadius={5} variant="warm" />
        </View>
        <View style={col.cardList}>
          {Array.from({ length: cardCount }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
        <View style={col.addCard}>
          <SkeletonBlock width={18} height={18} borderRadius={5} variant="warm" />
          <SkeletonBlock height={14} width={64} borderRadius={4} variant="warm" />
        </View>
      </View>
    </View>
  );
}

export function BoardScreenSkeleton({
  paddingTop,
  titleBarWidth = 168,
}: {
  paddingTop: number;
  titleBarWidth?: number;
}) {
  return (
    <View style={[s.root, { paddingTop }]}>
      <View style={s.header}>
        <SkeletonBlock width={44} height={44} borderRadius={22} />
        <View style={s.titleSlot}>
          <SkeletonBlock height={22} width={titleBarWidth} borderRadius={6} />
        </View>
        <View style={s.headerEnd}>
          <SkeletonBlock width={44} height={44} borderRadius={22} />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.stripContent}
        keyboardShouldPersistTaps="handled"
      >
        <ColumnSkeleton cardCount={2} />
        <ColumnSkeleton cardCount={3} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f0e8',
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: HEADER_H,
    backgroundColor: '#f5f0e8',
    zIndex: 20,
  },
  titleSlot: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 44,
  },
  stripContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: BOTTOM_PAD,
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
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  columnFace: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
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
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
  },
  face: {
    position: 'relative',
    zIndex: 1,
    minHeight: CARD_H,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
});

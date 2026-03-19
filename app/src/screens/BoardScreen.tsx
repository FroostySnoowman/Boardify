import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { BoardColumn } from '../components/BoardColumn';
import {
  BoardCardExpandOverlay,
  type ExpandedCardData,
} from '../components/BoardCardExpandOverlay';

const SHIFT = 5;

const MOCK_COLUMNS = [
  {
    title: 'To Do',
    cards: [
      { title: 'Review design mockups', subtitle: 'Due Fri', labelColor: '#F3D9B1' },
      { title: 'Sync with backend API', labelColor: '#a5d6a5' },
      { title: 'Update onboarding flow' },
    ],
  },
  {
    title: 'In Progress',
    cards: [
      { title: 'Board view layout', subtitle: 'You', labelColor: '#a5d6a5' },
      { title: 'Card drag-and-drop', labelColor: '#F3D9B1' },
    ],
  },
  {
    title: 'Done',
    cards: [
      { title: 'Auth & login screen' },
      { title: 'Home screen shell' },
      { title: 'Neubrutalist theme' },
    ],
  },
];

interface BoardScreenProps {
  boardName?: string;
  onBack?: () => void;
}

export default function BoardScreen({ boardName = 'My Board', onBack }: BoardScreenProps) {
  const insets = useSafeAreaInsets();
  const [columns] = useState(MOCK_COLUMNS);
  const [expanded, setExpanded] = useState<ExpandedCardData | null>(null);
  const isWeb = Platform.OS === 'web';

  const handleCardPress = useCallback(
    (
      columnIndex: number,
      cardIndex: number,
      layout: { x: number; y: number; width: number; height: number }
    ) => {
      const col = columns[columnIndex];
      const card = col?.cards[cardIndex];
      if (!col || !card) return;
      setExpanded({
        title: card.title,
        subtitle: card.subtitle,
        labelColor: card.labelColor,
        columnTitle: col.title,
        layout,
        columnIndex,
        cardIndex,
      });
    },
    [columns]
  );

  const expandedCardKey =
    expanded == null ? null : `${expanded.columnIndex}-${expanded.cardIndex}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              onBack();
            }}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={24} color="#0a0a0a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{boardName}</Text>
        <TouchableOpacity
          onPress={() => hapticLight()}
          style={styles.menuBtn}
        >
          <Feather name="more-horizontal" size={22} color="#0a0a0a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.columnsScroll,
          { paddingHorizontal: isWeb ? 24 : 16 },
        ]}
        style={styles.columnsScrollView}
      >
        {columns.map((col, i) => (
          <BoardColumn
            key={i}
            columnIndex={i}
            title={col.title}
            cards={col.cards}
            onAddCard={() => {}}
            expandedCardKey={expandedCardKey}
            onCardPress={(cardIndex, layout) => handleCardPress(i, cardIndex, layout)}
          />
        ))}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => hapticLight()}
          style={styles.addListWrap}
        >
          <View style={styles.addListShadow} />
          <View style={styles.addList}>
            <Feather name="plus" size={20} color="#666" />
            <Text style={styles.addListText}>Add list</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {expanded ? (
        <BoardCardExpandOverlay data={expanded} onClose={() => setExpanded(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  menuBtn: {
    padding: 4,
  },
  columnsScrollView: {
    flexGrow: 1,
  },
  columnsScroll: {
    paddingBottom: 24,
    alignItems: 'flex-start',
  },
  addListWrap: {
    position: 'relative',
    width: 280,
    flexShrink: 0,
    marginLeft: 0,
  },
  addListShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  addList: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    paddingHorizontal: 24,
    minHeight: 120,
  },
  addListText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});

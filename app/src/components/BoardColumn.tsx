import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { BoardCard, type BoardCardProps } from './BoardCard';

const COLUMN_SHIFT = 5;

export interface BoardColumnProps {
  title: string;
  cards: Array<Pick<BoardCardProps, 'title' | 'subtitle' | 'labelColor'>>;
  onAddCard?: () => void;
  onCardPress?: (index: number, layout: { x: number; y: number; width: number; height: number }) => void;
  expandedCardKey?: string | null;
  columnIndex: number;
}

export function BoardColumn({ title, cards, onAddCard, onCardPress, expandedCardKey, columnIndex }: BoardColumnProps) {
  const cardRefs = useRef<(React.ElementRef<typeof BoardCard> | null)[]>([]);
  const handleAddCard = () => {
    hapticLight();
    onAddCard?.();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.shadow} />
      <View style={styles.column}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.count}>{cards.length}</Text>
        </View>
        <View style={styles.cardList}>
          {cards.map((card, i) => (
            <BoardCard
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              title={card.title}
              subtitle={card.subtitle}
              labelColor={card.labelColor}
              hidden={expandedCardKey === `${columnIndex}-${i}`}
              onPress={() => {
                const node = cardRefs.current[i];
                if (!node || !onCardPress) return;
                node.measureInWindow((x, y, width, height) => {
                  onCardPress(i, { x, y, width, height });
                });
              }}
            />
          ))}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddCard}
            style={styles.addCard}
          >
            <Feather name="plus" size={18} color="#666" />
            <Text style={styles.addCardText}>Add card</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: 280,
    marginRight: 16,
    flexShrink: 0,
  },
  shadow: {
    position: 'absolute',
    left: COLUMN_SHIFT,
    top: COLUMN_SHIFT,
    right: -COLUMN_SHIFT,
    bottom: -COLUMN_SHIFT,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  column: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 12,
    maxHeight: 520,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
    flex: 1,
  },
  count: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  cardList: {
    flexGrow: 1,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  addCardText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

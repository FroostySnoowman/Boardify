import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { PlatformBottomSheet } from './PlatformBottomSheet';

interface ActionItem {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  visible?: boolean;
}

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  actions: ActionItem[];
  quickReactions?: string[];
  onQuickReaction?: (emoji: string) => void;
}

const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export function MessageActionSheet({
  visible,
  onClose,
  actions,
  quickReactions = DEFAULT_QUICK_REACTIONS,
  onQuickReaction,
}: MessageActionSheetProps) {
  const visibleActions = actions.filter(a => a.visible !== false);

  const rowCount = visibleActions.length + (onQuickReaction ? 1 : 0);
  const estimatedDetent = Math.min(0.55, 0.06 + rowCount * 0.06);

  return (
    <PlatformBottomSheet
      isOpened={visible}
      onIsOpenedChange={(opened) => !opened && onClose()}
      presentationDetents={[estimatedDetent]}
      presentationDragIndicator="visible"
    >
      {onQuickReaction && (
        <View style={s.reactionsBar}>
          {quickReactions.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => {
                hapticLight();
                onQuickReaction(emoji);
                onClose();
              }}
              style={s.reactionButton}
              activeOpacity={0.6}
            >
              <Text style={s.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {visibleActions.map((action, index) => (
        <TouchableOpacity
          key={action.label}
          onPress={() => {
            hapticLight();
            action.onPress();
            onClose();
          }}
          style={[
            s.actionRow,
            index < visibleActions.length - 1 && s.actionRowBorder,
          ]}
          activeOpacity={0.6}
        >
          <Feather
            name={action.icon as any}
            size={18}
            color={action.destructive ? '#ef4444' : '#e2e8f0'}
          />
          <Text
            style={[
              s.actionLabel,
              action.destructive && s.actionLabelDestructive,
            ]}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </PlatformBottomSheet>
  );
}

const s = StyleSheet.create({
  reactionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionLabel: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  actionLabelDestructive: {
    color: '#ef4444',
  },
});

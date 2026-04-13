import React, { forwardRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';
import type { TaskLabel, TaskMember } from '../types/board';

const CARD_SHIFT = 4;

export interface BoardCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  labelColor?: string;
  priorities?: TaskLabel[];
  assignees?: TaskMember[];
  onPress?: () => void;
  hidden?: boolean;
  suppressPress?: boolean;
}

export const BoardCard = forwardRef<View, BoardCardProps>(function BoardCard(
  { title, subtitle, description, labelColor, priorities, assignees, onPress, hidden, suppressPress },
  ref
) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: 'relative',
          marginBottom: CARD_SHIFT,
          marginRight: CARD_SHIFT,
        },
        pressable: {
          position: 'relative',
        },
        shadow: {
          position: 'absolute',
          left: CARD_SHIFT,
          top: CARD_SHIFT,
          right: -CARD_SHIFT,
          bottom: -CARD_SHIFT,
          backgroundColor: colors.shadowFillColumn,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        card: {
          position: 'relative',
          zIndex: 1,
          backgroundColor: colors.cardFaceOnColumn,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        title: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.textPrimary,
          lineHeight: 18,
        },
        subtitle: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 4,
          lineHeight: 16,
          fontWeight: '400',
        },
        metaRow: {
          marginTop: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 18,
        },
        priorityChip: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
          maxWidth: '55%',
        },
        priorityText: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '700',
          color: '#111827',
        },
        descHint: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          minWidth: 0,
        },
        descText: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '600',
          color: colors.textTertiary,
          flexShrink: 1,
        },
        assigneeCluster: {
          marginLeft: 'auto',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        },
        assigneeBubble: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.canvas,
        },
        assigneeInitials: {
          fontSize: 10,
          fontWeight: '800',
          color: colors.textSecondary,
        },
        assigneeCount: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.textTertiary,
        },
      }),
    [colors]
  );

  const handlePress = () => {
    hapticLight();
    onPress?.();
  };

  const primaryPriority = priorities?.[0];
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  const descriptionPreview = hasDescription ? description!.trim().replace(/\s+/g, ' ') : '';
  const displayAssignees = assignees?.slice(0, 1) ?? [];
  const extraAssignees = Math.max(0, (assignees?.length ?? 0) - displayAssignees.length);
  const showMeta = Boolean(primaryPriority || hasDescription || (assignees?.length ?? 0) > 0);

  const face = (
    <>
      <View style={styles.shadow} pointerEvents="none" />
      <View style={[styles.card, labelColor ? { borderLeftWidth: 4, borderLeftColor: labelColor } : undefined]}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
        {showMeta ? (
          <View style={styles.metaRow}>
            {primaryPriority ? (
              <View style={[styles.priorityChip, { backgroundColor: primaryPriority.color }]}>
                <Text style={styles.priorityText} numberOfLines={1}>
                  {primaryPriority.name}
                </Text>
              </View>
            ) : null}
            {hasDescription ? (
              <View style={styles.descHint}>
                <Feather name="align-left" size={12} color={colors.iconMuted} />
                <Text style={styles.descText} numberOfLines={1}>
                  {descriptionPreview}
                </Text>
              </View>
            ) : null}
            {(assignees?.length ?? 0) > 0 ? (
              <View style={styles.assigneeCluster}>
                {displayAssignees.map((m) => (
                  <View key={m.id} style={styles.assigneeBubble}>
                    <Text style={styles.assigneeInitials}>{m.initials}</Text>
                  </View>
                ))}
                {extraAssignees > 0 ? <Text style={styles.assigneeCount}>+{extraAssignees}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.wrap, { opacity: hidden ? 0 : 1 }]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      {suppressPress ? (
        <View style={styles.pressable}>{face}</View>
      ) : (
        <Pressable onPress={handlePress} style={styles.pressable}>
          {face}
        </Pressable>
      )}
    </View>
  );
});

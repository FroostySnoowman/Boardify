import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface AnnouncementMessageProps {
  content: string;
  senderName: string;
}

export function AnnouncementMessage({ content, senderName }: AnnouncementMessageProps) {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Feather name="volume-2" size={13} color="#f59e0b" />
        <Text style={s.badge}>Announcement</Text>
      </View>

      <View style={s.body}>
        <Text style={s.content}>{content}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245, 158, 11, 0.15)',
  },
  badge: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  content: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
});

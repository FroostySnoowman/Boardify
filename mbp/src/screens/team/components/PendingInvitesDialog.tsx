import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { listJoinRequests, approveJoinRequest, denyJoinRequest, JoinRequest } from '../../../api/teams';
import { Skeleton } from '../../../components';
import { hapticLight } from '../../../utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet';

interface PendingInvitesDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
}

export default function PendingInvitesDialog({
  open,
  onClose,
  teamId,
}: PendingInvitesDialogProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listJoinRequests(teamId)
      .then(setRequests)
      .catch((e: any) => console.error('Failed to load requests:', e))
      .finally(() => setLoading(false));
  }, [open, teamId]);

  const handleApprove = async (userId: string) => {
    try {
      hapticLight();
      await approveJoinRequest(teamId, userId);
      setRequests(prev => prev.filter(r => r.userId !== userId));
    } catch (e: any) {
      console.error('Failed to approve request:', e);
    }
  };

  const handleDeny = async (userId: string) => {
    try {
      hapticLight();
      await denyJoinRequest(teamId, userId);
      setRequests(prev => prev.filter(r => r.userId !== userId));
    } catch (e: any) {
      console.error('Failed to deny request:', e);
    }
  };

  const filtered = requests.filter(r =>
    r.username.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PlatformBottomSheet
      isOpened={open}
      onIsOpenedChange={(opened) => { if (!opened) onClose(); }}
      presentationDetents={[0.65]}
      presentationDragIndicator="visible"
    >
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Pending Join Requests</Text>
        </View>

        <View style={s.searchContainer}>
          <Feather name="search" size={16} color="#64748b" style={s.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search requests..."
            placeholderTextColor="#64748b"
            style={s.searchInput}
          />
        </View>

        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 64, width: '100%', borderRadius: 12 }} />
            ))
          ) : filtered.length > 0 ? (
            filtered.map(r => (
              <View key={r.userId} style={s.requestCard}>
                <View style={s.requestInfo}>
                  <Text style={s.requestName} numberOfLines={1}>
                    {r.username}
                  </Text>
                  <Text style={s.requestMeta} numberOfLines={1}>
                    {r.email} · {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity
                    onPress={() => handleApprove(r.userId)}
                    style={s.approveBtn}
                    activeOpacity={0.7}
                  >
                    <Feather name="check" size={16} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeny(r.userId)}
                    style={s.denyBtn}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={s.emptyState}>
              <Feather name="inbox" size={36} color="#475569" />
              <Text style={s.emptyText}>No pending requests</Text>
            </View>
          )}
          <KeyboardSpacer extraOffset={16} />
        </ScrollView>
      </View>
    </PlatformBottomSheet>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 8,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  requestInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 14,
  },
  requestName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  requestMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  denyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { 
  listMembers, 
  Member, 
  listJoinRequests,
  Ladder,
  LadderEntry,
  LadderFormat,
  listLadders,
  deleteLadder,
  listLadderEntries,
  removeLadderEntry,
  reorderLadderEntries,
  Lineup,
  LineupEntry,
  listLineups,
  deleteLineup,
  listLineupEntries,
  removeLineupEntry,
  reorderLineupEntries
} from '../../api/teams';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { PendingInvitesDialog } from './components';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

interface RosterScreenProps {
  teamId?: string;
}

const roleIcons: Record<string, keyof typeof Feather.glyphMap> = {
  owner: 'award',
  coach: 'zap',
  player: 'user',
  family: 'users',
  spectator: 'eye',
};

const roleColors: Record<string, string> = {
  owner: '#3b82f6',
  coach: '#22c55e',
  player: '#3b82f6',
  family: '#22c55e',
  spectator: '#9ca3af',
};

type RosterTab = 'members' | 'ladders' | 'lineups';

export default function RosterScreen({ teamId }: RosterScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RosterTab>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [invitesOpen, setInvitesOpen] = useState(false);

  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [laddersLoading, setLaddersLoading] = useState(false);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [ladderEntries, setLadderEntries] = useState<LadderEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [lineupsLoading, setLineupsLoading] = useState(false);
  const [selectedLineup, setSelectedLineup] = useState<Lineup | null>(null);
  const [lineupEntries, setLineupEntries] = useState<LineupEntry[]>([]);
  const [lineupEntriesLoading, setLineupEntriesLoading] = useState(false);

  const [selectedLadderFormat, setSelectedLadderFormat] = useState<LadderFormat>('singles');
  const [selectedLineupFormat, setSelectedLineupFormat] = useState<LadderFormat>('singles');

  const loadMembers = useCallback(() => {
    if (!teamId) return;
    setLoading(true);
    listMembers(teamId)
      .then(ms => setMembers(ms))
      .catch((e: any) => console.error('Failed to load members:', e))
      .finally(() => setLoading(false));
  }, [teamId]);

  const loadLadders = useCallback(async () => {
    if (!teamId) return;
    setLaddersLoading(true);
    try {
      const result = await listLadders(teamId);
      setLadders(result);
    } catch (e: any) {
      console.error('Failed to load ladders:', e);
    } finally {
      setLaddersLoading(false);
    }
  }, [teamId]);

  const loadLadderEntries = useCallback(async (ladderId: string, format: LadderFormat) => {
    if (!teamId) return;
    setEntriesLoading(true);
    try {
      const result = await listLadderEntries(teamId, ladderId, format);
      setLadderEntries(result);
    } catch (e: any) {
      console.error('Failed to load ladder entries:', e);
    } finally {
      setEntriesLoading(false);
    }
  }, [teamId]);

  const loadLineups = useCallback(async () => {
    if (!teamId) return;
    setLineupsLoading(true);
    try {
      const result = await listLineups(teamId);
      setLineups(result);
    } catch (e: any) {
      console.error('Failed to load lineups:', e);
    } finally {
      setLineupsLoading(false);
    }
  }, [teamId]);

  const loadLineupEntries = useCallback(async (rosterId: string, format: LadderFormat) => {
    if (!teamId) return;
    setLineupEntriesLoading(true);
    try {
      const result = await listLineupEntries(teamId, rosterId, format);
      setLineupEntries(result);
    } catch (e: any) {
      console.error('Failed to load lineup entries:', e);
    } finally {
      setLineupEntriesLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (activeTab === 'ladders') {
      loadLadders();
    }
  }, [activeTab, loadLadders]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'ladders') {
        const promises: Promise<any>[] = [loadLadders()];
        if (selectedLadder) promises.push(loadLadderEntries(selectedLadder.id, selectedLadderFormat));
        Promise.all(promises).catch(err => console.error('Failed to load ladder data:', err));
      }
      if (activeTab === 'lineups') {
        const promises: Promise<any>[] = [loadLineups()];
        if (selectedLineup) promises.push(loadLineupEntries(selectedLineup.id, selectedLineupFormat));
        Promise.all(promises).catch(err => console.error('Failed to load lineup data:', err));
      }
    }, [activeTab, loadLadders, selectedLadder, selectedLadderFormat, loadLadderEntries, loadLineups, selectedLineup, selectedLineupFormat, loadLineupEntries])
  );

  useEffect(() => {
    if (selectedLadder) {
      loadLadderEntries(selectedLadder.id, selectedLadderFormat);
    }
  }, [selectedLadder, selectedLadderFormat, loadLadderEntries]);

  useEffect(() => {
    if (selectedLineup) {
      loadLineupEntries(selectedLineup.id, selectedLineupFormat);
    }
  }, [selectedLineup, selectedLineupFormat, loadLineupEntries]);

  useFocusEffect(
    React.useCallback(() => {
      if (activeTab === 'members') loadMembers();
    }, [teamId, activeTab, loadMembers])
  );

  const currentUserRole = members.find(m => m.id === user?.id)?.role.toLowerCase();
  const isOwner = currentUserRole === 'owner';
  const canEditRoles = isOwner || currentUserRole === 'coach';

  useEffect(() => {
    if (!teamId) return;
    if (!canEditRoles) {
      setPendingRequestsCount(0);
      return;
    }
    listJoinRequests(teamId)
      .then(reqs => setPendingRequestsCount(reqs.length))
      .catch((e: any) => {
        if (!/not authorized/i.test(e.message)) {
          console.error('Failed to load join requests:', e);
        }
      });
  }, [teamId, invitesOpen, canEditRoles]);

  const roleOrder: Record<string, number> = {
    owner: 0,
    coach: 1,
    player: 2,
    family: 3,
    spectator: 4,
  };

  const filtered = members
    .filter(m =>
      m.username.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const ra = roleOrder[a.role.toLowerCase()] ?? 5;
      const rb = roleOrder[b.role.toLowerCase()] ?? 5;
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username);
    });

  const playableRoles = ['player', 'coach', 'owner'];
  const availablePlayers = members.filter(m => 
    playableRoles.includes(m.role.toLowerCase()) && 
    !ladderEntries.some(e => e.userId === m.id)
  );

  const handleCreateLadder = () => {
    if (!teamId) return;
    hapticLight();
    router.push(`/create-season?teamId=${teamId}`);
  };

  const handleEditLadder = (ladder: Ladder) => {
    if (!teamId) return;
    hapticLight();
    const params = new URLSearchParams({
      teamId,
      ladderId: ladder.id,
      name: ladder.name,
      description: ladder.description || '',
      startDate: ladder.startDate || '',
      endDate: ladder.endDate || ''
    });
    router.push(`/create-season?${params.toString()}`);
  };

  const handleEditLineup = (lineup: Lineup) => {
    if (!teamId) return;
    hapticLight();
    const params = new URLSearchParams({
      teamId,
      lineupId: lineup.id,
      name: lineup.name,
      description: lineup.description || ''
    });
    router.push(`/create-lineup?${params.toString()}`);
  };

  const handleDeleteLadder = async (ladder: Ladder) => {
    if (!teamId) return;
    Alert.alert(
      'Delete Season',
      `Are you sure you want to delete "${ladder.name}"? This will remove all player rankings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLadder(teamId, ladder.id);
              setLadders(prev => prev.filter(l => l.id !== ladder.id));
              if (selectedLadder?.id === ladder.id) {
                setSelectedLadder(null);
                setLadderEntries([]);
              }
              hapticMedium();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete season');
            }
          }
        }
      ]
    );
  };

  const handleRemovePlayer = useCallback((entry: LadderEntry) => {
    if (!teamId || !selectedLadder) return;
    Alert.alert(
      'Remove Player',
      `Remove ${entry.user.username || 'this player'} from the ladder?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeLadderEntry(teamId, selectedLadder.id, entry.id);
              setLadderEntries(prev => prev.filter(e => e.id !== entry.id));
              // Update positions
              setLadderEntries(prev => 
                prev.map((e, idx) => ({ ...e, position: idx + 1 }))
              );
              setLadders(prev => prev.map(l => 
                l.id === selectedLadder.id ? { ...l, entryCount: Math.max(0, l.entryCount - 1) } : l
              ));
              setSelectedLadder(prev => prev ? { ...prev, entryCount: Math.max(0, prev.entryCount - 1) } : null);
              hapticMedium();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to remove player');
            }
          }
        }
      ]
    );
  }, [teamId, selectedLadder]);

  const handleMovePlayer = async (entry: LadderEntry, direction: 'up' | 'down') => {
    if (!teamId || !selectedLadder) return;
    const currentIndex = ladderEntries.findIndex(e => e.id === entry.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= ladderEntries.length) return;

    const newEntries = [...ladderEntries];
    [newEntries[currentIndex], newEntries[newIndex]] = [newEntries[newIndex], newEntries[currentIndex]];
    
    setLadderEntries(newEntries.map((e, idx) => ({ ...e, position: idx + 1 })));
    hapticLight();

    try {
      const order = newEntries.map(e => e.id);
      await reorderLadderEntries(teamId, selectedLadder.id, order, selectedLadderFormat);
    } catch (e: any) {
      loadLadderEntries(selectedLadder.id, selectedLadderFormat);
      Alert.alert('Error', e.message || 'Failed to reorder');
    }
  };

  const handleDragEnd = useCallback(async ({ data }: { data: LadderEntry[] }) => {
    if (!teamId || !selectedLadder) return;
    
    const newEntries = data.map((e, idx) => ({ ...e, position: idx + 1 }));
    setLadderEntries(newEntries);
    hapticMedium();

    try {
      const order = newEntries.map(e => e.id);
      await reorderLadderEntries(teamId, selectedLadder.id, order, selectedLadderFormat);
    } catch (e: any) {
      loadLadderEntries(selectedLadder.id, selectedLadderFormat);
      Alert.alert('Error', e.message || 'Failed to reorder');
    }
  }, [teamId, selectedLadder, selectedLadderFormat, loadLadderEntries]);

  const renderLadderEntry = useCallback(({ item: entry, drag, isActive, getIndex }: RenderItemParams<LadderEntry>) => {
    const index = getIndex() ?? 0;
    const hasPartner = !!entry.partner;
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={canEditRoles ? drag : undefined}
          disabled={isActive}
          activeOpacity={canEditRoles ? 0.8 : 1}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 8,
            backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.05)',
            marginBottom: 8,
          }}
        >
          {canEditRoles && (
            <TouchableOpacity
              onPressIn={drag}
              disabled={isActive}
              style={{
                padding: 4,
                marginLeft: -4,
              }}
            >
              <Feather name="menu" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
          
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: index === 0 ? 'rgba(234, 179, 8, 0.2)' :
                           index === 1 ? 'rgba(156, 163, 175, 0.2)' :
                           index === 2 ? 'rgba(180, 83, 9, 0.2)' :
                           'rgba(255, 255, 255, 0.05)',
          }}>
            <Text style={{
              fontWeight: 'bold',
              fontSize: 14,
              color: index === 0 ? '#facc15' :
                     index === 1 ? '#d1d5db' :
                     index === 2 ? '#d97706' :
                     '#9ca3af',
            }}>{entry.position}</Text>
          </View>

          {hasPartner ? (
            /* Doubles/Mixed: stacked avatars */
            <View style={{ width: 40, height: 36, position: 'relative' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
                <Avatar
                  src={entry.user.profileImageUrl}
                  alt={entry.user.username || ''}
                  size="sm"
                />
              </View>
              <View style={{ position: 'absolute', top: 8, left: 14, zIndex: 0, borderWidth: 2, borderColor: '#020617', borderRadius: 99 }}>
                <Avatar
                  src={entry.partner!.profileImageUrl}
                  alt={entry.partner!.username || ''}
                  size="sm"
                />
              </View>
            </View>
          ) : (
            <Avatar
              src={entry.user.profileImageUrl}
              alt={entry.user.username || ''}
              size="sm"
            />
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: '500' }}>
              {entry.user.username}
            </Text>
            {hasPartner && (
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                {entry.partner!.username}
              </Text>
            )}
          </View>

          {canEditRoles && (
            <TouchableOpacity
              onPress={() => handleRemovePlayer(entry)}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <Feather name="x" size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }, [canEditRoles, handleRemovePlayer]);

  const formatDateRange = (ladder: Ladder) => {
    if (!ladder.startDate && !ladder.endDate) return null;
    const start = ladder.startDate ? new Date(ladder.startDate).toLocaleDateString() : '';
    const end = ladder.endDate ? new Date(ladder.endDate).toLocaleDateString() : '';
    if (start && end) return `${start} - ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;
    return null;
  };

  const formatTabs: { key: LadderFormat; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'singles', label: 'Singles', icon: 'user' },
    { key: 'doubles', label: 'Doubles', icon: 'users' },
    { key: 'mixed', label: 'Mixed', icon: 'shuffle' },
  ];

  const handleDeleteLineup = (lineup: Lineup) => {
    if (!teamId) return;
    Alert.alert(
      'Delete Lineup',
      `Delete "${lineup.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLineup(teamId, lineup.id);
              setLineups(prev => prev.filter(l => l.id !== lineup.id));
              if (selectedLineup?.id === lineup.id) {
                setSelectedLineup(null);
                setLineupEntries([]);
              }
              hapticMedium();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete lineup');
            }
          }
        }
      ]
    );
  };

  const handleRemoveLineupPlayer = useCallback((entry: LineupEntry) => {
    if (!teamId || !selectedLineup) return;
    Alert.alert(
      'Remove Player',
      `Remove ${entry.user.username || 'this player'} from the lineup?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeLineupEntry(teamId, selectedLineup.id, entry.id);
              setLineupEntries(prev => prev.filter(e => e.id !== entry.id));
              setLineupEntries(prev => 
                prev.map((e, idx) => ({ ...e, position: idx + 1 }))
              );
              setLineups(prev => prev.map(r => 
                r.id === selectedLineup.id ? { ...r, entryCount: Math.max(0, r.entryCount - 1) } : r
              ));
              setSelectedLineup(prev => prev ? { ...prev, entryCount: Math.max(0, prev.entryCount - 1) } : null);
              hapticMedium();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to remove player');
            }
          }
        }
      ]
    );
  }, [teamId, selectedLineup]);

  const handleLineupDragEnd = useCallback(async ({ data }: { data: LineupEntry[] }) => {
    if (!teamId || !selectedLineup) return;
    
    const newEntries = data.map((e, idx) => ({ ...e, position: idx + 1 }));
    setLineupEntries(newEntries);
    hapticMedium();

    try {
      const order = newEntries.map(e => e.id);
      await reorderLineupEntries(teamId, selectedLineup.id, order, selectedLineupFormat);
    } catch (e: any) {
      loadLineupEntries(selectedLineup.id, selectedLineupFormat);
      Alert.alert('Error', e.message || 'Failed to reorder');
    }
  }, [teamId, selectedLineup, selectedLineupFormat, loadLineupEntries]);

  const renderLineupEntry = useCallback(({ item: entry, drag, isActive, getIndex }: RenderItemParams<LineupEntry>) => {
    const index = getIndex() ?? 0;
    const hasPartner = !!entry.partner;
    return (
      <ScaleDecorator>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 8,
            backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.05)',
            marginBottom: 8,
          }}
        >
          {canEditRoles && (
            <TouchableOpacity
              onLongPress={drag}
              onPressIn={drag}
              delayLongPress={100}
              disabled={isActive}
              style={{
                padding: 8,
                marginLeft: -4,
                marginRight: -4,
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="menu" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
          
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: index === 0 ? 'rgba(234, 179, 8, 0.2)' :
                           index === 1 ? 'rgba(156, 163, 175, 0.2)' :
                           index === 2 ? 'rgba(180, 83, 9, 0.2)' :
                           'rgba(255, 255, 255, 0.05)',
          }}>
            <Text style={{
              fontWeight: 'bold',
              fontSize: 14,
              color: index === 0 ? '#facc15' :
                     index === 1 ? '#d1d5db' :
                     index === 2 ? '#d97706' :
                     '#9ca3af',
            }}>{entry.position}</Text>
          </View>

          {hasPartner ? (
            /* Doubles/Mixed: stacked avatars */
            <View style={{ width: 40, height: 36, position: 'relative' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
                <Avatar
                  src={entry.user.profileImageUrl}
                  alt={entry.user.username || ''}
                  size="sm"
                />
              </View>
              <View style={{ position: 'absolute', top: 8, left: 14, zIndex: 0, borderWidth: 2, borderColor: '#020617', borderRadius: 99 }}>
                <Avatar
                  src={entry.partner!.profileImageUrl}
                  alt={entry.partner!.username || ''}
                  size="sm"
                />
              </View>
            </View>
          ) : (
            <Avatar
              src={entry.user.profileImageUrl}
              alt={entry.user.username || ''}
              size="sm"
            />
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: '500' }}>
              {entry.user.username}
            </Text>
            {hasPartner && (
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                {entry.partner!.username}
              </Text>
            )}
          </View>

          {canEditRoles && (
            <TouchableOpacity
              onPress={() => handleRemoveLineupPlayer(entry)}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <Feather name="x" size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </ScaleDecorator>
    );
  }, [canEditRoles, handleRemoveLineupPlayer]);

  const tabs: { key: RosterTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'members', label: 'Members', icon: 'users' },
    { key: 'ladders', label: 'Ladders', icon: 'trending-up' },
    { key: 'lineups', label: 'Lineups', icon: 'calendar' },
  ];

  return (
    <View className="flex-1 flex-col" style={{ backgroundColor: '#020617' }}>
      <View className="px-4 pt-1 pb-2 border-b border-white/5">
        <View className="flex-row items-center justify-between mb-2">
          {pendingRequestsCount > 0 && canEditRoles && activeTab === 'members' && (
            <TouchableOpacity
              onPress={() => setInvitesOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-green-500/20 flex-row items-center gap-2"
            >
              <Feather name="bell" size={16} color="#22c55e" />
              <Text className="text-sm font-medium text-green-400">{pendingRequestsCount}</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View className="flex-row gap-2">
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                hapticLight();
                setActiveTab(tab.key);
              }}
              className={`flex-1 flex-row items-center justify-center gap-2 py-2 rounded-lg ${
                activeTab === tab.key ? 'bg-white/10' : 'bg-white/5'
              }`}
              activeOpacity={0.7}
            >
              <Feather 
                name={tab.icon} 
                size={14} 
                color={activeTab === tab.key ? '#ffffff' : '#9ca3af'} 
              />
              <Text className={`text-xs font-medium ${
                activeTab === tab.key ? 'text-white' : 'text-gray-400'
              }`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'members' && (
          <View className="relative mt-3">
            <Feather name="search" size={16} color="#9ca3af" className="absolute left-3" style={{ top: '50%', transform: [{ translateY: -8 }] }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search members..."
              placeholderTextColor="#6b7280"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            />
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {activeTab === 'members' && (
          <>
            {loading ? (
              <View className="gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </View>
            ) : filtered.length > 0 ? (
              <View className="gap-2">
                {filtered.map(m => {
                  const roleLower = m.role.toLowerCase();
                  const iconName = roleIcons[roleLower] || 'user';
                  const roleColor = roleColors[roleLower] || '#9ca3af';
                  const isCurrentUser = m.id === user?.id;

                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => {
                        if (canEditRoles && !isCurrentUser && teamId) {
                          hapticLight();
                          router.push(`/edit-member?teamId=${teamId}&memberId=${m.id}`);
                        }
                      }}
                      className={`flex-row items-center gap-3 p-3 rounded-lg ${
                        canEditRoles && !isCurrentUser ? 'bg-white/5' : 'bg-white/5'
                      } ${isCurrentUser ? 'border-2 border-blue-500/50' : ''}`}
                      activeOpacity={0.7}
                    >
                      <Avatar
                        src={m.profilePictureUrl}
                        alt={m.username}
                        size="md"
                      />
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-white font-medium flex-1" numberOfLines={1}>
                            {m.username}
                            {isCurrentUser && <Text className="text-gray-400 ml-1">(You)</Text>}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs font-medium capitalize" style={{ color: roleColor }}>
                            {roleLower}
                          </Text>
                          <Text className="text-xs text-gray-500">
                            • Joined {new Date(m.joinedAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                          <Feather name={iconName} size={16} color={roleColor} />
                        </View>
                        {canEditRoles && !isCurrentUser && teamId && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              hapticLight();
                              router.push(`/edit-member?teamId=${teamId}&memberId=${m.id}`);
                            }}
                            style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Feather name="more-vertical" size={16} color="#9ca3af" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="flex-col items-center justify-center py-16">
                <Feather name="users" size={48} color="#9ca3af" />
                <Text className="text-gray-400 mt-4">No members found</Text>
              </View>
            )}
          </>
        )}
        
        {activeTab === 'ladders' && (
          <>
            {!selectedLadder ? (
              <>
                {canEditRoles && (
                  <TouchableOpacity
                    onPress={handleCreateLadder}
                    className="flex-row items-center justify-center gap-2 py-4 mb-4 rounded-xl bg-blue-500/20 border border-blue-500/30"
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={20} color="#3b82f6" />
                    <Text className="text-blue-400 font-semibold">Create New Season</Text>
                  </TouchableOpacity>
                )}

                {laddersLoading ? (
                  <View className="gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </View>
                ) : ladders.length > 0 ? (
                  <View className="gap-3">
                    {ladders.map(ladder => {
                      const dateRange = formatDateRange(ladder);
                      return (
                        <TouchableOpacity
                          key={ladder.id}
                          onPress={() => {
                            hapticLight();
                            setSelectedLadder(ladder);
                          }}
                          className={`p-4 rounded-xl border ${
                            ladder.isActive 
                              ? 'bg-white/5 border-white/10' 
                              : 'bg-white/[0.02] border-white/5'
                          }`}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-1 mr-3">
                              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                                <Text className="text-white font-semibold text-base">{ladder.name}</Text>
                                {ladder.isActive && (
                                  <View className="px-2 py-0.5 rounded-full bg-green-500/20">
                                    <Text className="text-green-400 text-[10px] font-medium">ACTIVE</Text>
                                  </View>
                                )}
                              </View>
                              {ladder.description && (
                                <Text className="text-gray-400 text-sm mb-2" numberOfLines={2}>{ladder.description}</Text>
                              )}
                              <View className="flex-row items-center gap-3">
                                <View className="flex-row items-center gap-1">
                                  <Feather name="users" size={12} color="#9ca3af" />
                                  <Text className="text-gray-500 text-xs">{ladder.entryCount} player{ladder.entryCount !== 1 ? 's' : ''}</Text>
                                </View>
                                {dateRange && (
                                  <View className="flex-row items-center gap-1">
                                    <Feather name="calendar" size={12} color="#9ca3af" />
                                    <Text className="text-gray-500 text-xs">{dateRange}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View className="flex-row items-center gap-2">
                              {canEditRoles && (
                                <TouchableOpacity
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleEditLadder(ladder);
                                  }}
                                  className="p-2 rounded-lg bg-white/5"
                                >
                                  <Feather name="edit-2" size={14} color="#9ca3af" />
                                </TouchableOpacity>
                              )}
                              <Feather name="chevron-right" size={18} color="#6b7280" />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View className="flex-col items-center justify-center py-16">
                    <Feather name="trending-up" size={48} color="#4b5563" />
                    <Text className="text-gray-400 mt-4 mb-2">No Seasons Yet</Text>
                    <Text className="text-sm text-gray-500 text-center px-4 mb-4">
                      {canEditRoles 
                        ? 'Create a season to start ranking players on your team ladder.'
                        : 'No ladder seasons have been created yet.'}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setSelectedLadder(null);
                    setLadderEntries([]);
                    setSelectedLadderFormat('singles');
                  }}
                  className="flex-row items-center gap-2 mb-4"
                >
                  <Feather name="arrow-left" size={18} color="#9ca3af" />
                  <Text className="text-gray-400 text-sm">Back to Seasons</Text>
                </TouchableOpacity>

                <View className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-white font-bold text-lg">{selectedLadder.name}</Text>
                        {selectedLadder.isActive && (
                          <View className="px-2 py-0.5 rounded-full bg-green-500/20">
                            <Text className="text-green-400 text-[10px] font-medium">ACTIVE</Text>
                          </View>
                        )}
                      </View>
                      {formatDateRange(selectedLadder) && (
                        <View className="flex-row items-center gap-1 mt-1">
                          <Feather name="calendar" size={12} color="#6b7280" />
                          <Text className="text-gray-500 text-xs">{formatDateRange(selectedLadder)}</Text>
                        </View>
                      )}
                    </View>
                    {canEditRoles && (
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => handleEditLadder(selectedLadder)}
                          className="p-2 rounded-lg bg-white/5"
                        >
                          <Feather name="edit-2" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteLadder(selectedLadder)}
                          className="p-2 rounded-lg bg-red-500/10"
                        >
                          <Feather name="trash-2" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {selectedLadder.description && (
                    <Text className="text-gray-400 text-sm mt-2">{selectedLadder.description}</Text>
                  )}
                </View>

                <View className="flex-row gap-2 mb-4">
                  {formatTabs.map(tab => (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => {
                        hapticLight();
                        setSelectedLadderFormat(tab.key);
                      }}
                      className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-lg ${
                        selectedLadderFormat === tab.key ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/5'
                      }`}
                      activeOpacity={0.7}
                    >
                      <Feather 
                        name={tab.icon} 
                        size={14} 
                        color={selectedLadderFormat === tab.key ? '#60a5fa' : '#9ca3af'} 
                      />
                      <Text className={`text-xs font-medium ${
                        selectedLadderFormat === tab.key ? 'text-blue-400' : 'text-gray-400'
                      }`}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {canEditRoles && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      router.push(`/add-ladder-player?teamId=${teamId}&ladderId=${selectedLadder.id}&ladderName=${encodeURIComponent(selectedLadder.name)}&format=${selectedLadderFormat}`);
                    }}
                    className="flex-row items-center justify-center gap-2 py-3 mb-4 rounded-xl bg-green-500/20 border border-green-500/30"
                    activeOpacity={0.7}
                  >
                    <Feather name={selectedLadderFormat === 'singles' ? 'user-plus' : 'users'} size={18} color="#22c55e" />
                    <Text className="text-green-400 font-semibold">
                      {selectedLadderFormat === 'singles'
                        ? 'Add Player'
                        : `Add ${selectedLadderFormat.charAt(0).toUpperCase() + selectedLadderFormat.slice(1)} Team`}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Rankings</Text>

                {entriesLoading ? (
                  <View className="gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </View>
                ) : ladderEntries.length > 0 ? (
                  <View>
                    {canEditRoles && (
                      <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                        Hold and drag to reorder players
                      </Text>
                    )}
                    <DraggableFlatList
                      data={ladderEntries}
                      onDragEnd={handleDragEnd}
                      keyExtractor={(item) => item.id}
                      renderItem={renderLadderEntry}
                      scrollEnabled={false}
                      containerStyle={{ overflow: 'visible' }}
                    />
                  </View>
                ) : (
                  <View className="flex-col items-center justify-center py-12 rounded-xl bg-white/[0.02] border border-white/5">
                    <Feather name="users" size={36} color="#4b5563" />
                    <Text className="text-gray-400 mt-3 mb-1">No Players Yet</Text>
                    <Text className="text-sm text-gray-500 text-center px-4">
                      {canEditRoles && availablePlayers.length > 0
                        ? 'Add players to this ladder to start ranking.'
                        : canEditRoles
                        ? 'Add team members with a playable role (Player, Coach, or Owner) first.'
                        : 'No players have been added to this ladder.'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
        
        {activeTab === 'lineups' && (
          <>
            {!selectedLineup ? (
              <>
                {canEditRoles && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      router.push(`/create-lineup?teamId=${teamId}`);
                    }}
                    className="flex-row items-center justify-center gap-2 py-4 mb-4 rounded-xl bg-blue-500/20 border border-blue-500/30"
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={20} color="#3b82f6" />
                    <Text className="text-blue-400 font-semibold">Create Lineup</Text>
                  </TouchableOpacity>
                )}

                {lineupsLoading ? (
                  <View className="gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </View>
                ) : lineups.length > 0 ? (
                  <View className="gap-3">
                    {lineups.map(lineup => (
                      <TouchableOpacity
                        key={lineup.id}
                        onPress={() => {
                          hapticLight();
                          setSelectedLineup(lineup);
                          loadLineupEntries(lineup.id, selectedLineupFormat);
                        }}
                        className="p-4 rounded-xl bg-white/5 border border-white/10"
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 mr-3">
                            <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                              <Text className="text-white font-semibold text-base">{lineup.name}</Text>
                              {lineup.eventName && (
                                <View className="px-2 py-0.5 rounded-full bg-blue-500/20">
                                  <Text className="text-blue-400 text-[10px] font-medium">EVENT</Text>
                                </View>
                              )}
                            </View>
                            {lineup.description && (
                              <Text className="text-gray-400 text-sm mb-2" numberOfLines={2}>{lineup.description}</Text>
                            )}
                            <View className="flex-row items-center gap-3">
                              <View className="flex-row items-center gap-1">
                                <Feather name="users" size={12} color="#9ca3af" />
                                <Text className="text-gray-500 text-xs">{lineup.entryCount} player{lineup.entryCount !== 1 ? 's' : ''}</Text>
                              </View>
                              {lineup.sourceLadderName && (
                                <View className="flex-row items-center gap-1">
                                  <Feather name="trending-up" size={12} color="#9ca3af" />
                                  <Text className="text-gray-500 text-xs">from {lineup.sourceLadderName}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View className="flex-row items-center gap-2">
                            {canEditRoles && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleEditLineup(lineup);
                                }}
                                className="p-2 rounded-lg bg-white/5"
                              >
                                <Feather name="edit-2" size={14} color="#9ca3af" />
                              </TouchableOpacity>
                            )}
                            <Feather name="chevron-right" size={18} color="#6b7280" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View className="flex-col items-center justify-center py-16 rounded-xl bg-white/[0.02] border border-white/5">
                    <Feather name="calendar" size={48} color="#4b5563" />
                    <Text className="text-gray-400 mt-4 mb-2">No Lineups</Text>
                    <Text className="text-sm text-gray-500 text-center px-4">
                      {canEditRoles 
                        ? 'Create lineups for matches, tournaments, or events. You can copy players from your team ladders.'
                        : 'No lineups have been created yet.'}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setSelectedLineup(null);
                    setLineupEntries([]);
                    setSelectedLineupFormat('singles');
                  }}
                  className="flex-row items-center gap-2 mb-4"
                >
                  <Feather name="arrow-left" size={18} color="#9ca3af" />
                  <Text className="text-gray-400 text-sm">Back to Lineups</Text>
                </TouchableOpacity>

                <View className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-white font-bold text-lg">{selectedLineup.name}</Text>
                        {selectedLineup.eventName && (
                          <View className="px-2 py-0.5 rounded-full bg-blue-500/20">
                            <Text className="text-blue-400 text-[10px] font-medium">EVENT</Text>
                          </View>
                        )}
                      </View>
                      {selectedLineup.sourceLadderName && (
                        <View className="flex-row items-center gap-1 mt-1">
                          <Feather name="trending-up" size={12} color="#6b7280" />
                          <Text className="text-gray-500 text-xs">Based on {selectedLineup.sourceLadderName}</Text>
                        </View>
                      )}
                    </View>
                    {canEditRoles && (
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => handleEditLineup(selectedLineup)}
                          className="p-2 rounded-lg bg-white/5"
                        >
                          <Feather name="edit-2" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteLineup(selectedLineup)}
                          className="p-2 rounded-lg bg-red-500/10"
                        >
                          <Feather name="trash-2" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {selectedLineup.description && (
                    <Text className="text-gray-400 text-sm mt-2">{selectedLineup.description}</Text>
                  )}
                </View>

                {/* Format Tabs */}
                <View className="flex-row gap-2 mb-4">
                  {formatTabs.map(tab => (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => {
                        hapticLight();
                        setSelectedLineupFormat(tab.key);
                      }}
                      className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-lg ${
                        selectedLineupFormat === tab.key ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/5'
                      }`}
                      activeOpacity={0.7}
                    >
                      <Feather 
                        name={tab.icon} 
                        size={14} 
                        color={selectedLineupFormat === tab.key ? '#60a5fa' : '#9ca3af'} 
                      />
                      <Text className={`text-xs font-medium ${
                        selectedLineupFormat === tab.key ? 'text-blue-400' : 'text-gray-400'
                      }`}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {canEditRoles && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      router.push(`/add-lineup-player?teamId=${teamId}&lineupId=${selectedLineup.id}&lineupName=${encodeURIComponent(selectedLineup.name)}&format=${selectedLineupFormat}`);
                    }}
                    className="flex-row items-center justify-center gap-2 py-3 mb-4 rounded-xl bg-green-500/20 border border-green-500/30"
                    activeOpacity={0.7}
                  >
                    <Feather name={selectedLineupFormat === 'singles' ? 'user-plus' : 'users'} size={18} color="#22c55e" />
                    <Text className="text-green-400 font-semibold">
                      {selectedLineupFormat === 'singles'
                        ? 'Add Player'
                        : `Add ${selectedLineupFormat.charAt(0).toUpperCase() + selectedLineupFormat.slice(1)} Team`}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text className="text-gray-400 text-xs uppercase tracking-wider mb-3">Lineup</Text>

                {lineupEntriesLoading ? (
                  <View className="gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </View>
                ) : lineupEntries.length > 0 ? (
                  <View>
                    {canEditRoles && (
                      <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                        Hold and drag to reorder players
                      </Text>
                    )}
                    <DraggableFlatList
                      data={lineupEntries}
                      onDragEnd={handleLineupDragEnd}
                      keyExtractor={(item) => item.id}
                      renderItem={renderLineupEntry}
                      scrollEnabled={false}
                      containerStyle={{ overflow: 'visible' }}
                    />
                  </View>
                ) : (
                  <View className="flex-col items-center justify-center py-12 rounded-xl bg-white/[0.02] border border-white/5">
                    <Feather name="users" size={36} color="#4b5563" />
                    <Text className="text-gray-400 mt-3 mb-1">No Players Yet</Text>
                    <Text className="text-sm text-gray-500 text-center px-4">
                      {canEditRoles && availablePlayers.length > 0
                        ? 'Add players to this lineup.'
                        : canEditRoles
                        ? 'Add team members with a playable role (Player, Coach, or Owner) first.'
                        : 'No players have been added to this lineup.'}
                    </Text>
                  </View>
                )}
              </>
            )}

          </>
        )}
        
        <KeyboardSpacer extraOffset={72} />
      </ScrollView>

      <PendingInvitesDialog
        open={invitesOpen}
        onClose={() => setInvitesOpen(false)}
        teamId={teamId!}
      />
    </View>
  );
}

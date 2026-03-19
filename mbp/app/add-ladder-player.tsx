import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMembers, Member, listLadderEntries, LadderEntry, LadderFormat, addLadderEntry } from '../src/api/teams';
import { hapticLight } from '../src/utils/haptics';
import { Avatar } from '../src/components/Avatar';
import { Skeleton } from '../src/components/Skeleton';

const BACKGROUND_COLOR = '#020617';

export default function AddLadderPlayerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const teamId = params.teamId as string;
  const ladderId = params.ladderId as string;
  const ladderName = params.ladderName as string | undefined;
  const format = (params.format as LadderFormat) || 'singles';

  const isDoubles = format === 'doubles' || format === 'mixed';

  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<LadderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Member | null>(null);

  const [successTeam, setSuccessTeam] = useState<{ player1: string; player2: string } | null>(null);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successTranslateY = useRef(new Animated.Value(-20)).current;
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccessBanner = useCallback((player1Name: string, player2Name: string) => {
    if (successTimer.current) clearTimeout(successTimer.current);
    successOpacity.setValue(0);
    successTranslateY.setValue(-20);
    setSuccessTeam({ player1: player1Name, player2: player2Name });

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(successTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }, 50);

    successTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(successTranslateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => setSuccessTeam(null));
    }, 2850);
  }, []);

  useEffect(() => {
    return () => { if (successTimer.current) clearTimeout(successTimer.current); };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [membersResult, entriesResult] = await Promise.all([
          listMembers(teamId),
          listLadderEntries(teamId, ladderId, format)
        ]);
        setMembers(membersResult);
        setEntries(entriesResult);
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [teamId, ladderId, format]);

  const playableRoles = ['player', 'coach', 'owner'];
  const availablePlayers = members.filter(m =>
    playableRoles.includes(m.role.toLowerCase()) &&
    !entries.some(e => e.userId === m.id)
  );

  const availablePartners = members.filter(m =>
    playableRoles.includes(m.role.toLowerCase()) &&
    m.id !== selectedPlayer?.id &&
    !entries.some(e => e.userId === m.id || e.partnerId === m.id)
  );

  const handleAddPlayer = async (memberId: string, partnerId?: string) => {
    setAdding(memberId);
    try {
      const entry = await addLadderEntry(teamId, ladderId, memberId, format, partnerId);
      setEntries(prev => [...prev, entry]);
      hapticLight();

      if (isDoubles && selectedPlayer && partnerId) {
        const partner = members.find(m => m.id === partnerId);
        showSuccessBanner(selectedPlayer.username, partner?.username ?? 'Partner');
      }

      setSelectedPlayer(null);
    } catch (e: any) {
      console.error('Failed to add player:', e);
    } finally {
      setAdding(null);
    }
  };

  const handleSelectPlayer = (member: Member) => {
    if (isDoubles) {
      hapticLight();
      setSelectedPlayer(member);
    } else {
      handleAddPlayer(member.id);
    }
  };

  const handleSelectPartner = (partner: Member) => {
    if (!selectedPlayer) return;
    handleAddPlayer(selectedPlayer.id, partner.id);
  };

  const formatLabel = format.charAt(0).toUpperCase() + format.slice(1);

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            {isDoubles ? (selectedPlayer ? 'Select Partner' : 'Add Team') : 'Add Player'}
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon={selectedPlayer ? 'chevron.left' : 'xmark'}
              onPress={() => {
                if (selectedPlayer) {
                  setSelectedPlayer(null);
                } else {
                  router.back();
                }
              }}
              tintColor="#ffffff"
            />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          {ladderName && (
            <View className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <Text className="text-gray-400 text-sm">Adding to {formatLabel}</Text>
              <Text className="text-white font-semibold text-lg">{ladderName}</Text>
            </View>
          )}

          {successTeam && (
            <Animated.View
              style={{
                opacity: successOpacity,
                transform: [{ translateY: successTranslateY }],
                marginBottom: 16,
                borderRadius: 12,
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.3)',
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: 'rgba(34, 197, 94, 0.25)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="check" size={18} color="#22c55e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600' }}>Team added</Text>
                <Text style={{ color: '#86efac', fontSize: 13, marginTop: 2 }}>
                  {successTeam.player1} and {successTeam.player2} have been added together to this ladder.
                </Text>
              </View>
            </Animated.View>
          )}

          {isDoubles && (
            <View className="mb-4 flex-row items-center gap-3 px-1">
              <View className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full ${selectedPlayer ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                <View className={`w-5 h-5 rounded-full items-center justify-center ${selectedPlayer ? 'bg-green-500' : 'bg-blue-500'}`}>
                  {selectedPlayer ? (
                    <Feather name="check" size={12} color="#ffffff" />
                  ) : (
                    <Text className="text-white text-xs font-bold">1</Text>
                  )}
                </View>
                <Text className={`text-xs font-medium ${selectedPlayer ? 'text-green-400' : 'text-blue-400'}`}>
                  Player 1
                </Text>
              </View>

              <View className="w-6 h-px bg-white/20" />

              <View className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full ${selectedPlayer ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                <View className={`w-5 h-5 rounded-full items-center justify-center ${selectedPlayer ? 'bg-blue-500' : 'bg-white/10'}`}>
                  <Text className={`text-xs font-bold ${selectedPlayer ? 'text-white' : 'text-gray-500'}`}>2</Text>
                </View>
                <Text className={`text-xs font-medium ${selectedPlayer ? 'text-blue-400' : 'text-gray-500'}`}>
                  Partner
                </Text>
              </View>
            </View>
          )}

          {isDoubles && selectedPlayer && (
            <View className="mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Text className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">Player 1</Text>
              <View className="flex-row items-center gap-3">
                <Avatar
                  src={selectedPlayer.profilePictureUrl}
                  alt={selectedPlayer.username}
                  size="md"
                />
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base">{selectedPlayer.username}</Text>
                  <Text className="text-gray-500 text-sm capitalize">{selectedPlayer.role.toLowerCase()}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setSelectedPlayer(null);
                  }}
                  className="p-2 rounded-lg bg-white/10"
                >
                  <Feather name="x" size={16} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
            {loading ? (
              <View className="gap-3">
                <Skeleton className="h-4 w-48 rounded mb-2" />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} className="flex-row items-center gap-3 p-3 rounded-xl bg-white/5">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <View className="flex-1 gap-2">
                      <Skeleton className="h-4 w-32 rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </View>
                    <Skeleton className="w-8 h-8 rounded-full" />
                  </View>
                ))}
              </View>
            ) : (isDoubles && selectedPlayer ? availablePartners : availablePlayers).length > 0 ? (
              <View className="gap-3">
                <Text className="text-gray-400 text-sm mb-2">
                  {isDoubles
                    ? selectedPlayer
                      ? `Select a partner for ${selectedPlayer.username}`
                      : 'Select the first player for this team'
                    : 'Select a player to add to the ladder'}
                </Text>
                {(isDoubles && selectedPlayer ? availablePartners : availablePlayers).map(member => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => isDoubles && selectedPlayer
                      ? handleSelectPartner(member)
                      : handleSelectPlayer(member)
                    }
                    disabled={adding === member.id}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      borderRadius: 12,
                      opacity: adding === member.id ? 0.5 : 1,
                    }}
                  >
                    <Avatar
                      src={member.profilePictureUrl}
                      alt={member.username}
                      size="md"
                    />
                    <View className="flex-1">
                      <Text className="text-white font-medium text-base">{member.username}</Text>
                      <Text className="text-gray-500 text-sm capitalize">{member.role.toLowerCase()}</Text>
                    </View>
                    {adding === member.id ? (
                      <ActivityIndicator color="#22c55e" size="small" />
                    ) : (
                      <View className="p-2 rounded-full bg-green-500/20">
                        <Feather
                          name={isDoubles && !selectedPlayer ? 'chevron-right' : 'plus'}
                          size={18}
                          color="#22c55e"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="py-12 items-center">
                <Feather name="users" size={48} color="#4b5563" />
                <Text className="text-gray-400 mt-4 text-center">No Available Players</Text>
                <Text className="text-gray-500 text-sm mt-2 text-center px-4">
                  All eligible members are already on this ladder, or there are no team members with a playable role (Player, Coach, or Owner).
                </Text>
                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.8}
                  style={{ marginTop: 24, overflow: 'hidden', borderRadius: 8 }}
                >
                  <LinearGradient
                    colors={['#1e40af', '#1e3a8a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                  >
                    <Text className="text-white font-medium">Go Back</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});

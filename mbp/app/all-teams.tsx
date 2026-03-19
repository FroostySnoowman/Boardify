import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMyTeams, Team } from '../src/api/teams';
import { useAuth } from '../src/contexts/AuthContext';
import { Avatar } from '../src/components';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function AllTeamsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ currentTeamId?: string; returnPath?: string }>();
  const currentTeamId = params.currentTeamId;
  const returnPath = params.returnPath;
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadTeams();
  }, [authLoading]);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const teamList = await listMyTeams();
      setTeams(teamList);
    } catch (err: any) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = (teamId: string) => {
    hapticLight();
    router.back();
    
    // Small delay to allow modal to close, then navigate with selected team
    setTimeout(() => {
      if (returnPath) {
        router.push({
          pathname: returnPath as any,
          params: { selectedTeamId: teamId },
        });
      } else {
        // Default behavior: navigate to team screen
        router.push({
          pathname: '/(tabs)/teams',
          params: { teamId },
        });
      }
    }, 300);
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            All Teams
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button 
              icon="xmark" 
              onPress={() => router.back()}
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View style={{ padding: 24, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', gap: 24 }}>
              <View style={{ position: 'relative' }}>
                <Feather 
                  name="search" 
                  size={20} 
                  color="#9ca3af" 
                  style={{ 
                    position: 'absolute', 
                    left: 12, 
                    top: '50%', 
                    transform: [{ translateY: -10 }],
                    zIndex: 1,
                  }} 
                />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search teams..."
                  placeholderTextColor="#6b7280"
                  style={{
                    width: '100%',
                    paddingLeft: 40,
                    paddingRight: 12,
                    paddingVertical: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                  autoFocus
                />
              </View>

              {loading ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 16 }}>Loading teams...</Text>
                </View>
              ) : filteredTeams.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <View style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: 32, 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16
                  }}>
                    <Feather name="users" size={32} color="#6b7280" />
                  </View>
                  <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
                    {search.trim() ? 'No teams found matching your search.' : 'No teams found.'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {filteredTeams.map((team) => {
                    const isSelected = team.id.toString() === currentTeamId;
                    return (
                      <TouchableOpacity
                        key={team.id}
                        onPress={() => handleSelectTeam(team.id.toString())}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          borderRadius: 12,
                          minHeight: 56,
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <Avatar src={team.imageUrl} alt={team.name} size="sm" />
                          <Text 
                            style={{ 
                              flex: 1, 
                              fontSize: 16, 
                              fontWeight: '500',
                              color: '#ffffff',
                            }} 
                            numberOfLines={1}
                          >
                            {team.name}
                          </Text>
                        </View>
                        <Text style={{ 
                          fontSize: 14, 
                          color: '#9ca3af',
                          marginLeft: 8,
                        }}>
                          {team.memberCount}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
        <KeyboardSpacer extraOffset={20} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeams } from '../../contexts/TeamsContext';
import { Team } from '../../api/teams';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const MAX_VISIBLE_TEAMS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TeamSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  selectedTeam: string;
  onSelect: (teamId: string) => void;
}

function TeamSelectionDialog({
  open,
  onClose,
  teams,
  selectedTeam,
  onSelect,
}: TeamSelectionDialogProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
    }
  }, [open]);

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
          opacity: fadeAnim,
        }}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
        />
        <Animated.View
          style={{
            width: '100%',
            maxWidth: 400,
            maxHeight: '70%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            padding: 24,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-white">Select a Team</Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                onClose();
              }}
              className="p-2 rounded-lg bg-white/10"
              style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="x" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View className="relative mb-4">
            <Feather
              name="search"
              size={20}
              color="#9ca3af"
              style={{ position: 'absolute', left: 14, top: '50%', transform: [{ translateY: -10 }], zIndex: 1 }}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search teams..."
              placeholderTextColor="#6b7280"
              className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white"
              style={{ minHeight: 44 }}
            />
          </View>

          {/* Team List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {filteredTeams.length > 0 ? (
              filteredTeams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  onPress={() => {
                    hapticMedium();
                    onSelect(team.id);
                  }}
                  className={`w-full flex-row items-center justify-between p-3 rounded-xl mb-2 ${
                    selectedTeam === team.id ? 'bg-white' : 'bg-black/40'
                  }`}
                  style={{ minHeight: 56 }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <Avatar
                      src={team.imageUrl}
                      alt={team.name}
                      size="sm"
                    />
                    <Text
                      className={`font-medium flex-1 ${
                        selectedTeam === team.id ? 'text-black' : 'text-white'
                      }`}
                      numberOfLines={1}
                    >
                      {team.name}
                    </Text>
                  </View>
                  <Text className={selectedTeam === team.id ? 'text-gray-700' : 'text-gray-300'}>
                    {team.memberCount}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text className="text-center text-gray-400 py-4">No teams found.</Text>
            )}
          </ScrollView>
          <KeyboardSpacer extraOffset={16} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface SpectateLayoutProps {
  children: React.ReactNode;
  selectedTeam: string;
  onTeamChange: (teamId: string) => void;
}

export default function SpectateLayout({ children, selectedTeam, onTeamChange }: SpectateLayoutProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { teams, loading } = useTeams();
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && teams.length > 0 && !selectedTeam) {
      onTeamChange(teams[0].id);
    }
  }, [teams, loading, selectedTeam, onTeamChange]);

  const tabs = [
    { name: 'Scorecard', icon: 'activity', route: 'SpectateScorecard' },
    { name: 'Radio', icon: 'radio', route: 'SpectateRadio' },
    // Commented out same as original
    // { name: 'Stream', icon: 'video', route: 'SpectateStream' },
    // { name: 'Stats', icon: 'bar-chart-2', route: 'SpectateStats' },
    // { name: 'Chat', icon: 'users', route: 'SpectateChat' },
    // { name: 'Highlights', icon: 'zap', route: 'SpectateHighlights' },
  ];

  const currentRouteName = route.name;

  const visibleTeams = teams.slice(0, MAX_VISIBLE_TEAMS);
  const isSelectedTeamVisible = visibleTeams.some(t => t.id === selectedTeam);

  const TeamSelector = () => {
    if (loading) {
      return <Skeleton className="h-10 w-64 rounded-lg" />;
    }

    if (teams.length === 0) {
      return (
        <TouchableOpacity
          onPress={() => {
            const { router } = require('expo-router');
            router.push('/create-team');
          }}
          className="flex-row items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2"
        >
          <Feather name="plus-square" size={16} color="#ffffff" />
          <Text className="text-sm text-white">Create or Join a Team</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View className="flex-row items-center gap-1 rounded-lg bg-white/5 p-1">
        {visibleTeams.map(team => (
          <TouchableOpacity
            key={team.id}
            onPress={() => {
              hapticLight();
              onTeamChange(team.id);
            }}
            className={`relative rounded-md px-4 py-1.5 ${
              selectedTeam === team.id ? 'bg-white' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selectedTeam === team.id ? 'text-black' : 'text-gray-300'
              }`}
            >
              {team.name}
            </Text>
          </TouchableOpacity>
        ))}
        {teams.length > MAX_VISIBLE_TEAMS && (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setIsTeamDialogOpen(true);
            }}
            className={`relative rounded-md px-3 py-1.5 ${
              !isSelectedTeamVisible && selectedTeam ? 'bg-white' : ''
            }`}
          >
            <Feather
              name="more-horizontal"
              size={20}
              color={!isSelectedTeamVisible && selectedTeam ? '#000000' : '#9ca3af'}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#020617]">
      <TeamSelectionDialog
        open={isTeamDialogOpen}
        onClose={() => setIsTeamDialogOpen(false)}
        teams={teams}
        selectedTeam={selectedTeam}
        onSelect={teamId => {
          onTeamChange(teamId);
          setIsTeamDialogOpen(false);
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {/* Header */}
        <View className="flex-col gap-4 mb-8">
          <View>
            <Text className="text-4xl font-bold text-white mb-2">
              Spectate Center
            </Text>
            <Text className="text-gray-400 text-lg">
              Stream live, track scores, share highlights & engage fans
            </Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-4 mt-4">
            <TeamSelector />
          </View>
        </View>

        {/* Tab Bar */}
        <View className="flex-row gap-2 mb-8 bg-white/5 rounded-lg p-1">
          {tabs.map(tab => {
            const isActive = currentRouteName === tab.route;
            return (
              <TouchableOpacity
                key={tab.route}
                onPress={() => {
                  hapticLight();
                  (navigation as any).navigate(tab.route);
                }}
                className={`flex-1 flex-row justify-center items-center gap-2 px-4 py-3 rounded-md ${
                  isActive ? 'bg-white' : ''
                }`}
              >
                <Feather
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? '#000000' : '#9ca3af'}
                />
                <Text
                  className={`text-sm ${isActive ? 'text-black' : 'text-gray-400'}`}
                >
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        {children}
        <KeyboardSpacer extraOffset={72} />
      </ScrollView>
    </View>
  );
}

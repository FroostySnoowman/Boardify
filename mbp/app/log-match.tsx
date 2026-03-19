import React, { useState, useRef, useEffect } from 'react';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, StyleSheet, Platform, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createMatch, Match } from '../src/api/matches';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { useAuth } from '../src/contexts/AuthContext';
import { ContextMenu } from '../src/components/ContextMenu';
import { saveGuestMatch } from '../src/utils/guestMatchStorage';
import { initStats } from '../src/utils/matchHelper';

const BACKGROUND_COLOR = '#020617';

const formatLabel = (val: string, labels?: Record<string, string>) => {
  if (labels && labels[val]) return labels[val];
  const defaultLabels: Record<string, string> = {
    'singles': 'Singles',
    'doubles': 'Doubles',
    'right': 'Right',
    'left': 'Left',
    'one-handed': 'One-Handed',
    'two-handed': 'Two-Handed',
    'basic': 'Basic',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced',
    'both': 'Both Teams',
    'your-team': 'Your Team Only',
    'opponent-team': 'Opponent Team Only',
    'short': 'Short Set',
    'normal': 'Standard Set',
    'pro': 'Pro Set',
    '1': '1 Set',
    '3': '3 Sets',
    '5': '5 Sets',
    '7-point': '7-Point',
    '10-point': '10-Point',
    'None': 'None',
    'ad': 'Advantage',
    'no-ad': 'No-Ad',
    'yes': 'Yes',
    'no': 'No',
    '5-5': '5-5',
    '6-6': '6-6',
    '7-7': '7-7',
    '8-8': '8-8',
    'Golden-7': 'Golden 7',
    'Golden-10': 'Golden 10',
    'Custom': 'Custom',
  };
  return defaultLabels[val] || val;
};

export default function LogMatchScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const isGuestMode = params.guest === 'true' || !user;
  const [step, setStep] = useState<'players' | 'settings'>('players');
  const [type, setType] = useState<'singles' | 'doubles'>('singles');
  const [yourPlayer1, setYourPlayer1] = useState('');
  const [yourPlayer2, setYourPlayer2] = useState('');
  const [oppPlayer1, setOppPlayer1] = useState('');
  const [oppPlayer2, setOppPlayer2] = useState('');
  const [yourPlayer1Hand, setYourPlayer1Hand] = useState<'right' | 'left'>('right');
  const [yourPlayer1Backhand, setYourPlayer1Backhand] = useState<'one-handed' | 'two-handed'>('two-handed');
  const [yourPlayer2Hand, setYourPlayer2Hand] = useState<'right' | 'left'>('right');
  const [yourPlayer2Backhand, setYourPlayer2Backhand] = useState<'one-handed' | 'two-handed'>('two-handed');
  const [oppPlayer1Hand, setOppPlayer1Hand] = useState<'right' | 'left'>('right');
  const [oppPlayer1Backhand, setOppPlayer1Backhand] = useState<'one-handed' | 'two-handed'>('two-handed');
  const [oppPlayer2Hand, setOppPlayer2Hand] = useState<'right' | 'left'>('right');
  const [oppPlayer2Backhand, setOppPlayer2Backhand] = useState<'one-handed' | 'two-handed'>('two-handed');
  const [showPlayerOptions, setShowPlayerOptions] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [statMode, setStatMode] = useState<'basic' | 'intermediate' | 'advanced'>('intermediate');
  const [customStats, setCustomStats] = useState<string[]>(['', '']);
  const [customStatsTeams, setCustomStatsTeams] = useState<'both' | 'your-team' | 'opponent-team'>('both');
  const [customStatsIndividual, setCustomStatsIndividual] = useState(true);
  const [format, setFormat] = useState<'short' | 'normal' | 'pro'>('normal');
  const [gamesTo, setGamesTo] = useState('4');
  const [bestOf, setBestOf] = useState<'1' | '3' | '5'>('3');
  const [tiebreak, setTiebreak] = useState<'7-point' | '10-point' | 'None'>('7-point');
  const [scoringType, setScoringType] = useState<'ad' | 'no-ad'>('ad');
  const [returnerPicksSide, setReturnerPicksSide] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tiebreakTrigger, setTiebreakTrigger] = useState<'5-5' | '6-6' | '7-7' | '8-8'>('6-6');
  const [earlySetsPoints, setEarlySetsPoints] = useState<'7-point' | '10-point' | 'Golden-7' | 'Golden-10' | 'Custom'>('7-point');
  const [finalSetPoints, setFinalSetPoints] = useState<'7-point' | '10-point' | 'Golden-7' | 'Golden-10' | 'Custom'>('10-point');
  const [customEarlyPoints, setCustomEarlyPoints] = useState('0');
  const [customFinalPoints, setCustomFinalPoints] = useState('0');
  const [matchTiebreakFinalOnly, setMatchTiebreakFinalOnly] = useState(false);
  const [courtStyle, setCourtStyle] = useState<'hard_1' | 'hard_2' | 'clay_court' | 'grass_court'>('hard_1');
  const [courtSurface, setCourtSurface] = useState<'hard' | 'clay' | 'grass' | 'carpet'>('hard');
  const [sideSwitchingFormat, setSideSwitchingFormat] = useState<'normal' | 'wtt' | 'no-swap'>('normal');
  const [tiebreakFormat, setTiebreakFormat] = useState<'standard' | 'wtt'>('standard');
  const [playerError, setPlayerError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Default to intermediate unless user explicitly set a preference in profile settings
    setStatMode(user?.statProfile ?? 'intermediate');
  }, [user?.statProfile]);

  // Cleanup: Reset form state when screen loses focus to prevent white overlay
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused
      return () => {
        // Screen is losing focus - reset form to prevent state persistence
        // This helps prevent white overlay when navigating away
        setStep('players');
        setPlayerError('');
        setCreating(false);
      };
    }, [])
  );

  const createContextMenuOptions = (
    options: string[],
    currentValue: string,
    onValueChange: (value: any) => void,
    labels?: Record<string, string>
  ) => {
    return options.map(opt => ({
      label: formatLabel(opt, labels),
      value: opt,
      onPress: () => onValueChange(opt),
    }));
  };

  const canProceed =
    yourPlayer1.trim() !== '' &&
    oppPlayer1.trim() !== '' &&
    (type === 'singles' || (yourPlayer2.trim() !== '' && oppPlayer2.trim() !== ''));

  const handleNext = () => {
    const players = [yourPlayer1, oppPlayer1];
    if (type === 'doubles') {
      players.push(yourPlayer2, oppPlayer2);
    }
    const playerNames = players.map(p => p.trim()).filter(p => p !== '');
    const hasDuplicates = new Set(playerNames).size !== playerNames.length;

    if (hasDuplicates) {
      setPlayerError('Player names must be unique.');
      return;
    }

    if (canProceed) {
      setPlayerError('');
      setStep('settings');
    } else {
      setPlayerError('Please fill in all required player names.');
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    const filteredCustomStats = statMode === 'basic'
      ? customStats.filter(s => s.trim() !== '')
      : [];

    try {
      if (isGuestMode) {
        // Guest mode: create match locally
        const matchId = `guest-${Date.now()}`;
        const now = new Date().toISOString();

        const guestMatch: Match = {
          id: matchId,
          userId: 'guest',
          matchType: type,
          yourPlayer1,
          yourPlayer1Hand: showPlayerOptions ? yourPlayer1Hand : undefined,
          yourPlayer1Backhand: showPlayerOptions ? yourPlayer1Backhand : undefined,
          yourPlayer2: type === 'doubles' ? yourPlayer2 : undefined,
          yourPlayer2Hand: type === 'doubles' && showPlayerOptions ? yourPlayer2Hand : undefined,
          yourPlayer2Backhand: type === 'doubles' && showPlayerOptions ? yourPlayer2Backhand : undefined,
          oppPlayer1,
          oppPlayer1Hand: showPlayerOptions ? oppPlayer1Hand : undefined,
          oppPlayer1Backhand: showPlayerOptions ? oppPlayer1Backhand : undefined,
          oppPlayer2: type === 'doubles' ? oppPlayer2 : undefined,
          oppPlayer2Hand: type === 'doubles' && showPlayerOptions ? oppPlayer2Hand : undefined,
          oppPlayer2Backhand: type === 'doubles' && showPlayerOptions ? oppPlayer2Backhand : undefined,
          server: undefined as any, // Will be set when match starts
          format,
          gamesTo: parseInt(gamesTo) || 4,
          bestOf,
          tiebreak,
          scoringType,
          returnerPicksSide,
          showPlayerOptions,
          showAdvanced,
          tiebreakTrigger: showAdvanced ? tiebreakTrigger : undefined,
          earlySetsPoints: showAdvanced ? earlySetsPoints : undefined,
          customEarlyPoints: showAdvanced ? (parseInt(customEarlyPoints) || 0) : undefined,
          finalSetPoints: showAdvanced ? finalSetPoints : undefined,
          customFinalPoints: showAdvanced ? (parseInt(customFinalPoints) || 0) : undefined,
          matchTiebreakFinalOnly,
          isPublic: false,
          statMode,
          customStats: filteredCustomStats.length > 0 ? filteredCustomStats : undefined,
          customStatsTeams: filteredCustomStats.length > 0 ? customStatsTeams : undefined,
          customStatsIndividual: filteredCustomStats.length > 0 && type === 'doubles' ? customStatsIndividual : undefined,
          trackForehandBackhand: statMode === 'advanced',
          startingCourtSide: undefined,
          courtStyle,
          courtSurface,
          sideSwitchingFormat: sideSwitchingFormat as 'normal' | 'wtt' | undefined,
          tiebreakFormat,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        const stats = initStats(matchId);
        await saveGuestMatch(guestMatch, stats);

        setStep('players');
        router.back();
        setTimeout(() => {
          router.push(`/(tabs)/matches?guestMatchId=${matchId}&tab=match`);
        }, 100);
      } else {
        // Authenticated mode: create match via API
        await createMatch({
          type,
          yourPlayer1,
          yourPlayer2: type === 'doubles' ? yourPlayer2 : undefined,
          oppPlayer1,
          oppPlayer2: type === 'doubles' ? oppPlayer2 : undefined,
          format,
          gamesTo: parseInt(gamesTo) || 4,
          bestOf,
          tiebreak,
          scoringType,
          returnerPicksSide,
          showPlayerOptions,
          showAdvanced,
          yourPlayer1Hand,
          yourPlayer1Backhand,
          yourPlayer2Hand: type === 'doubles' ? yourPlayer2Hand : undefined,
          yourPlayer2Backhand: type === 'doubles' ? yourPlayer2Backhand : undefined,
          oppPlayer1Hand,
          oppPlayer1Backhand,
          oppPlayer2Hand: type === 'doubles' ? oppPlayer2Hand : undefined,
          oppPlayer2Backhand: type === 'doubles' ? oppPlayer2Backhand : undefined,
          tiebreakTrigger: showAdvanced ? tiebreakTrigger : undefined,
          earlySetsPoints: showAdvanced ? earlySetsPoints : undefined,
          customEarlyPoints: showAdvanced ? (parseInt(customEarlyPoints) || 0) : undefined,
          finalSetPoints: showAdvanced ? finalSetPoints : undefined,
          customFinalPoints: showAdvanced ? (parseInt(customFinalPoints) || 0) : undefined,
          matchTiebreakFinalOnly,
          isPublic,
          statMode,
          customStats: filteredCustomStats,
          customStatsTeams: filteredCustomStats.length > 0 ? customStatsTeams : undefined,
          customStatsIndividual: filteredCustomStats.length > 0 && type === 'doubles' ? customStatsIndividual : undefined,
          courtStyle,
          courtSurface,
          sideSwitchingFormat: sideSwitchingFormat as 'normal' | 'wtt' | undefined,
          tiebreakFormat,
        });
        setStep('players');
        router.back();
        setTimeout(() => {
          router.push('/(tabs)/matches?tab=match');
        }, 100);
      }
    } catch (error) {
      console.error('Failed to create match:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={Platform.OS === 'ios' ? { backgroundColor: 'transparent' } : { backgroundColor: BACKGROUND_COLOR }}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            {step === 'players' ? 'Enter Player Names' : 'Match Settings'}
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
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              {step === 'players' ? (
                <View className="gap-y-6">
                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Match Type</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['singles', 'doubles'], type, setType, { 'singles': 'Singles', 'doubles': 'Doubles' })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(type, { 'singles': 'Singles', 'doubles': 'Doubles' })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => setShowPlayerOptions(!showPlayerOptions)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm text-gray-400">
                      {showPlayerOptions ? 'Hide player options' : 'Show player options'}
                    </Text>
                  </TouchableOpacity>

                  <View className="gap-y-6">
                    <View className="gap-y-2">
                      <Text className="text-white font-semibold text-lg">Your Team</Text>
                      <TextInput
                        placeholder="Your Name"
                        placeholderTextColor="#9ca3af"
                        value={yourPlayer1}
                        onChangeText={setYourPlayer1}
                        style={{
                          width: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          color: '#ffffff',
                          fontSize: 16,
                          minHeight: 44,
                        }}
                      />
                      {type === 'doubles' && (
                        <TextInput
                          placeholder="Partner Name"
                          placeholderTextColor="#9ca3af"
                          value={yourPlayer2}
                          onChangeText={setYourPlayer2}
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: '#ffffff',
                            fontSize: 16,
                            minHeight: 44,
                          }}
                        />
                      )}
                      {showPlayerOptions && (
                        <>
                          <ContextMenu
                            options={createContextMenuOptions(['right', 'left'], yourPlayer1Hand, setYourPlayer1Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                            trigger={
                              <TouchableOpacity
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  minHeight: 44,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                  {formatLabel(yourPlayer1Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                                </Text>
                                <Feather name="chevron-down" size={20} color="#9ca3af" />
                              </TouchableOpacity>
                            }
                          />
                          <ContextMenu
                            options={createContextMenuOptions(['one-handed', 'two-handed'], yourPlayer1Backhand, setYourPlayer1Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                            trigger={
                              <TouchableOpacity
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  minHeight: 44,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                  {formatLabel(yourPlayer1Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                                </Text>
                                <Feather name="chevron-down" size={20} color="#9ca3af" />
                              </TouchableOpacity>
                            }
                          />
                          {type === 'doubles' && (
                            <>
                              <ContextMenu
                                options={createContextMenuOptions(['right', 'left'], yourPlayer2Hand, setYourPlayer2Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                                trigger={
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                      borderWidth: 1,
                                      borderColor: 'rgba(255, 255, 255, 0.3)',
                                      borderRadius: 8,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      minHeight: 44,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                      {formatLabel(yourPlayer2Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                                    </Text>
                                    <Feather name="chevron-down" size={20} color="#9ca3af" />
                                  </TouchableOpacity>
                                }
                              />
                              <ContextMenu
                                options={createContextMenuOptions(['one-handed', 'two-handed'], yourPlayer2Backhand, setYourPlayer2Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                                trigger={
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                      borderWidth: 1,
                                      borderColor: 'rgba(255, 255, 255, 0.3)',
                                      borderRadius: 8,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      minHeight: 44,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                      {formatLabel(yourPlayer2Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                                    </Text>
                                    <Feather name="chevron-down" size={20} color="#9ca3af" />
                                  </TouchableOpacity>
                                }
                              />
                            </>
                          )}
                        </>
                      )}
                    </View>

                    <View className="gap-y-2">
                      <Text className="text-white font-semibold text-lg">Opponent Team</Text>
                      <TextInput
                        placeholder="Opponent Name"
                        placeholderTextColor="#9ca3af"
                        value={oppPlayer1}
                        onChangeText={setOppPlayer1}
                        style={{
                          width: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          color: '#ffffff',
                          fontSize: 16,
                          minHeight: 44,
                        }}
                      />
                      {type === 'doubles' && (
                        <TextInput
                          placeholder="Opponent Partner"
                          placeholderTextColor="#9ca3af"
                          value={oppPlayer2}
                          onChangeText={setOppPlayer2}
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: '#ffffff',
                            fontSize: 16,
                            minHeight: 44,
                          }}
                        />
                      )}
                      {showPlayerOptions && (
                        <>
                          <ContextMenu
                            options={createContextMenuOptions(['right', 'left'], oppPlayer1Hand, setOppPlayer1Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                            trigger={
                              <TouchableOpacity
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  minHeight: 44,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                  {formatLabel(oppPlayer1Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                                </Text>
                                <Feather name="chevron-down" size={20} color="#9ca3af" />
                              </TouchableOpacity>
                            }
                          />
                          <ContextMenu
                            options={createContextMenuOptions(['one-handed', 'two-handed'], oppPlayer1Backhand, setOppPlayer1Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                            trigger={
                              <TouchableOpacity
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  minHeight: 44,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                  {formatLabel(oppPlayer1Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                                </Text>
                                <Feather name="chevron-down" size={20} color="#9ca3af" />
                              </TouchableOpacity>
                            }
                          />
                          {type === 'doubles' && (
                            <>
                              <ContextMenu
                                options={createContextMenuOptions(['right', 'left'], oppPlayer2Hand, setOppPlayer2Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                                trigger={
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                      borderWidth: 1,
                                      borderColor: 'rgba(255, 255, 255, 0.3)',
                                      borderRadius: 8,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      minHeight: 44,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                      {formatLabel(oppPlayer2Hand, { 'right': 'Righty', 'left': 'Lefty' })}
                                    </Text>
                                    <Feather name="chevron-down" size={20} color="#9ca3af" />
                                  </TouchableOpacity>
                                }
                              />
                              <ContextMenu
                                options={createContextMenuOptions(['one-handed', 'two-handed'], oppPlayer2Backhand, setOppPlayer2Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                                trigger={
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                      borderWidth: 1,
                                      borderColor: 'rgba(255, 255, 255, 0.3)',
                                      borderRadius: 8,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      minHeight: 44,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                      {formatLabel(oppPlayer2Backhand, { 'one-handed': 'One-Handed Backhand', 'two-handed': 'Two-Handed Backhand' })}
                                    </Text>
                                    <Feather name="chevron-down" size={20} color="#9ca3af" />
                                  </TouchableOpacity>
                                }
                              />
                            </>
                          )}
                        </>
                      )}
                    </View>
                  </View>

                  {playerError ? (
                    <View className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                      <Text className="text-red-400 text-sm">{playerError}</Text>
                    </View>
                  ) : null}

                  <View className="flex-row justify-end gap-4 pt-4">
                    <TouchableOpacity
                      onPress={() => router.back()}
                      className="px-5 py-2.5 rounded-lg"
                      activeOpacity={0.7}
                    >
                      <Text className="text-gray-400 text-base">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleNext}
                      activeOpacity={0.8}
                      style={{ overflow: 'hidden', borderRadius: 8 }}
                    >
                      <LinearGradient
                        colors={['#1e40af', '#1e3a8a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: 8,
                        }}
                      >
                        <Text className="text-white font-medium text-base">Next</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View className="gap-y-6">
                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Stat Tracking Mode</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['basic', 'intermediate', 'advanced'], statMode, setStatMode, {
                        'basic': 'Basic - Simple score keeping',
                        'intermediate': 'Intermediate - Detailed stats',
                        'advanced': 'Advanced - Comprehensive stats'
                      })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(statMode, {
                              'basic': 'Basic - Simple score keeping',
                              'intermediate': 'Intermediate - Detailed stats',
                              'advanced': 'Advanced - Comprehensive stats'
                            })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                    {statMode === 'basic' && (
                      <Text className="text-xs text-gray-400 mt-1">Track points + up to 3 custom stats of your choice</Text>
                    )}
                    {statMode === 'advanced' && (
                      <Text className="text-xs text-green-400 mt-1">Advanced mode is not yet available</Text>
                    )}
                  </View>

                  {statMode === 'advanced' && (
                    <View>
                      <Text className="text-gray-300 font-medium text-lg mb-2">Court Style</Text>
                      <View className="flex-row flex-wrap gap-3">
                        {[
                          { value: 'hard_1' as const, label: 'Hard Court (Green)', image: require('../assets/hard_1.png') },
                          { value: 'hard_2' as const, label: 'Hard Court (Blue)', image: require('../assets/hard_2.png') },
                          { value: 'clay_court' as const, label: 'Clay Court', image: require('../assets/clay_court.png') },
                          { value: 'grass_court' as const, label: 'Grass Court', image: require('../assets/grass_court.png') },
                        ].map((court) => (
                          <TouchableOpacity
                            key={court.value}
                            onPress={() => {
                              hapticLight();
                              setCourtStyle(court.value);
                            }}
                            activeOpacity={0.7}
                            style={{
                              flex: 1,
                              minWidth: '45%',
                              backgroundColor: courtStyle === court.value ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              borderWidth: 2,
                              borderColor: courtStyle === court.value ? '#22c55e' : 'rgba(255, 255, 255, 0.3)',
                              borderRadius: 12,
                              padding: 12,
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <Image
                              source={court.image}
                              style={{
                                width: 80,
                                height: 80,
                                borderRadius: 8,
                                resizeMode: 'cover',
                              }}
                            />
                            <Text style={{
                              color: courtStyle === court.value ? '#4ade80' : '#ffffff',
                              fontSize: 13,
                              fontWeight: courtStyle === court.value ? '600' : '500',
                              textAlign: 'center',
                            }}>
                              {court.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {statMode === 'basic' && (
                    <View className="gap-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300 font-medium">Custom Stats (Optional)</Text>
                        {customStats.length < 6 && (
                          <TouchableOpacity
                            onPress={() => setCustomStats([...customStats, ''])}
                            className="flex-row items-center gap-1"
                            activeOpacity={0.7}
                          >
                            <Feather name="plus" size={12} color="#2563eb" />
                            <Text className="text-xs" style={{ color: '#2563eb' }}>Add Stat</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text className="text-xs text-gray-400">Track up to 6 custom stats with simple counters</Text>
                      {customStats.map((stat, index) => {
                        const handleDelete = () => {
                          hapticLight();
                          const newStats = customStats.filter((_, i) => i !== index);
                          setCustomStats(newStats);
                        };

                        return (
                          <View
                            key={index}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <View
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderRadius: 8,
                                minHeight: 44,
                              }}
                            >
                              <TextInput
                                placeholder={index === 0 ? 'e.g., Volleys' : index === 1 ? 'e.g., Drop Shots' : 'e.g., Overheads'}
                                placeholderTextColor="#6b7280"
                                value={stat}
                                onChangeText={text => {
                                  const newStats = [...customStats];
                                  newStats[index] = text;
                                  setCustomStats(newStats);
                                }}
                                style={{
                                  flex: 1,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  color: '#ffffff',
                                  fontSize: 14,
                                  minHeight: 44,
                                }}
                                maxLength={30}
                              />
                            </View>
                            {customStats.length > 2 && (
                              <TouchableOpacity
                                onPress={handleDelete}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(239, 68, 68, 0.5)',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                                activeOpacity={0.7}
                              >
                                <Feather name="x" size={18} color="#ef4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}

                      {customStats.some(s => s.trim() !== '') && (
                        <>
                          <View className="pt-3 mt-3 border-t border-white/10">
                            <Text className="text-gray-300 font-medium mb-2">Track Stats For</Text>
                            <ContextMenu
                              options={createContextMenuOptions(['both', 'your-team', 'opponent-team'], customStatsTeams, setCustomStatsTeams, {
                                'both': 'Both Teams',
                                'your-team': 'Your Team Only',
                                'opponent-team': 'Opponent Team Only'
                              })}
                              trigger={
                                <TouchableOpacity
                                  style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    minHeight: 44,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                    {formatLabel(customStatsTeams, {
                                      'both': 'Both Teams',
                                      'your-team': 'Your Team Only',
                                      'opponent-team': 'Opponent Team Only'
                                    })}
                                  </Text>
                                  <Feather name="chevron-down" size={20} color="#9ca3af" />
                                </TouchableOpacity>
                              }
                            />
                            <Text className="text-xs text-gray-400 mt-1">Choose which team(s) to track custom stats for</Text>
                          </View>

                          {type === 'doubles' && (
                            <View className="pt-3 border-t border-white/10">
                              <Text className="text-gray-300 font-medium mb-2">Doubles Tracking</Text>
                              <TouchableOpacity
                                onPress={() => setCustomStatsIndividual(true)}
                                className={`flex-row items-start gap-3 p-3 rounded-lg ${customStatsIndividual
                                  ? 'bg-blue-500/20 border border-blue-500/50'
                                  : 'bg-white/5 border border-white/10'
                                  }`}
                                activeOpacity={0.7}
                              >
                                <View
                                  className={`w-4 h-4 rounded-full border-2 items-center justify-center mt-0.5 ${customStatsIndividual ? 'border-blue-400 bg-blue-400' : 'border-white/30'
                                    }`}
                                >
                                  {customStatsIndividual && <View className="w-2 h-2 bg-white rounded-full" />}
                                </View>
                                <View className="flex-1">
                                  <Text className="text-white font-medium text-sm">Track Individually</Text>
                                  <Text className="text-gray-400 text-xs">Each player has their own stat counters</Text>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setCustomStatsIndividual(false)}
                                className={`flex-row items-start gap-3 p-3 rounded-lg mt-2 ${!customStatsIndividual
                                  ? 'bg-blue-500/20 border border-blue-500/50'
                                  : 'bg-white/5 border border-white/10'
                                  }`}
                                activeOpacity={0.7}
                              >
                                <View
                                  className={`w-4 h-4 rounded-full border-2 items-center justify-center mt-0.5 ${!customStatsIndividual ? 'border-blue-400 bg-blue-400' : 'border-white/30'
                                    }`}
                                >
                                  {!customStatsIndividual && <View className="w-2 h-2 bg-white rounded-full" />}
                                </View>
                                <View className="flex-1">
                                  <Text className="text-white font-medium text-sm">Track as Team</Text>
                                  <Text className="text-gray-400 text-xs">Combined counters for both players on each team</Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  )}

                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Set Type</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['short', 'normal', 'pro'], format, setFormat, { 'short': 'Short Set', 'normal': 'Standard Set', 'pro': 'Pro Set' })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(format, { 'short': 'Short Set', 'normal': 'Standard Set', 'pro': 'Pro Set' })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                  </View>

                  {format === 'short' && (
                    <View>
                      <Text className="text-gray-300 font-medium text-lg mb-2">Games To</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={gamesTo}
                        onChangeText={setGamesTo}
                        style={{
                          width: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          color: '#ffffff',
                          fontSize: 16,
                          minHeight: 44,
                        }}
                      />
                    </View>
                  )}

                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Number of Sets</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['1', '3', '5'], bestOf, setBestOf, { '1': '1 Set', '3': 'Best of 3', '5': 'Best of 5' })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(bestOf, { '1': '1 Set', '3': 'Best of 3', '5': 'Best of 5' })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                  </View>

                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Tiebreak</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['7-point', '10-point', 'None'], tiebreak, setTiebreak)}
                      trigger={
                        <TouchableOpacity
                          style={{ width: '100%' }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              minHeight: 44,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16 }}>
                              {formatLabel(tiebreak)}
                            </Text>
                            <Feather name="chevron-down" size={20} color="#9ca3af" />
                          </View>
                        </TouchableOpacity>
                      }
                    />
                  </View>

                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Scoring Type</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['ad', 'no-ad'], scoringType, setScoringType, { 'ad': 'Advantage', 'no-ad': 'No-Ad' })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(scoringType, { 'ad': 'Advantage', 'no-ad': 'No-Ad' })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                  </View>

                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Side Switching</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['normal', 'wtt', 'no-swap'], sideSwitchingFormat, setSideSwitchingFormat, {
                        'normal': 'Normal - Switch on odd games (1, 3, 5, 7...)',
                        'wtt': 'WTT - Switch every 4 games',
                        'no-swap': 'No Side Swapping'
                      })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(sideSwitchingFormat, {
                              'normal': 'Normal - Switch on odd games (1, 3, 5, 7...)',
                              'wtt': 'WTT - Switch every 4 games',
                              'no-swap': 'None'
                            })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                    <Text className="text-xs text-gray-400 mt-1">
                      {sideSwitchingFormat === 'normal'
                        ? 'Standard tennis format: teams switch sides after games 1, 3, 5, 7, etc.'
                        : sideSwitchingFormat === 'wtt'
                          ? 'World Team Tennis format: teams switch sides after games 4, 8, 12, etc.'
                          : 'No side switching: players stay on the same side throughout the match'}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Tiebreak Format</Text>
                    <ContextMenu
                      options={createContextMenuOptions(['standard', 'wtt'], tiebreakFormat, setTiebreakFormat, {
                        'standard': 'Standard - Win by 2',
                        'wtt': 'WTT - First to 5 (no win by 2)'
                      })}
                      trigger={
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {formatLabel(tiebreakFormat, {
                              'standard': 'Standard - Win by 2',
                              'wtt': 'WTT - First to 5 (no win by 2)'
                            })}
                          </Text>
                          <Feather name="chevron-down" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                    <Text className="text-xs text-gray-400 mt-1">
                      {tiebreakFormat === 'standard'
                        ? 'Standard tiebreak: first to 7 (or 10) points, win by 2'
                        : 'WTT tiebreak: first to 5 points wins. Serve rotation: 2-2-2-3'}
                    </Text>
                  </View>

                  <View className="gap-y-2">
                    <Text className="text-gray-300 font-medium text-lg">Match Visibility</Text>
                    <TouchableOpacity
                      onPress={() => setIsPublic(!isPublic)}
                      className="flex-row items-center justify-between p-3 bg-white/5 rounded-lg"
                      activeOpacity={0.7}
                    >
                      <View>
                        <Text className="text-white font-medium">{isPublic ? 'Public' : 'Private'}</Text>
                        <Text className="text-gray-400 text-xs">
                          {isPublic
                            ? 'Team members can view your match live.'
                            : 'Only you can see this match and its stats.'}
                        </Text>
                      </View>
                      <Switch
                        value={isPublic}
                        onValueChange={setIsPublic}
                        trackColor={{ false: '#4b5563', true: '#1e3a8a' }}
                        thumbColor="#ffffff"
                      />
                    </TouchableOpacity>
                  </View>

                  {scoringType === 'no-ad' && (
                    <View>
                      <Text className="text-gray-300 font-medium text-lg mb-2">Returner Chooses Side?</Text>
                      <ContextMenu
                        options={createContextMenuOptions(['yes', 'no'], returnerPicksSide ? 'yes' : 'no', (val) => setReturnerPicksSide(val === 'yes'))}
                        trigger={
                          <TouchableOpacity
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              minHeight: 44,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16 }}>
                              {returnerPicksSide ? 'Yes' : 'No'}
                            </Text>
                            <Feather name="chevron-down" size={20} color="#9ca3af" />
                          </TouchableOpacity>
                        }
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => setShowAdvanced(!showAdvanced)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm text-gray-400">
                      {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
                    </Text>
                  </TouchableOpacity>

                  {showAdvanced && (
                    <View className="pt-4 border-t border-white/10 gap-y-4">
                      <View>
                        <Text className="text-gray-300 font-medium text-lg mb-2">Tiebreak Trigger Score</Text>
                        <ContextMenu
                          options={createContextMenuOptions(['5-5', '6-6', '7-7', '8-8'], tiebreakTrigger, setTiebreakTrigger)}
                          trigger={
                            <TouchableOpacity
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                minHeight: 44,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                {tiebreakTrigger}
                              </Text>
                              <Feather name="chevron-down" size={20} color="#9ca3af" />
                            </TouchableOpacity>
                          }
                        />
                      </View>

                      <View>
                        <Text className="text-gray-300 font-medium text-lg mb-2">Tiebreak Points (Early Sets)</Text>
                        <ContextMenu
                          key={`early-${customEarlyPoints}`}
                          options={createContextMenuOptions(['7-point', '10-point', 'Golden-7', 'Golden-10', 'Custom'], earlySetsPoints, setEarlySetsPoints, {
                            '7-point': '7-Point',
                            '10-point': '10-Point',
                            'Golden-7': 'Golden tiebreak to 7',
                            'Golden-10': 'Golden tiebreak to 10',
                            'Custom': `Custom (${customEarlyPoints})`
                          })}
                          trigger={
                            <TouchableOpacity
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                minHeight: 44,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                {formatLabel(earlySetsPoints, {
                                  '7-point': '7-Point',
                                  '10-point': '10-Point',
                                  'Golden-7': 'Golden tiebreak to 7',
                                  'Golden-10': 'Golden tiebreak to 10',
                                  'Custom': `Custom (${customEarlyPoints})`
                                })}
                              </Text>
                              <Feather name="chevron-down" size={20} color="#9ca3af" />
                            </TouchableOpacity>
                          }
                        />
                        {earlySetsPoints === 'Custom' && (
                          <TextInput
                            keyboardType="numeric"
                            placeholder="Custom points"
                            placeholderTextColor="#9ca3af"
                            value={customEarlyPoints}
                            onChangeText={setCustomEarlyPoints}
                            style={{
                              marginTop: 8,
                              width: '100%',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              color: '#ffffff',
                              fontSize: 16,
                              minHeight: 44,
                            }}
                          />
                        )}
                      </View>

                      <View>
                        <Text className="text-gray-300 font-medium text-lg mb-2">Tiebreak Points (Final Set)</Text>
                        <ContextMenu
                          key={`final-${customFinalPoints}`}
                          options={createContextMenuOptions(['7-point', '10-point', 'Golden-7', 'Golden-10', 'Custom'], finalSetPoints, setFinalSetPoints, {
                            '7-point': '7-Point',
                            '10-point': '10-Point',
                            'Golden-7': 'Golden tiebreak to 7',
                            'Golden-10': 'Golden tiebreak to 10',
                            'Custom': `Custom (${customFinalPoints})`
                          })}
                          trigger={
                            <TouchableOpacity
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                minHeight: 44,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                {formatLabel(finalSetPoints, {
                                  '7-point': '7-Point',
                                  '10-point': '10-Point',
                                  'Golden-7': 'Golden tiebreak to 7',
                                  'Golden-10': 'Golden tiebreak to 10',
                                  'Custom': `Custom (${customFinalPoints})`
                                })}
                              </Text>
                              <Feather name="chevron-down" size={20} color="#9ca3af" />
                            </TouchableOpacity>
                          }
                        />
                        {finalSetPoints === 'Custom' && (
                          <TextInput
                            keyboardType="numeric"
                            placeholder="Custom points"
                            placeholderTextColor="#9ca3af"
                            value={customFinalPoints}
                            onChangeText={setCustomFinalPoints}
                            style={{
                              marginTop: 8,
                              width: '100%',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              color: '#ffffff',
                              fontSize: 16,
                              minHeight: 44,
                            }}
                          />
                        )}
                      </View>

                      <View>
                        <Text className="text-gray-300 font-medium text-lg mb-2">Court Surface</Text>
                        <ContextMenu
                          options={createContextMenuOptions(['hard', 'clay', 'grass', 'carpet'], courtSurface, setCourtSurface, {
                            'hard': 'Hard Court',
                            'clay': 'Clay Court',
                            'grass': 'Grass Court',
                            'carpet': 'Carpet Court'
                          })}
                          trigger={
                            <TouchableOpacity
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                minHeight: 44,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16 }}>
                                {formatLabel(courtSurface, {
                                  'hard': 'Hard Court',
                                  'clay': 'Clay Court',
                                  'grass': 'Grass Court',
                                  'carpet': 'Carpet Court'
                                })}
                              </Text>
                              <Feather name="chevron-down" size={20} color="#9ca3af" />
                            </TouchableOpacity>
                          }
                        />
                      </View>

                      <View className="flex-row items-center gap-2">
                        <Switch
                          value={matchTiebreakFinalOnly}
                          onValueChange={setMatchTiebreakFinalOnly}
                          trackColor={{ false: '#4b5563', true: '#22c55e' }}
                          thumbColor="#ffffff"
                        />
                        <Text className="text-gray-300">Match tiebreak only in final set</Text>
                      </View>
                    </View>
                  )}

                  <View className="flex-row items-center pt-4">
                    <TouchableOpacity
                      onPress={() => setStep('players')}
                      className="px-5 py-2.5 rounded-lg"
                      activeOpacity={0.7}
                    >
                      <Text className="text-gray-400 text-base">Back</Text>
                    </TouchableOpacity>
                    <View className="flex-1 items-center">
                      <TouchableOpacity
                        onPress={() => router.back()}
                        className="px-5 py-2.5 rounded-lg"
                        activeOpacity={0.7}
                      >
                        <Text className="text-gray-400 text-base">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={handleCreate}
                      disabled={creating}
                      activeOpacity={0.9}
                      style={{ overflow: 'hidden', borderRadius: 9999, opacity: creating ? 0.5 : 1 }}
                    >
                      <LinearGradient
                        colors={['#1e40af', '#1e3a8a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          minHeight: 44,
                        }}
                      >
                        {creating ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Feather name="play" size={16} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>Start Match</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
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
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet';
import { Match, getStats } from '../../../api/matches';
import { getPlayerDisplayName } from '../utils/matchUtils';

interface MatchInfoSheetProps {
  match: Match;
  isOpen: boolean;
  onClose: () => void;
}

export default function MatchInfoSheet({ match, isOpen, onClose }: MatchInfoSheetProps) {
  const insets = useSafeAreaInsets();
  const [displayDuration, setDisplayDuration] = useState('0:00');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !match) return;

    const startTime = match.timerStartedAt
      ? new Date(match.timerStartedAt).getTime()
      : new Date(match.createdAt).getTime();
    const savedPausedMs = match.totalPausedMs || 0;

    const updateDuration = () => {
      let pausedMs = savedPausedMs;
      if (match.isPaused && match.pausedAt) {
        pausedMs += Date.now() - new Date(match.pausedAt).getTime();
      }
      const diff = Math.max(0, Math.floor((Date.now() - startTime - pausedMs) / 1000));
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setDisplayDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    getStats(match.id)
      .then(setStats)
      .catch(() => {});

    return () => clearInterval(interval);
  }, [isOpen, match]);

  if (!match) return null;

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = yourTeamIds.length > 1;
  const yourTeamNames = yourTeamIds.map(name => getPlayerDisplayName(name, isDoubles));
  const oppTeamNames = oppTeamIds.map(name => getPlayerDisplayName(name, isDoubles));

  return (
    <PlatformBottomSheet
      isOpened={isOpen}
      onIsOpenedChange={(opened) => !opened && onClose()}
      presentationDragIndicator="visible"
      presentationDetents={[0.5, 0.8]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Match Information</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Players</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Your Team</Text>
            <Text style={styles.value}>{yourTeamNames.join(' / ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Opponent</Text>
            <Text style={styles.value}>{oppTeamNames.join(' / ')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Type</Text>
            <Text style={styles.value}>
              {match.matchType.charAt(0).toUpperCase() + match.matchType.slice(1)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Format</Text>
            <Text style={styles.value}>
              {match.format === 'pro' ? 'Pro' : match.format === 'normal' ? 'Standard' : 'Short'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Best of</Text>
            <Text style={styles.value}>{match.bestOf} {match.bestOf === '1' ? 'Set' : 'Sets'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Games to</Text>
            <Text style={styles.value}>{match.gamesTo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tiebreak</Text>
            <Text style={styles.value}>
              {match.tiebreak === 'None' ? 'None' : match.tiebreak === '7-point' ? '7-Point' : '10-Point'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Scoring</Text>
            <Text style={styles.value}>
              {match.scoringType === 'ad' ? 'Advantage' : 'No-Ad'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{displayDuration}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>
              {match.status === 'active' ? 'Active' : 'Completed'}
            </Text>
          </View>
          {stats && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Total Points</Text>
                <Text style={styles.value}>
                  {stats.totalPoints || 0}
                </Text>
              </View>
            </>
          )}
        </View>

        {match.courtStyle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Court</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Surface</Text>
              <Text style={styles.value}>
                {match.courtStyle === 'hard_1' || match.courtStyle === 'hard_2' 
                  ? 'Hard Court' 
                  : match.courtStyle === 'clay_court' 
                  ? 'Clay Court' 
                  : 'Grass Court'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </PlatformBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
});

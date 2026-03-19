import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Match } from '../../../api/matches';
import { getPlayerDisplayName } from '../utils/matchUtils';
import { hapticLight } from '../../../utils/haptics';

interface MatchInfoProps {
  match: Match;
  displayDuration: string;
  isMatchFinished: boolean;
  onEndMatch: () => void;
}

const MatchInfo = ({ match, displayDuration, isMatchFinished, onEndMatch }: MatchInfoProps) => {
  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = yourTeamIds.length > 1;
  const oppTeamNames = oppTeamIds.filter(Boolean) as string[];
  const oppTeamDisplayName = oppTeamNames.map(name => getPlayerDisplayName(name, isDoubles)).join('/');

  return (
    <View
      className="p-6 relative rounded-2xl bg-white/5 border border-white/10"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Text className="text-lg font-bold text-white mb-4">Match Info</Text>
      <View className="gap-y-3">
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-300">Opponent</Text>
          <Text className="text-white text-sm truncate text-right pl-4" numberOfLines={1}>
            {oppTeamDisplayName}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-300">Type</Text>
          <Text className="text-white text-sm">
            {match.matchType.charAt(0).toUpperCase() + match.matchType.slice(1)}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-300">Format</Text>
          <Text className="text-white text-sm">
            {match.format === 'pro'
              ? 'Pro'
              : match.format === 'normal'
              ? 'Normal'
              : 'Short'}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-300">Duration</Text>
          <Text className="text-white text-sm">{displayDuration}</Text>
        </View>
      </View>
    </View>
  );
};

export default MatchInfo;


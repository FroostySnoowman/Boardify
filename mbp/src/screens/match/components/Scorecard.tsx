import React from 'react';
import { View } from 'react-native';
import LiveMatchScorecard from '../../../components/LiveMatchScorecard';
import { ScorecardProps } from '../utils/types';

/**
 * Match page scorecard. Uses the same design as the spectate page (LiveMatchScorecard).
 */
const Scorecard: React.FC<ScorecardProps> = (props) => {
  const {
    title,
    status = '',
    time = '',
    isLive = false,
    player1Names,
    player1Sets,
    player2Names,
    player2Sets,
    player1Serving = false,
    player2Serving = false,
    player1IsWinner = false,
    player2IsWinner = false,
    player1GameScore = '',
    player2GameScore = '',
  } = props;

  const headerRight =
    !isLive && (status || time)
      ? `${status}${time ? ` · ${time}` : ''}`
      : undefined;

  return (
    <View className="p-4 rounded-2xl bg-white/5 border border-white/10">
      <LiveMatchScorecard
        title={title}
        status={status}
        time={time}
        isLive={isLive}
        headerRight={headerRight}
        player1Names={player1Names}
        player1Sets={player1Sets}
        player2Names={player2Names}
        player2Sets={player2Sets}
        player1Serving={player1Serving}
        player2Serving={player2Serving}
        player1IsWinner={player1IsWinner}
        player2IsWinner={player2IsWinner}
        player1GameScore={player1GameScore}
        player2GameScore={player2GameScore}
      />
    </View>
  );
};

export default Scorecard;

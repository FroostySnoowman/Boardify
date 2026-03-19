import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface SetScore {
  mainScore: number;
  tiebreakScore?: number;
}

export interface LiveMatchScorecardProps {
  /** Header left: when isLive, shows LIVE badge; else shows this (e.g. "Final Score") */
  title: string;
  status?: string;
  time?: string;
  isLive?: boolean;
  /** When true, show red pulsing LIVE badge (e.g. stream active). When false, green dot + "Live" */
  useRedLiveIndicator?: boolean;
  /** Override right side of header (e.g. creator username on spectate). Else title + status + time */
  headerRight?: string;
  player1Names: string[];
  player1Sets: (number | SetScore)[];
  player2Names: string[];
  player2Sets: (number | SetScore)[];
  player1Serving?: boolean;
  player2Serving?: boolean;
  player1IsWinner?: boolean;
  player2IsWinner?: boolean;
  player1GameScore?: number | string;
  player2GameScore?: number | string;
  onPress?: () => void;
}

const TennisBallIcon = () => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(-180)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 0,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  return (
    <Animated.View
      style={{
        marginLeft: 8,
        transform: [
          { scale: scaleAnim },
          {
            rotate: rotateAnim.interpolate({
              inputRange: [-180, 0],
              outputRange: ['-180deg', '0deg'],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#60a5fa',
        }}
      />
    </Animated.View>
  );
};

const LiveIndicatorRed = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();
    glowAnimation.start();
    return () => {
      pulseAnimation.stop();
      glowAnimation.stop();
    };
  }, [pulseAnim, glowAnim]);

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#ef4444',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 20,
          gap: 6,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 20,
            backgroundColor: '#ef4444',
            opacity: glowAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.2, 0.4] }),
            transform: [{ scale: pulseAnim }],
          }}
        />
        <Animated.View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#ffffff',
            transform: [{ scale: pulseAnim }],
          }}
        />
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 }}>
          LIVE
        </Text>
      </View>
    </View>
  );
};

function getMainScore(set: number | SetScore): number {
  if (typeof set === 'object' && set && 'mainScore' in set) return set.mainScore;
  if (typeof set === 'number') return set;
  return 0;
}

export default function LiveMatchScorecard({
  title,
  status = '',
  time = '',
  isLive = false,
  useRedLiveIndicator = false,
  headerRight,
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
  onPress,
}: LiveMatchScorecardProps) {
  const liveDotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLive || useRedLiveIndicator) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotPulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(liveDotPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isLive, useRedLiveIndicator, liveDotPulse]);

  const rightText =
    headerRight !== undefined
      ? headerRight
      : isLive
        ? [title, status, time].filter(Boolean).join(' · ')
        : [status, time].filter(Boolean).join(' · ');

  const p1Name = player1Names.join(' / ');
  const p2Name = player2Names.join(' / ');

  const renderSetScore = (
    set: number | SetScore,
    i: number,
    isP1: boolean
  ) => {
    const otherSet = isP1 ? player2Sets[i] : player1Sets[i];
    const won = getMainScore(set) > getMainScore(otherSet);
    const score = typeof set === 'object' && set && 'mainScore' in set ? set.mainScore : set;
    return (
      <Text
        key={i}
        className="text-lg font-light text-white text-center"
        style={{ minWidth: 24 }}
      >
        {score}
      </Text>
    );
  };

  const scoreContent = (
    <View>
      <View className="flex-row items-center py-2 border-b border-white/10">
        <View className="flex-row items-center w-2/5">
          <Text
            className="text-lg font-semibold"
            style={{ color: player1Serving ? '#60a5fa' : '#ffffff' }}
            numberOfLines={1}
          >
            {p1Name}
          </Text>
          {player1Serving && <TennisBallIcon />}
        </View>
        <View className="flex-1 flex-row justify-center">
          {player1Sets.map((set, i) => renderSetScore(set, i, true))}
        </View>
        <View
          className="ml-4 px-3 py-1 bg-white/10 border border-white/20 rounded-lg items-center justify-center"
          style={{ width: 52 }}
        >
          <Text
            className="text-lg font-bold text-white"
            style={{ textAlign: 'center' }}
            numberOfLines={1}
          >
            {player1GameScore ?? '-'}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center py-2">
        <View className="flex-row items-center w-2/5">
          <Text
            className="text-lg font-semibold"
            style={{ color: player2Serving ? '#60a5fa' : '#ffffff' }}
            numberOfLines={1}
          >
            {p2Name}
          </Text>
          {player2Serving && <TennisBallIcon />}
        </View>
        <View className="flex-1 flex-row justify-center">
          {player2Sets.map((set, i) => renderSetScore(set, i, false))}
        </View>
        <View
          className="ml-4 px-3 py-1 bg-white/10 border border-white/20 rounded-lg items-center justify-center"
          style={{ width: 52 }}
        >
          <Text
            className="text-lg font-bold text-white"
            style={{ textAlign: 'center' }}
            numberOfLines={1}
          >
            {player2GameScore ?? '-'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View>
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          {isLive ? (
            useRedLiveIndicator ? (
              <LiveIndicatorRed />
            ) : (
              <>
                <View style={{ position: 'relative', width: 10, height: 10 }}>
                  <View
                    style={{
                      position: 'absolute',
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: '#60a5fa',
                      opacity: 0.75,
                    }}
                  />
                  <Animated.View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: '#60a5fa',
                      opacity: liveDotPulse,
                    }}
                  />
                </View>
                <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
                  Live
                </Text>
              </>
            )
          ) : (
            <Text className="text-sm font-semibold text-white">{title}</Text>
          )}
        </View>
        {(rightText || isLive) && (
          <Text className="text-sm text-gray-400 font-medium" numberOfLines={1}>
            {rightText}
          </Text>
        )}
      </View>

      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {scoreContent}
        </TouchableOpacity>
      ) : (
        scoreContent
      )}
    </View>
  );
}

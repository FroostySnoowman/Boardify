import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { Stats, CompletedSet } from '../api/matches';

interface TennisScorecardProps {
    player1Names: string[];
    player2Names: string[];
    stats: Stats;
    isLive?: boolean;
    viewerCount?: number;
    showViewerCount?: boolean;
    matchStartTime?: Date;
    /** Position of the scorecard overlay */
    position?: 'topLeft' | 'top' | 'bottomLeft';
}

/**
 * Clean, Transparent Tennis Scorecard Overlay
 * Inspired by professional broadcast overlays with:
 * - Glassmorphism/frosted glass effect
 * - Minimal, clean design
 * - Player names with serving indicator
 * - Set and game scores in clean columns
 */
export default function TennisScorecard({
    player1Names,
    player2Names,
    stats,
    isLive = true,
    viewerCount = 0,
    showViewerCount = true,
    position = 'topLeft',
}: TennisScorecardProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Subtle pulse for live indicator
    useEffect(() => {
        if (!isLive) return;

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [isLive, pulseAnim]);

    // Calculate scores
    const player1Ids = player1Names;
    const player2Ids = player2Names;

    // Get set scores
    const completedSets = stats.sets || [];
    const currentSetGames = stats.currentSet?.games || {};

    // Calculate sets won
    const getSetsWon = () => {
        let p1Sets = 0;
        let p2Sets = 0;

        completedSets.forEach((set: CompletedSet) => {
            const p1Games = player1Ids.reduce((sum, id) => sum + (set.games[id] || 0), 0);
            const p2Games = player2Ids.reduce((sum, id) => sum + (set.games[id] || 0), 0);
            if (p1Games > p2Games) p1Sets++;
            else if (p2Games > p1Games) p2Sets++;
        });

        return { p1: p1Sets, p2: p2Sets };
    };

    // Get current set games
    const getCurrentSetGames = () => {
        const p1Games = player1Ids.reduce((sum, id) => sum + (currentSetGames[id] || 0), 0);
        const p2Games = player2Ids.reduce((sum, id) => sum + (currentSetGames[id] || 0), 0);
        return { p1: p1Games, p2: p2Games };
    };

    // Get current game score
    const getCurrentGameScore = () => {
        const currentGame = stats.currentGame;
        if (!currentGame) return { p1: '0', p2: '0' };

        // Check if in tiebreak
        if (stats.currentSet?.tiebreak) {
            const p1Points = player1Ids.reduce((sum, id) => sum + (stats.currentSet.tiebreak![id] || 0), 0);
            const p2Points = player2Ids.reduce((sum, id) => sum + (stats.currentSet.tiebreak![id] || 0), 0);
            return { p1: p1Points.toString(), p2: p2Points.toString() };
        }

        return {
            p1: currentGame.serverDisplay || '0',
            p2: currentGame.receiverDisplay || '0',
        };
    };

    // Check who is serving
    const isPlayer1Serving = stats.server ? player1Ids.includes(stats.server) : false;
    const isPlayer2Serving = stats.server ? player2Ids.includes(stats.server) : false;

    const setsWon = getSetsWon();
    const currentGames = getCurrentSetGames();
    const gameScore = getCurrentGameScore();

    // Format player names - use last name or full name if short
    const formatName = (names: string[]) => {
        return names.map(name => {
            const parts = name.split(' ');
            if (parts.length > 1 && name.length > 12) {
                return parts[parts.length - 1];
            }
            return name;
        }).join(' / ');
    };

    const player1Display = formatName(player1Ids);
    const player2Display = formatName(player2Ids);

    // Position styles
    const getPositionStyle = () => {
        switch (position) {
            case 'topLeft':
                return styles.positionTopLeft;
            case 'top':
                return styles.positionTop;
            case 'bottomLeft':
                return styles.positionBottomLeft;
            default:
                return styles.positionTopLeft;
        }
    };

    return (
        <View style={[styles.container, getPositionStyle()]}>
            <View style={styles.scorecardWrapper}>
                <BlurView intensity={40} tint="dark" style={styles.blurView}>
                    <View style={styles.scorecard}>
                        <View style={styles.playerRow}>
                            <View style={styles.servingColumn}>
                                {isPlayer1Serving && (
                                    <View style={styles.servingDot} />
                                )}
                            </View>

                            <Text style={styles.playerName} numberOfLines={1}>
                                {player1Display}
                            </Text>

                            <View style={styles.scoreColumn}>
                                <Text style={[
                                    styles.scoreText,
                                    setsWon.p1 > setsWon.p2 && styles.leadingScore
                                ]}>
                                    {setsWon.p1}
                                </Text>
                            </View>

                            <View style={styles.scoreColumn}>
                                <Text style={[
                                    styles.scoreText,
                                    currentGames.p1 > currentGames.p2 && styles.leadingScore
                                ]}>
                                    {currentGames.p1}
                                </Text>
                            </View>

                            {!stats.matchWinner && (
                                <View style={[styles.scoreColumn, styles.gameColumn]}>
                                    <Text style={styles.gameScoreText}>
                                        {gameScore.p1}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.playerRow}>
                            <View style={styles.servingColumn}>
                                {isPlayer2Serving && (
                                    <View style={styles.servingDot} />
                                )}
                            </View>

                            <Text style={styles.playerName} numberOfLines={1}>
                                {player2Display}
                            </Text>

                            <View style={styles.scoreColumn}>
                                <Text style={[
                                    styles.scoreText,
                                    setsWon.p2 > setsWon.p1 && styles.leadingScore
                                ]}>
                                    {setsWon.p2}
                                </Text>
                            </View>

                            <View style={styles.scoreColumn}>
                                <Text style={[
                                    styles.scoreText,
                                    currentGames.p2 > currentGames.p1 && styles.leadingScore
                                ]}>
                                    {currentGames.p2}
                                </Text>
                            </View>

                            {!stats.matchWinner && (
                                <View style={[styles.scoreColumn, styles.gameColumn]}>
                                    <Text style={styles.gameScoreText}>
                                        {gameScore.p2}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </BlurView>
            </View>

            {(isLive || showViewerCount) && (
                <View style={styles.statusBar}>
                    {isLive && (
                        <View style={styles.liveBadge}>
                            <Animated.View
                                style={[
                                    styles.liveDot,
                                    { opacity: pulseAnim }
                                ]}
                            />
                            <Text style={styles.liveText}>LIVE</Text>
                        </View>
                    )}

                    {showViewerCount && viewerCount > 0 && (
                        <View style={styles.viewerBadge}>
                            <Feather name="eye" size={12} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.viewerText}>{viewerCount}</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 100,
        elevation: 100,
    },
    positionTopLeft: {
        top: 50,
        left: 16,
    },
    positionTop: {
        top: 50,
        left: 16,
        right: 16,
        alignItems: 'flex-start',
    },
    positionBottomLeft: {
        bottom: 80,
        left: 16,
    },
    scorecardWrapper: {
        borderRadius: 8,
        overflow: 'hidden',
        // Subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    blurView: {
        overflow: 'hidden',
        borderRadius: 8,
    },
    scorecard: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingVertical: 4,
        minWidth: 200,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    servingColumn: {
        width: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    servingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    playerName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
        marginRight: 12,
        minWidth: 100,
        maxWidth: 140,
    },
    scoreColumn: {
        width: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gameColumn: {
        width: 32,
        marginLeft: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        paddingVertical: 2,
    },
    scoreText: {
        fontSize: 15,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
    },
    leadingScore: {
        color: '#ffffff',
        fontWeight: '700',
    },
    gameScoreText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginHorizontal: 8,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ffffff',
    },
    liveText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    viewerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4,
    },
    viewerText: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
});

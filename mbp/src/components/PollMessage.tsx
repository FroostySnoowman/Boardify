import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { getPoll, votePoll, removePollVote, PollData } from '../api/messages';
import { Avatar } from './Avatar';
import { PlatformBottomSheet } from './PlatformBottomSheet';

interface PollMessageProps {
  pollId: string;
  question: string;
  isMine: boolean;
  initialPollData?: PollData;
  refreshKey?: number;
}

export function PollMessage({ pollId, question, isMine, initialPollData, refreshKey }: PollMessageProps) {
  const [poll, setPoll] = useState<PollData | null>(initialPollData || null);
  const [loading, setLoading] = useState(!initialPollData);
  const [hasRealData, setHasRealData] = useState(!initialPollData);
  const [voting, setVoting] = useState<string | null>(null);
  const [votersOpen, setVotersOpen] = useState(false);

  const loadPoll = useCallback(async () => {
    try {
      const data = await getPoll(pollId);
      setPoll(data);
    } catch (e) {
      console.warn('Failed to load poll:', e);
    } finally {
      setLoading(false);
      setHasRealData(true);
    }
  }, [pollId]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll, initialPollData]);

  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      loadPoll();
    }
  }, [refreshKey, loadPoll]);

  const handleVote = async (optionId: string) => {
    if (!poll) return;
    hapticMedium();
    setVoting(optionId);

    try {
      const isAlreadyVoted = poll.myVotes.includes(optionId);
      if (isAlreadyVoted) {
        await removePollVote(pollId, optionId);
      } else {
        await votePoll(pollId, optionId);
      }
      await loadPoll();
    } catch (e: any) {
      console.warn('Vote failed:', e?.message);
    } finally {
      setVoting(null);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <Text style={s.question}>{question}</Text>
        <ActivityIndicator size="small" color="#a855f7" style={{ marginTop: 8 }} />
      </View>
    );
  }

  if (!poll) {
    return (
      <View style={s.container}>
        <Text style={s.errorText}>Failed to load poll</Text>
      </View>
    );
  }

  const totalVotes = poll.totalVotes;
  const hasVoted = poll.myVotes.length > 0;
  const canShowVoters = !poll.anonymous && totalVotes > 0;

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Feather name="bar-chart-2" size={14} color="#a855f7" />
        <Text style={s.headerLabel}>Poll</Text>
      </View>

      <Text style={s.question}>{poll.question}</Text>

      {poll.options.map((option) => {
        const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
        const isMyVote = poll.myVotes.includes(option.id);
        const isVoting = voting === option.id;

        return (
          <TouchableOpacity
            key={option.id}
            onPress={() => handleVote(option.id)}
            disabled={!!voting || !hasRealData || (poll.closesAt !== null && Date.now() / 1000 > poll.closesAt)}
            style={s.optionTouchable}
            activeOpacity={0.7}
          >
            <View style={[s.optionCard, isMyVote && s.optionCardSelected]}>
              <View
                style={[
                  s.fillBar,
                  {
                    width: `${percentage}%`,
                    backgroundColor: isMyVote
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'rgba(255, 255, 255, 0.06)',
                  },
                ]}
              />
              <View style={s.optionInner}>
                <View style={s.optionContent}>
                  <View style={s.optionLabelRow}>
                    {isMyVote && (
                      <View style={s.checkBadge}>
                        <Feather name="check" size={11} color="white" />
                      </View>
                    )}
                    <Text
                      style={[
                        s.optionLabel,
                        isMyVote && s.optionLabelSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <View style={s.optionMeta}>
                    {isVoting ? (
                      <ActivityIndicator size="small" color="#a855f7" />
                    ) : (
                      <>
                        <Text style={s.voteCount}>({option.voteCount})</Text>
                        {hasVoted && (
                          <Text style={s.percentage}>{percentage}%</Text>
                        )}
                      </>
                    )}
                  </View>
                </View>

                {!poll.anonymous && option.voters.length > 0 && (
                  <View style={s.voterRow}>
                    {option.voters.slice(0, 5).map((voter) => (
                      <View key={voter.id} style={s.voterAvatar}>
                        <Avatar
                          src={voter.profilePictureUrl}
                          alt={voter.username}
                          size="xs"
                        />
                      </View>
                    ))}
                    {option.voters.length > 5 && (
                      <View style={s.voterOverflow}>
                        <Text style={s.voterOverflowText}>+{option.voters.length - 5}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={s.footer}>
        {canShowVoters ? (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setVotersOpen(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.footerTextTappable}>
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
              {poll.allowMultiple ? '  ·  Multiple choices' : ''}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.footerText}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            {poll.allowMultiple ? '  ·  Multiple choices' : ''}
          </Text>
        )}
        <TouchableOpacity onPress={loadPoll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {canShowVoters && (
        <PlatformBottomSheet
          isOpened={votersOpen}
          onIsOpenedChange={(opened) => !opened && setVotersOpen(false)}
          presentationDetents={[0.55]}
          presentationDragIndicator="visible"
        >
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Votes</Text>
          </View>
          <ScrollView
            style={s.sheetBody}
            contentContainerStyle={s.sheetBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {poll.options.map((option) => {
              if (option.voters.length === 0) return null;
              const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
              return (
                <View key={option.id} style={s.sheetOptionSection}>
                  <View style={s.sheetOptionHeader}>
                    <Text style={s.sheetOptionLabel} numberOfLines={1}>{option.label}</Text>
                    <Text style={s.sheetOptionCount}>{option.voteCount} ({pct}%)</Text>
                  </View>
                  {option.voters.map((voter) => (
                    <View key={voter.id} style={s.sheetVoterRow}>
                      <Avatar
                        src={voter.profilePictureUrl}
                        alt={voter.username}
                        size="sm"
                      />
                      <Text style={s.sheetVoterName}>{voter.username}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </PlatformBottomSheet>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    marginVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 280,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerLabel: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  question: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 14,
  },
  errorText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  optionTouchable: {
    marginBottom: 8,
  },
  optionCard: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionCardSelected: {
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  optionInner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#cbd5e1',
    fontSize: 15,
    flex: 1,
  },
  optionLabelSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voteCount: {
    color: '#9ca3af',
    fontSize: 12,
  },
  percentage: {
    color: '#6b7280',
    fontSize: 12,
    minWidth: 32,
    textAlign: 'right',
  },
  voterRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  voterAvatar: {
    marginRight: -4,
  },
  voterOverflow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  voterOverflowText: {
    color: '#cbd5e1',
    fontSize: 9,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
  },
  footerTextTappable: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '500',
  },
  refreshText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '500',
  },
  // Bottom sheet styles
  sheetHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sheetOptionSection: {
    marginBottom: 20,
  },
  sheetOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetOptionLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  sheetOptionCount: {
    color: '#9ca3af',
    fontSize: 13,
  },
  sheetVoterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sheetVoterName: {
    color: '#e2e8f0',
    fontSize: 15,
  },
});

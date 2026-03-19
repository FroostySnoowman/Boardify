import React, { useState } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

const BACKGROUND_COLOR = '#020617';

function FeatureCard({ icon, color, title, description }: { icon: string; color: string; title: string; description: string }) {
  return (
    <View style={s.featureCard}>
      <View style={[s.featureIcon, { backgroundColor: color + '20' }]}>
        <Feather name={icon as any} size={22} color={color} />
      </View>
      <View style={s.featureTextWrap}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureDesc}>{description}</Text>
      </View>
    </View>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepBadge}>
        <Text style={s.stepNum}>{num}</Text>
      </View>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(!open)} style={s.faqItem}>
      <View style={s.faqHeader}>
        <Text style={s.faqQuestion}>{question}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
      </View>
      {open && <Text style={s.faqAnswer}>{answer}</Text>}
    </TouchableOpacity>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={s.tipRow}>
      <Feather name="zap" size={16} color="#fbbf24" style={{ marginTop: 2 }} />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

export default function HelpMatchesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Matches Help
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(239,68,68,0.14)', 'rgba(251,146,60,0.10)', 'rgba(2,6,23,0.97)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View style={s.wrapper}>
          <View style={s.hero}>
            <View style={s.heroIconWrap}>
              <Feather name="activity" size={36} color="#ef4444" />
            </View>
            <Text style={s.heroTitle}>Your Matches</Text>
            <Text style={s.heroSub}>Track live scores, review match history, analyze your stats, and keep notes on every match.</Text>
          </View>

          <Text style={s.sectionHeader}>Features</Text>
          <FeatureCard icon="play-circle" color="#ef4444" title="Live Match Tracking" description="Start a match and track every point in real time. The app handles scoring rules automatically — just tap who won each point." />
          <FeatureCard icon="clock" color="#fb923c" title="Match History" description="Browse all your past matches in one scrollable list. Search by opponent, date, or score. Tap any match to see the full breakdown." />
          <FeatureCard icon="trending-up" color="#22c55e" title="Statistics & Analytics" description="See your win rate, serving percentages, error trends, and more. Filter by date range, opponent, or match type to spot patterns." />
          <FeatureCard icon="file-text" color="#60a5fa" title="Match Notes" description="Write pre-match plans, post-match reflections, or training notes. Notes are linked to specific matches so you can review them later." />
          <FeatureCard icon="search" color="#a78bfa" title="Search Everything" description="Use the search bar to find any match, note, or statistic instantly. Works across all your data." />
          <FeatureCard icon="award" color="#fbbf24" title="Stat Profiles" description="Choose Basic, Intermediate, or Advanced stat tracking in Settings. Basic is great for casual players, Advanced captures everything a coach would want." />

          <Text style={s.sectionHeader}>Quick Start</Text>
          <View style={s.stepsCard}>
            <Step num={1} text='Tap "New Match" to start tracking a match.' />
            <Step num={2} text="Enter the players or teams, choose the format (singles or doubles), and set the scoring rules." />
            <Step num={3} text="During the match, tap the player who won each point. The score updates automatically." />
            <Step num={4} text="When the match ends, review the scorecard and full statistics breakdown." />
            <Step num={5} text="Add a post-match note to record what went well and what to work on." />
          </View>

          <Text style={s.sectionHeader}>Common Questions</Text>
          <View style={s.faqCard}>
            <FAQ question="How do I start a new match?" answer='Tap the red "New Match" button at the top of the Matches tab. Fill in the player names, choose singles or doubles, and set the format (best of 3, best of 5, etc.). Then tap Start Match.' />
            <FAQ question="What stats does the app track?" answer="It depends on your Stat Profile (Basic, Intermediate, or Advanced). At minimum you get aces, double faults, winners, and unforced errors. Advanced mode adds first-serve percentage, break points, net points, and much more." />
            <FAQ question="Can I undo a point if I tapped the wrong player?" answer="Yes — tap the Undo button (arrow icon) at the top of the live match screen. It will remove the last recorded point." />
            <FAQ question="How do I view old matches?" answer="Go to the History tab within Matches. You'll see all your past matches listed by date. Tap any match to open its scorecard and stats." />
            <FAQ question="What are match notes for?" answer="Notes let you write down thoughts before, during, or after a match. Use them for game plans, opponent tendencies, or personal reflections. They're linked to the match so you can review them anytime." />
            <FAQ question="Can I change the scoring format mid-match?" answer="Not during a match — the format is locked once you start. If you need different rules, end the current match and start a new one with the correct settings." />
            <FAQ question="What happens if the app closes during a match?" answer="Your match progress is saved automatically. When you reopen the app, you'll be taken back to the live match right where you left off." />
          </View>

          <Text style={s.sectionHeader}>Tips</Text>
          <View style={s.tipsCard}>
            <Tip text="Write a quick pre-match note with your game plan — it helps you stay focused during play." />
            <Tip text="Check Statistics regularly to spot trends like serving accuracy changes over time." />
            <Tip text="Use the History search to compare performances against the same opponent across matches." />
            <Tip text="If you're coaching, Advanced stat mode gives you detailed data for player development." />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  wrapper: { maxWidth: 600, alignSelf: 'center', width: '100%' },

  hero: { alignItems: 'center', marginBottom: 32, gap: 12 },
  heroIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(239,68,68,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  heroTitle: { color: '#ffffff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: '#94a3b8', fontSize: 17, lineHeight: 24, textAlign: 'center', paddingHorizontal: 12 },

  sectionHeader: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginTop: 28, marginBottom: 14 },

  featureCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, marginBottom: 10, gap: 14, alignItems: 'flex-start' },
  featureIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  featureTextWrap: { flex: 1, gap: 4 },
  featureTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  featureDesc: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },

  stepsCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 18, gap: 16 },
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.18)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNum: { color: '#ef4444', fontSize: 14, fontWeight: '800' },
  stepText: { color: '#cbd5e1', fontSize: 16, lineHeight: 23, flex: 1 },

  faqCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  faqItem: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqQuestion: { color: '#f1f5f9', fontSize: 16, fontWeight: '600', flex: 1 },
  faqAnswer: { color: '#94a3b8', fontSize: 15, lineHeight: 23, marginTop: 10 },

  tipsCard: { backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)', padding: 18, gap: 14 },
  tipRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipText: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, flex: 1 },
});

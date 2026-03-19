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

export default function HelpSpectateScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Spectate Help
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(99,102,241,0.14)', 'rgba(168,85,247,0.10)', 'rgba(2,6,23,0.97)']}
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
              <Feather name="eye" size={36} color="#818cf8" />
            </View>
            <Text style={s.heroTitle}>Spectate</Text>
            <Text style={s.heroSub}>Watch live matches, follow scores in real time, listen to radio commentary, and start your own stream.</Text>
          </View>

          <Text style={s.sectionHeader}>Features</Text>
          <FeatureCard icon="video" color="#818cf8" title="Live Video Streams" description="Watch live video streams of matches happening right now. Tap a match to open the stream and watch in-app or go fullscreen." />
          <FeatureCard icon="grid" color="#60a5fa" title="Live Scorecard" description="Follow the point-by-point score of any live match. See sets, games, and the current game score — all updating in real time." />
          <FeatureCard icon="radio" color="#22c55e" title="Radio Commentary" description="Listen to live audio commentary while you're on the go. Perfect when you can't watch but still want to follow the action." />
          <FeatureCard icon="search" color="#f472b6" title="Search Matches" description="Find public matches by player name, team, or tournament. Discover matches from players all around the world." />
          <FeatureCard icon="filter" color="#fb923c" title="Filter by Team" description="Use the menu to filter matches by All, Personal, or a specific team. Great when you only want to see your team's matches." />
          <FeatureCard icon="cast" color="#ef4444" title="Start a Stream" description="Broadcast your own match live. Start a stream from the Spectate tab and share the link with anyone who wants to watch." />

          <Text style={s.sectionHeader}>How to Watch a Match</Text>
          <View style={s.stepsCard}>
            <Step num={1} text="Open the Spectate tab. You'll see all live matches." />
            <Step num={2} text="Tap a match card to open it." />
            <Step num={3} text="If there's a video stream, it will play automatically. Tap the video or 'Watch Fullscreen' for a bigger view." />
            <Step num={4} text="Use the Scorecard button below the stream to see the live score breakdown." />
            <Step num={5} text="Tap Radio to listen to live commentary instead of (or alongside) the video." />
          </View>

          <Text style={s.sectionHeader}>How to Start a Stream</Text>
          <View style={s.stepsCard}>
            <Step num={1} text='Tap "New Stream" in the top bar of the Spectate tab.' />
            <Step num={2} text="Enter a stream name and choose the match you want to broadcast." />
            <Step num={3} text="Tap 'Start Streaming' to open the camera view and begin broadcasting live." />
            <Step num={4} text="Share the match link so others can tune in and watch." />
          </View>

          <Text style={s.sectionHeader}>Common Questions</Text>
          <View style={s.faqCard}>
            <FAQ question="How do I find a live match to watch?" answer="Open the Spectate tab — all currently live matches are shown automatically. You can also use the Search button to find matches by player name, team, or tournament." />
            <FAQ question="Can I watch in fullscreen?" answer='Yes — tap the video stream or the "Watch Fullscreen" button below it. To exit fullscreen, tap the close button or swipe down.' />
            <FAQ question="What is Radio commentary?" answer="Radio is live audio commentary for a match. Tap the Radio button on any match that has it enabled. You can listen while doing other things — the audio plays in the background." />
            <FAQ question="How do I filter matches by team?" answer="Open the sidebar menu (hamburger icon) and choose All, Personal, or tap a specific team name. Only matches from that team will be shown." />
            <FAQ question="Why can't I see a video stream?" answer="Not all matches have a video stream — the match organizer has to set one up. If there's no stream, you can still follow the live Scorecard and Radio." />
            <FAQ question="Can anyone start a stream?" answer="Yes — any user can start a live stream for a match. Just tap 'New Stream' and follow the steps. You'll need a working camera and internet connection." />
            <FAQ question="Does watching use a lot of data?" answer="Video streams use data similar to watching a video call. On cellular, expect roughly 1–3 MB per minute depending on quality. Audio-only Radio uses much less." />
          </View>

          <Text style={s.sectionHeader}>Tips</Text>
          <View style={s.tipsCard}>
            <Tip text="Use Radio mode when you're low on battery or data — it's much lighter than video." />
            <Tip text="Filter by your team to quickly see only the matches that matter to you." />
            <Tip text="When streaming, use a stable Wi-Fi connection for the best video quality." />
            <Tip text="The viewer count shows how many people are watching — share the link to grow your audience." />
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
  heroIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(129,140,248,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
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
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(129,140,248,0.18)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNum: { color: '#818cf8', fontSize: 14, fontWeight: '800' },
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

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

export default function HelpCalendarScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Calendar Help
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(34,197,94,0.16)', 'rgba(96,165,250,0.10)', 'rgba(2,6,23,0.97)']}
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
              <Feather name="calendar" size={36} color="#22c55e" />
            </View>
            <Text style={s.heroTitle}>Your Calendar</Text>
            <Text style={s.heroSub}>Organize practices, matches, tournaments, and more — all in one place.</Text>
          </View>

          <Text style={s.sectionHeader}>Features</Text>
          <FeatureCard icon="columns" color="#60a5fa" title="Day, Week & Month Views" description="Switch between views to see as little or as much as you need. Day view shows a detailed timeline, Week gives a quick overview, and Month shows the big picture." />
          <FeatureCard icon="filter" color="#a78bfa" title="Filter by Team" description="Show events for All teams, just your Personal calendar, or one specific team. Keeps things focused when you belong to multiple teams." />
          <FeatureCard icon="tag" color="#f472b6" title="Event Type Filters" description="Toggle Practice, Match, Tournament, and Other events on or off so you only see what matters right now." />
          <FeatureCard icon="plus-circle" color="#22c55e" title="Create Events" description="Tap the green New Event button to add a practice, match, tournament, or other event. Assign it to a team or keep it personal." />
          <FeatureCard icon="search" color="#38bdf8" title="Search Events" description="Use the search bar to quickly find events by name, date, or team. Perfect when your calendar is packed." />

          <Text style={s.sectionHeader}>Quick Start</Text>
          <View style={s.stepsCard}>
            <Step num={1} text="Open the menu (hamburger icon) and choose a view: Day, Week, or Month." />
            <Step num={2} text="Filter by team or event type using the controls in the menu." />
            <Step num={3} text='Tap the green "New Event" button to add a new event.' />
            <Step num={4} text="Fill in the details — name, date, time, type, and team — then save." />
            <Step num={5} text="Tap any event on the calendar to view details or make changes." />
          </View>

          <Text style={s.sectionHeader}>Common Questions</Text>
          <View style={s.faqCard}>
            <FAQ question="How do I switch between Day, Week, and Month?" answer="Open the sidebar menu (hamburger icon in the top left) and tap the view you want. Your choice is remembered when you come back." />
            <FAQ question="Can I see events from only one team?" answer="Yes — open the menu and tap the team name under the team filter section. Choose 'All' to see everything, 'Personal' for just your own events, or pick a specific team." />
            <FAQ question="How do I create a team event?" answer='Tap the green "New Event" button, fill in the details, and choose a team from the team picker. If you leave it blank, the event stays on your personal calendar.' />
            <FAQ question="Why don't I see certain events?" answer="Check your event type filters in the menu. If you've toggled off 'Match' or 'Practice', those events will be hidden. Turn them back on to see everything." />
            <FAQ question="Can I edit or delete an event?" answer="Tap the event to open it, then scroll down to see Edit or Delete options. Only the event creator or a team admin can make changes." />
          </View>

          <Text style={s.sectionHeader}>Tips</Text>
          <View style={s.tipsCard}>
            <Tip text="Long-press a day in Month view to quickly jump to that day's detail view." />
            <Tip text="Events you create without a team are personal and only visible to you." />
            <Tip text="Team admins can create events that appear on every member's calendar automatically." />
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
  heroIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
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
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(34,197,94,0.18)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNum: { color: '#22c55e', fontSize: 14, fontWeight: '800' },
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

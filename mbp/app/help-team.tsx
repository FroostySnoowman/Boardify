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

export default function HelpTeamScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Team Help
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(96,165,250,0.16)', 'rgba(6,182,212,0.10)', 'rgba(2,6,23,0.97)']}
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
              <Feather name="users" size={36} color="#3b82f6" />
            </View>
            <Text style={s.heroTitle}>Your Team</Text>
            <Text style={s.heroSub}>Create or join a team, chat with teammates, manage your roster, and stay on the same page.</Text>
          </View>

          <Text style={s.sectionHeader}>Features</Text>
          <FeatureCard icon="message-circle" color="#60a5fa" title="Team Chat" description="Message your teammates in real time. Send text, images, voice messages, GIFs, and polls. Pin important messages and mention people with @." />
          <FeatureCard icon="list" color="#a78bfa" title="Roster Management" description="Add players to your team, assign roles, and keep track of who's on the squad. Admins can manage permissions." />
          <FeatureCard icon="calendar" color="#22c55e" title="Team Calendar" description="See all events assigned to your team — practices, matches, tournaments, and more — in a shared calendar view." />
          <FeatureCard icon="bar-chart-2" color="#f472b6" title="Team Statistics" description="View aggregated stats and trends for the entire team. Great for coaches tracking progress over time." />
          <FeatureCard icon="plus-circle" color="#06b6d4" title="Create & Join Teams" description="Start a new team with one tap, or join an existing team using an invite link or access code." />
          <FeatureCard icon="message-circle" color="#fb923c" title="Chat Channels" description="Organize conversations into channels — general chat, strategy talk, game-day updates, or whatever your team needs." />

          <Text style={s.sectionHeader}>Quick Start</Text>
          <View style={s.stepsCard}>
            <Step num={1} text='Tap "Create Team" in the menu (or the blue + button) to make a new team.' />
            <Step num={2} text="Name your team and customize it. Share the invite link or access code with teammates." />
            <Step num={3} text="Open Chat to start messaging. Use # channels to keep conversations organized." />
            <Step num={4} text="Go to Roster to add players and assign roles (Admin, Coach, Player)." />
            <Step num={5} text="Check Calendar and Statistics for the team's schedule and performance." />
          </View>

          <Text style={s.sectionHeader}>Common Questions</Text>
          <View style={s.faqCard}>
            <FAQ question="How do I create a team?" answer={"Open the sidebar menu and tap \"Create Team\" (or the blue + button next to the search bar). Give your team a name, and you're set. You'll get an invite link and access code to share."} />
            <FAQ question="How do I invite people to my team?" answer="After creating a team, share the invite link or access code with your teammates. They can tap the link or enter the code in the app to join." />
            <FAQ question="How do I switch between teams?" answer="Open the sidebar menu and tap a different team name in the list. The app will switch to that team's chat, calendar, and stats instantly." />
            <FAQ question="What can Admins do that Players can't?" answer="Admins can manage the roster (add/remove members, change roles), create and edit channels, pin messages, send announcements, and manage team settings. Players can chat and view everything." />
            <FAQ question="How do I send images, voice messages, or GIFs?" answer="In the chat input, tap the + button to see options for photos, camera, GIFs, and polls. For voice messages, tap and hold the mic icon." />
            <FAQ question="Can I leave or delete a team?" answer="You can leave a team from the team settings. Only the team owner can delete a team — this is permanent and removes all data." />
          </View>

          <Text style={s.sectionHeader}>Tips</Text>
          <View style={s.tipsCard}>
            <Tip text="Use @mentions in chat to get someone's attention — they'll get a notification." />
            <Tip text="Pin important messages (game times, addresses) so they're easy to find later." />
            <Tip text="Star your most-used chat channels so they always appear at the top of the list." />
            <Tip text="Admins can send Announcements that stand out visually in chat so nobody misses them." />
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
  heroIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
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
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.18)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNum: { color: '#3b82f6', fontSize: 14, fontWeight: '800' },
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

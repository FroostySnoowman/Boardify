import React, { useState } from 'react';
import { Stack, router } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../src/utils/haptics';

const CONTACT_EMAIL = 'support@mybreakpoint.app';
const BACKGROUND_COLOR = '#020617';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I create a team?',
    answer:
      'Tap the Team tab at the bottom, then tap the "+" button in the top right. You can name your team, add a description, and start inviting members right away.',
  },
  {
    question: 'How do I invite people to my team?',
    answer:
      'Go to your team page, tap "Invite Members", and share the generated invite link or access code with your teammates. They can join using either method.',
  },
  {
    question: 'How do I log a match?',
    answer:
      'Tap the "+" floating button on the Matches tab. Enter player names, configure your match settings (scoring type, number of sets, tiebreak rules), then tap "Start Match" to begin tracking.',
  },
  {
    question: 'Can I use the app without an account?',
    answer:
      'Yes! You can log matches as a guest. Guest matches are stored locally on your device. Create an account to sync matches across devices, join teams, and access all features.',
  },
  {
    question: 'How does match spectating work?',
    answer:
      'When a team member starts a public match, it appears in the team\'s live matches section. Spectators can follow the score in real-time through the scorecard or listen via the radio commentary feature.',
  },
  {
    question: 'What stat tracking modes are available?',
    answer:
      'Three modes: Basic (simple score keeping + custom stats), Intermediate (detailed shot-by-shot stats like aces, double faults, winners, and errors), and Advanced (comprehensive stats with court visualization and forehand/backhand tracking).',
  },
  {
    question: 'How do I manage my subscription?',
    answer:
      'Go to Settings and tap "Manage" under the Subscription section. You can also manage your subscription through the App Store or Google Play Store where you originally subscribed.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Go to Settings and tap "Delete Account" at the bottom of the Account section. This action is permanent and cannot be undone. All your data will be removed.',
  },
];

function FaqAccordion({ item }: { item: FaqItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => {
        hapticLight();
        setExpanded(!expanded);
      }}
      activeOpacity={0.7}
      style={s.faqItem}
    >
      <View style={s.faqHeader}>
        <Text style={s.faqQuestion}>{item.question}</Text>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#64748b"
        />
      </View>
      {expanded && <Text style={s.faqAnswer}>{item.answer}</Text>}
    </TouchableOpacity>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <Stack.Screen>
        <Stack.Header
          style={
            Platform.OS === 'android' || Platform.OS === 'web'
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined
          }
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Support
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="xmark"
              onPress={() => router.back()}
              tintColor="#ffffff"
            />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={[
          'rgba(96, 165, 250, 0.18)',
          'rgba(34, 197, 94, 0.14)',
          'rgba(2, 6, 23, 0.95)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View style={s.wrapper}>
          <View style={s.heroCard}>
            <View style={s.heroIconRow}>
              <View style={s.heroIconBg}>
                <Feather name="headphones" size={28} color="#60a5fa" />
              </View>
            </View>
            <Text style={s.heroTitle}>How can we help?</Text>
            <Text style={s.heroSubtitle}>
              We're here to help you get the most out of Break Point. Reach out
              anytime — we'd love to hear from you.
            </Text>

            <TouchableOpacity
              onPress={() => {
                hapticLight();
                Linking.openURL(`mailto:${CONTACT_EMAIL}`);
              }}
              activeOpacity={0.8}
              style={{ overflow: 'hidden', borderRadius: 12, marginTop: 20 }}
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.emailButton}
              >
                <Feather name="mail" size={18} color="#ffffff" />
                <Text style={s.emailButtonText}>Email Support</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.emailHint}>{CONTACT_EMAIL}</Text>
          </View>

          <View style={s.quickActionsRow}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Bug%20Report`);
              }}
              activeOpacity={0.7}
              style={s.quickAction}
            >
              <View style={[s.quickActionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Feather name="alert-triangle" size={20} color="#f87171" />
              </View>
              <Text style={s.quickActionLabel}>Report{'\n'}a Bug</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticLight();
                Linking.openURL(
                  `mailto:${CONTACT_EMAIL}?subject=Feature%20Suggestion`
                );
              }}
              activeOpacity={0.7}
              style={s.quickAction}
            >
              <View style={[s.quickActionIcon, { backgroundColor: 'rgba(250, 204, 21, 0.15)' }]}>
                <Feather name="zap" size={20} color="#facc15" />
              </View>
              <Text style={s.quickActionLabel}>Suggest{'\n'}a Feature</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticLight();
                Linking.openURL(
                  `mailto:${CONTACT_EMAIL}?subject=Account%20Help`
                );
              }}
              activeOpacity={0.7}
              style={s.quickAction}
            >
              <View style={[s.quickActionIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Feather name="user" size={20} color="#a855f7" />
              </View>
              <Text style={s.quickActionLabel}>Account{'\n'}Help</Text>
            </TouchableOpacity>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Feather name="help-circle" size={20} color="#60a5fa" />
              <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
            </View>
            <View style={s.faqList}>
              {FAQ_ITEMS.map((item, i) => (
                <FaqAccordion key={i} item={item} />
              ))}
            </View>
          </View>

          <View style={s.responseCard}>
            <Feather name="clock" size={16} color="#64748b" />
            <Text style={s.responseText}>
              We typically respond within 24 hours on business days.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  wrapper: {
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
    gap: 20,
  },

  // Hero card
  heroCard: {
    padding: 28,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  heroIconRow: {
    marginBottom: 16,
  },
  heroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 52,
  },
  emailButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailHint: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 10,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Section
  section: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },

  // FAQ
  faqList: {
    gap: 2,
  },
  faqItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  faqAnswer: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  // Response time
  responseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  responseText: {
    color: '#64748b',
    fontSize: 13,
    flex: 1,
  },
});

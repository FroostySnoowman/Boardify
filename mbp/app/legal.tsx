import React, { useState, useRef, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../src/utils/haptics';

const COMPANY = 'Break Point Technologies, LLC';
const CONTACT_EMAIL = 'support@mybreakpoint.app';
const EFFECTIVE_DATE = 'July 31, 2025';
const LAST_UPDATED = 'February 26, 2026';
const BACKGROUND_COLOR = '#020617';

/* ─── Data types ─── */
type ListBlock = { type: 'ul' | 'ol'; items: string[] };
type ContentItem = string | ListBlock;
type Section = { title: string; contents: ContentItem[] };

/* ─── Collapsible Section ─── */
function CollapsibleSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.collapsible}>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          setOpen(!open);
        }}
        activeOpacity={0.7}
        style={s.collapsibleHeader}
      >
        <Text style={s.collapsibleTitle}>{section.title}</Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#64748b"
        />
      </TouchableOpacity>
      {open && (
        <View style={s.collapsibleBody}>
          {section.contents.map((c, i) =>
            typeof c === 'string' ? (
              <Text key={i} style={s.paragraph}>
                {c}
              </Text>
            ) : c.type === 'ul' ? (
              <View key={i} style={s.list}>
                {c.items.map((li, j) => (
                  <View key={j} style={s.listItem}>
                    <Text style={s.bullet}>{'•'}</Text>
                    <Text style={s.listText}>{li}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View key={i} style={s.list}>
                {c.items.map((li, j) => (
                  <View key={j} style={s.listItem}>
                    <Text style={s.bullet}>{j + 1}.</Text>
                    <Text style={s.listText}>{li}</Text>
                  </View>
                ))}
              </View>
            )
          )}
        </View>
      )}
    </View>
  );
}

/* ─── Main Screen ─── */
export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'tos' | 'privacy'>('overview');

  useEffect(() => {
    if (params.tab === 'tos') setActiveTab('tos');
    else if (params.tab === 'privacy') setActiveTab('privacy');
  }, [params.tab]);

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
            Legal
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
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View style={s.wrapper}>
          <View style={s.tabBar}>
            {([
              { key: 'overview' as const, label: 'Overview' },
              { key: 'tos' as const, label: 'Terms' },
              { key: 'privacy' as const, label: 'Privacy' },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  hapticLight();
                  setActiveTab(tab.key);
                }}
                activeOpacity={0.7}
                style={[
                  s.tab,
                  activeTab === tab.key && s.tabActive,
                ]}
              >
                <Text
                  style={[
                    s.tabLabel,
                    activeTab === tab.key && s.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'overview' && (
            <View style={s.content}>
              <View style={s.heroCard}>
                <View style={s.heroIconBg}>
                  <Feather name="shield" size={28} color="#34d399" />
                </View>
                <Text style={s.heroTitle}>Legal Information</Text>
                <Text style={s.heroSubtitle}>
                  This page provides general legal information for {COMPANY}. For
                  full details, please review our Terms of Service and Privacy
                  Policy.
                </Text>
                <Text style={s.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setActiveTab('tos');
                }}
                activeOpacity={0.7}
                style={s.docCard}
              >
                <View style={[s.docIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Feather name="file-text" size={22} color="#60a5fa" />
                </View>
                <View style={s.docInfo}>
                  <Text style={s.docTitle}>Terms of Service</Text>
                  <Text style={s.docDesc}>Your rights, obligations, and rules for using the Service</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#475569" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setActiveTab('privacy');
                }}
                activeOpacity={0.7}
                style={s.docCard}
              >
                <View style={[s.docIconBg, { backgroundColor: 'rgba(52, 211, 153, 0.12)' }]}>
                  <Feather name="lock" size={22} color="#34d399" />
                </View>
                <View style={s.docInfo}>
                  <Text style={s.docTitle}>Privacy Policy</Text>
                  <Text style={s.docDesc}>How we collect, use, and protect your information</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#475569" />
              </TouchableOpacity>

              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Feather name="eye" size={18} color="#60a5fa" />
                  <Text style={s.sectionTitle}>At a Glance</Text>
                </View>
                <View style={s.glanceList}>
                  {[
                    'Accounts are for users 13+ (higher local ages apply where required).',
                    'Subscriptions auto-renew until canceled; all sales are final unless required by law.',
                    `You can request deletion of personal data; we aim to process verified requests within 90 days at ${CONTACT_EMAIL}.`,
                    'Streaming, stats, and coaching insights are informational only and may not be error-free.',
                  ].map((item, i) => (
                    <View key={i} style={s.glanceItem}>
                      <View style={s.glanceDot} />
                      <Text style={s.glanceText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={s.contactCard}>
                <Feather name="mail" size={18} color="#60a5fa" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactTitle}>Legal Inquiries</Text>
                  <Text style={s.contactDesc}>
                    For legal inquiries or data requests, email{' '}
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.contactLink}>{CONTACT_EMAIL}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'tos' && (
            <View style={s.content}>
              <View style={s.docHeaderCard}>
                <Text style={s.docHeaderTitle}>Terms of Service</Text>
                <Text style={s.docHeaderDate}>Effective: {EFFECTIVE_DATE}</Text>
              </View>
              {tosSections.map((section, i) => (
                <CollapsibleSection key={i} section={section} />
              ))}
              <View style={s.contactCard}>
                <Feather name="mail" size={18} color="#60a5fa" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactTitle}>Contact</Text>
                  <Text style={s.contactDesc}>
                    Questions about these Terms can be sent to{' '}
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.contactLink}>{CONTACT_EMAIL}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'privacy' && (
            <View style={s.content}>
              <View style={s.docHeaderCard}>
                <Text style={s.docHeaderTitle}>Privacy Policy</Text>
                <Text style={s.docHeaderDate}>Effective: {EFFECTIVE_DATE}</Text>
              </View>
              {privacySections.map((section, i) => (
                <CollapsibleSection key={i} section={section} />
              ))}
              <View style={s.contactCard}>
                <Feather name="mail" size={18} color="#60a5fa" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactTitle}>Contact</Text>
                  <Text style={s.contactDesc}>You can contact us at </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.contactLink}>{CONTACT_EMAIL}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  wrapper: {
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
    gap: 16,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#60a5fa',
  },

  // Content
  content: {
    gap: 12,
  },

  // Hero
  heroCard: {
    padding: 28,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  heroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  lastUpdated: {
    color: '#475569',
    fontSize: 12,
    marginTop: 12,
  },

  // Document cards
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  docIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  docDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },

  // Section
  section: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Glance list
  glanceList: {
    gap: 10,
  },
  glanceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  glanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60a5fa',
    marginTop: 7,
  },
  glanceText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // Contact
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  contactTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactDesc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  contactLink: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '500',
  },

  // Document header
  docHeaderCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  docHeaderTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  docHeaderDate: {
    color: '#64748b',
    fontSize: 13,
  },

  // Collapsible
  collapsible: {
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  collapsibleTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  collapsibleBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },

  // Text content
  paragraph: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
  },
  list: {
    gap: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  bullet: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 21,
    minWidth: 16,
  },
  listText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
});

/* ─── Terms of Service Sections ─── */
const tosSections: Section[] = [
  {
    title: 'Overview',
    contents: [
      `These Terms of Service ("Terms") govern your access to and use of the websites, mobile apps, software, products, and services provided by ${COMPANY} (collectively, the "Service"). By creating an account, downloading our apps, or otherwise using the Service, you agree to be bound by these Terms.`,
      `If you do not agree to these Terms, do not use the Service. We may update these Terms from time to time. Material changes will be effective as stated in the updated Terms. Your continued use of the Service after the effective date constitutes acceptance of the changes.`,
    ],
  },
  {
    title: 'Who We Are',
    contents: [
      `${COMPANY} provides a platform for tennis, pickleball, and paddle communities, including match and practice statistics, calendars, team management, streaming and broadcasts, training tools, highlights, and related features. We operate under our company name and brand and may use third-party partners to provide parts of the Service.`,
    ],
  },
  {
    title: 'Eligibility & Accounts',
    contents: [
      'The Service is open to users of all ages. If you are under 13, you may use the Service only after a parent or legal guardian has given verifiable consent through the process we provide: we send the parent or guardian an email with a one-time link; when they click the link and confirm, they agree to these Terms and our Privacy Policy on your behalf, and we record that consent. Until then, you will not be able to use the app. This process helps us comply with laws that protect children (e.g. in the US and EU).',
      'If you are 13 or older (or the minimum age of digital consent in your country if higher), you agree to these Terms by creating an account or using the Service. If you are under the age of majority where you live, we recommend that a parent or guardian has approved your use.',
      'To use in-app chat (team and group messages), we require you to provide your date of birth. We use this to meet safety and regulatory requirements. Parents and guardians can disable chat for an account at any time via Parental controls in Settings (protected by a PIN).',
      'You are responsible for your account credentials and for all activity that occurs under your account. Keep your password secure and notify us immediately of any unauthorized use.',
      'If you use the Service on behalf of a school, club, league, or organization, you declare that you are authorized to bind that organization to these Terms.',
    ],
  },
  {
    title: 'School and Organization Use',
    contents: [
      `When a school, school district, club, league, or other organization ("Institution") uses the Service, additional terms apply. The Institution's authorized representative must accept these Terms on behalf of the Institution and its end users.`,
      {
        type: 'ul',
        items: [
          `FERPA Compliance: Where the Service is used by a school or school district in the United States, we acknowledge that student information may constitute "education records" under the Family Educational Rights and Privacy Act (FERPA), 20 U.S.C. 1232g. We agree to act as a "school official" with a "legitimate educational interest" solely to perform the services described in these Terms and the Privacy Policy. We will not use education records for any purpose other than providing and improving the Service as directed by the Institution.`,
          'Prohibition on Secondary Use: We will not use student data or education records for advertising, marketing, or building user profiles for non-educational purposes. We will not sell student data to any third party.',
          'Data Return and Deletion: Upon written request from an Institution following termination of the relationship, we will export or delete student data within 60 days. After deletion, we will retain no copies except as required by law or to the extent data has been de-identified.',
          `Breach Notification: We will notify the Institution without unreasonable delay (and in any event within 30 days) of any confirmed unauthorized access to student data. Notification will be sent to the contact on file and to ${CONTACT_EMAIL}.`,
          `Data Privacy Agreement: Institutions may request a formal Data Privacy Agreement (DPA) by contacting ${CONTACT_EMAIL}. Where a separate DPA has been executed, its terms control in the event of conflict with these Terms.`,
          'Parental Rights: We support the rights of parents and guardians to inspect and review student data. Institutions should direct parent requests through their normal records processes; we will cooperate and provide data exports to the Institution upon request.',
        ],
      },
    ],
  },
  {
    title: 'Permitted Use & License',
    contents: [
      'Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal team/organization purposes.',
      {
        type: 'ul',
        items: [
          'You may not copy, modify, host, sublicense, sell, or distribute the Service or any portion thereof, except as expressly allowed.',
          'You may not reverse engineer, decompile, or attempt to extract source code or underlying ideas unless permitted by applicable law.',
          'You may not access the Service to build a competing product or service.',
        ],
      },
    ],
  },
  {
    title: 'User Content & Licenses',
    contents: [
      'The Service may allow you and your team to upload, record, stream, post, or otherwise submit content, including statistics, rosters, scores, chat, photos, audio/video streams, highlights, training data, comments, and other materials ("User Content"). You retain ownership of your User Content.',
      'To operate, improve, and provide the Service, you grant us a worldwide, non-exclusive, royalty-free, transferable, and sublicensable license to host, store, reproduce, adapt, edit, translate, analyze, create derivative works (such as highlights and clips), publicly display, publicly perform, and distribute your User Content in connection with the Service and our business.',
      'You declare and warrant that you have all rights and permissions necessary to upload, stream, and share User Content.',
    ],
  },
  {
    title: 'Broadcasts, Streams, Highlights & Publicity',
    contents: [
      'If you enable streaming, recording, or broadcasting, you grant us the rights necessary to capture, process, transmit, display, and store the content; generate automated clips and highlights; and make them available to authorized viewers.',
      `We may use your public team name, logo, and public-facing content to reference you as a user of the Service and to promote the Service. You may request limitation of promotional use by contacting us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'Stats, Insights & Coaching Disclaimers',
    contents: [
      'Statistics, insights, ratings, and coaching tips are generated from user inputs and automated processing. They are for informational purposes only and may be incomplete or inaccurate.',
      'Training or performance suggestions are not medical advice and are not a substitute for guidance from qualified professionals.',
    ],
  },
  {
    title: 'Acceptable Use',
    contents: [
      {
        type: 'ul',
        items: [
          'You may not submit illegal, infringing, harassing, hateful, defamatory, pornographic, or otherwise objectionable content.',
          'You may not attempt to gain unauthorized access to the Service or other accounts.',
          'You may not collect or harvest personal information from the Service except as permitted.',
          'You must follow all applicable laws, league rules, school policies, and venue rules when recording or streaming.',
        ],
      },
      'We reserve the right to remove content, restrict features, suspend, or terminate accounts at any time for any or no reason.',
    ],
  },
  {
    title: 'Subscriptions, Billing & Auto-Renewal',
    contents: [
      'Some features require a paid subscription. Subscriptions auto-renew at the then-current price unless you cancel at least 24 hours before the end of the billing period.',
      'You can manage or cancel a subscription in the platform where you purchased it (e.g., App Store, Google Play). Cancellation takes effect at the end of the current billing period.',
      'Prices, taxes, and fees may change. If required, we will provide notice of price changes.',
    ],
  },
  {
    title: 'Refunds & Chargebacks',
    contents: [
      'All sales are final except where required by law. If you believe we have billed you in error, contact us promptly.',
      'Initiating a chargeback may result in immediate suspension or termination of access. We reserve all rights to dispute chargebacks.',
    ],
  },
  {
    title: 'Third-Party Services & Hardware',
    contents: [
      'The Service may integrate with third-party services, devices, or networks. Your use of third-party services is subject to their terms and privacy policies. We are not responsible for any actions performed by third-party services.',
    ],
  },
  {
    title: 'Intellectual Property',
    contents: [
      'The Service and all materials we provide (including software, designs, text, graphics, logos, videos we create, and documentation) are owned by us or our licensors and are protected by intellectual property laws. Except for the limited license granted to you, no rights are granted by implication.',
    ],
  },
  {
    title: 'Privacy; Data Retention & Deletion',
    contents: [
      'We collect, use, and share information as described in our Privacy Policy. We collect only what we need to run the app: account and profile data, birthdate for chat access and compliance, team and chat content, match and calendar data, and device/push tokens for notifications.',
      `You may request access, correction, or deletion of your personal data by emailing ${CONTACT_EMAIL}. We aim to process verified deletion requests within 90 days.`,
    ],
  },
  {
    title: 'Disclaimers',
    contents: [
      'The Service is provided on an "AS IS" and "AS AVAILABLE" basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, quiet enjoyment, and non-infringement.',
    ],
  },
  {
    title: 'Limitation of Liability',
    contents: [
      'To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenues, goodwill, data, or business interruption.',
      'Our total liability for all claims in any 12-month period is limited to the greater of the amount you paid us for the Service in that period.',
    ],
  },
  {
    title: 'Dispute Resolution & Arbitration',
    contents: [
      'You and we agree to resolve any disputes through individual binding arbitration administered by the American Arbitration Association (AAA), rather than in court.',
      'Class arbitrations, class actions, and consolidation with other arbitrations are not permitted. You and we each waive any right to a jury trial.',
    ],
  },
  {
    title: 'Governing Law',
    contents: [
      'These Terms are governed by the laws of the United States and the laws of the state of Utah, without regard to conflict-of-laws principles.',
    ],
  },
  {
    title: 'Miscellaneous',
    contents: [
      {
        type: 'ul',
        items: [
          'Entire Agreement. These Terms constitute the entire agreement between you and us regarding the Service.',
          'Assignment. You may not assign or transfer these Terms without our consent.',
          'Severability. If any provision is found unenforceable, it will be modified to the minimum extent necessary.',
          'Waiver. Our failure to enforce a provision is not a waiver of our right to do so later.',
          'Force Majeure. We are not liable for delays or failures caused by events beyond our reasonable control.',
          'Survival. Provisions that by their nature should survive termination will survive.',
        ],
      },
    ],
  },
];

/* ─── Privacy Policy Sections ─── */
const privacySections: Section[] = [
  {
    title: 'Overview',
    contents: [
      `This Privacy Policy explains how ${COMPANY} ("we", "us", or "our") collects, uses, discloses, and safeguards information when you use the MyBreakPoint app and related services for tennis, pickleball, and padel (the "Service").`,
      'We collect only what we need to run the app and keep it safe. We ask for your date of birth before you can use chat so we can meet age and safety rules in different countries and help protect young users. Parents can turn off chat entirely for an account using Parental controls in Settings (with a PIN). We do not sell your personal information. We use AI only for statistics (e.g. match stats and insights), not for personal data or profiling.',
      'By using the Service, you agree to the data practices described here. If you do not agree, do not use the Service.',
    ],
  },
  {
    title: 'Scope',
    contents: [
      'This Policy applies to information we process about users, viewers, admins, coaches, players, spectators, and visitors of the Service. It does not apply to third-party services that we do not control.',
    ],
  },
  {
    title: 'Information We Collect',
    contents: [
      'We are transparent about what we collect and why. We do not sell your personal information.',
      {
        type: 'ul',
        items: [
          'Account and profile: We collect your email (required to create an account), username (optional; you choose it during onboarding or in Settings), and optionally your date of birth. We need your birth date to allow access to in-app chat, for safety and to meet age-related rules in different countries. You can add or update it in Settings. We store a hashed version of your password; we never see or store the actual password.',
          'Profile photo: If you add a profile picture, we store it so your team and chat participants can see it. You can remove it anytime in Settings.',
          'Team and roster: When you join or are added to a team, we store your membership, role (e.g. Coach, Player, Spectator), and any roster or lineup data your coaches or admins enter. This is used to show rosters, lineups, and who can manage the team.',
          'Chat: When you use team or group chat, we store your messages (text, voice, images, polls, etc.), who sent them, and when. We use this to display conversations, sync across devices, and enforce our rules. We do not use chat content for advertising.',
          'Match and stats: When you log a match or enter stats, we store scores, game details, and any notes you add. We use this to show match history, statistics, and insights to you and your team (according to the team’s visibility settings).',
          'Calendar: We store events you or your team create (practices, matches, tournaments), including title, date, time, location, and RSVPs. We use this to show the calendar, send reminders, and support features like Live Activities.',
          'Device and push: We store device tokens so we can send you push notifications (e.g. event reminders, new messages) if you allow them. We do not track your precise location; we may use coarse location (e.g. from IP) only where needed for the service.',
          'Streaming: If you use live streaming (e.g. broadcasting a match), we process video and audio from your camera and microphone to deliver the stream. This is only when you start a stream and with your permission.',
          'Support and feedback: If you contact us or submit a bug report or suggestion, we receive what you send (e.g. email, message) so we can respond and improve the app.',
        ],
      },
    ],
  },
  {
    title: 'Sources of Information',
    contents: [
      {
        type: 'ul',
        items: [
          'From you: when you sign up (email, password), set your username or birth date, add a profile photo, send chat messages, log matches, create events, or use streaming.',
          'From your team: when a coach or admin adds you to a team, assigns a role, or adds you to a roster or lineup.',
          'From your device: when you enable push notifications we receive a device token; we may collect app version and device type for stability and support.',
        ],
      },
    ],
  },
  {
    title: 'How We Use Information',
    contents: [
      'We use the information above only for these purposes:',
      {
        type: 'ul',
        items: [
          'To run the app: sign you in, show your profile and teams, sync your chats and calendar, and deliver notifications you’ve agreed to.',
          'To enforce safety and rules: we require your birth date to use chat and support parental controls (e.g. disabling chat with a PIN) so the app can be used in line with regulations in different countries.',
          'To provide team and match features: rosters, lineups, match history, stats, and calendar events are used so you and your team can use those features as intended.',
          'To improve the product: we may use usage and crash data (e.g. app version, device type) to fix bugs and improve performance. We do not use your chat or message content for advertising.',
          'To comply with law: we may use or disclose data when required by law or to protect safety and rights.',
        ],
      },
    ],
  },
  {
    title: 'AI and Automated Processing',
    contents: [
      'We use AI and automated processing only for statistics and match-related features: for example, to compute match stats, win/loss trends, and performance insights from the scores and game data you or your team enter. We do not use your name, email, birth date, chat messages, or any other personal information as input to AI or for profiling. Statistics and insights are for you and your team only, according to your team’s visibility settings.',
      'Outputs may be imperfect and are for informational purposes only. We do not use automated decision-making that produces legal or similarly significant effects about you without human involvement.',
    ],
  },
  {
    title: 'Legal Bases for Processing (EEA/UK)',
    contents: [
      {
        type: 'ul',
        items: [
          'Contract: to provide and support the Service you request.',
          'Legitimate Interests: to secure, improve, and personalize the Service.',
          'Consent: for certain optional features, cookies/SDKs, marketing, or precise location.',
          'Legal Obligation: to comply with applicable laws, requests, and recordkeeping.',
        ],
      },
    ],
  },
  {
    title: 'How We Share Information',
    contents: [
      {
        type: 'ul',
        items: [
          'Service Providers: cloud hosting, storage, streaming, analytics, security, support, and communication tools.',
          'Payment Platforms: app stores and payment processors that handle transactions and billing.',
          'Team Members and Viewers: content you post may be visible to authorized team members, followers, or public viewers.',
          'Integration Partners: third-party services you choose to connect.',
          'Affiliates and Successors: related entities and in connection with a merger, acquisition, or asset transfer.',
          'Legal and Safety: to comply with law, respond to lawful requests, or protect rights, safety, and integrity.',
          'Aggregated/De-Identified Data: for analytics, research, and product improvement.',
        ],
      },
      'We do not sell personal information for money.',
    ],
  },
  {
    title: 'Sub-Processors',
    contents: [
      'We use the following categories of third-party service providers ("sub-processors") to operate the Service. Each sub-processor receives only the data necessary to perform its function.',
      {
        type: 'ul',
        items: [
          'Cloudflare, Inc. (San Francisco, CA): Cloud hosting, database, content delivery, image and video storage, live streaming infrastructure, and edge computing. Processes account data, team data, chat messages, match data, calendar data, images, and video streams.',
          'Apple Inc. (Cupertino, CA): Push notification delivery (Apple Push Notification service) for iOS devices and Live Activities. Processes device tokens only.',
          'Expo / 650 Industries, Inc. (Palo Alto, CA): Push notification delivery for cross-platform notifications and app build infrastructure. Processes device tokens only.',
          'Google LLC (Mountain View, CA): Authentication (Google Sign-In, when the user chooses this method) and STUN/TURN servers for WebRTC connectivity. Processes OAuth tokens and IP addresses for NAT traversal.',
          'Apple Inc. (Sign in with Apple): Authentication when the user chooses this method. Processes OAuth tokens only.',
          'SMTP Email Provider: Transactional email delivery for account verification, password reset, and parental consent emails. Processes email addresses and message content.',
        ],
      },
      `We maintain an up-to-date list of sub-processors and will notify schools and districts of material changes. Contact ${CONTACT_EMAIL} for the current list or to be added to the notification list.`,
    ],
  },
  {
    title: 'Your Privacy Choices and Controls',
    contents: [
      {
        type: 'ul',
        items: [
          'Profile: In Settings you can update your username, birth date, profile photo, and sport preferences. You can remove your profile photo at any time.',
          'Chat: You can leave a team or group chat. A parent or guardian can disable chat for your account in Settings under Parental controls (with a PIN).',
          'Notifications: You can turn off push notifications in your device settings. We use them only for things like event reminders and new messages.',
          `Data requests: Email ${CONTACT_EMAIL} to request access, correction, or deletion of your personal data. We will respond as required by law.`,
        ],
      },
    ],
  },
  {
    title: 'Data Retention',
    contents: [
      'We retain information for as long as necessary to provide the Service, comply with legal obligations, resolve disputes, and enforce agreements.',
      'If you request deletion of your personal data, we aim to process verified requests within 90 days.',
    ],
  },
  {
    title: "Children's Privacy and Safety",
    contents: [
      'We allow users under 13 to use the Service only after we have received verifiable parental or guardian consent. When a child under 13 signs up, we ask for a parent or guardian email address and send that person a one-time link. When they click the link and confirm, they agree to our Terms of Service and Privacy Policy on the child’s behalf, and we record the date of consent. The child cannot use the app until that step is complete. This process is designed to satisfy laws such as COPPA (US) and similar requirements in other regions.',
      'We require a date of birth to use chat so we can apply age-related safeguards. Parents and guardians can disable chat for an account at any time in Settings under Parental controls (using a PIN they set). We do not use personal information to target or profile users for advertising, and we design our chat and age checks to help prevent misuse.',
      `If you believe a child has provided personal data without required consent, or if you have a safety concern, contact ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'FERPA and Student Data',
    contents: [
      'When the Service is used by a school, school district, or other educational institution in the United States, student information may be considered "education records" under the Family Educational Rights and Privacy Act (FERPA), 20 U.S.C. 1232g. This section describes how we handle such data.',
      {
        type: 'ul',
        items: [
          'School Official Designation: We operate as a "school official" with a "legitimate educational interest" under FERPA when providing the Service to a school or district. This means we access student data only to perform the services the school has authorized.',
          'Limited Purpose: We use student education records solely to provide and improve the Service as described in this Policy. We do not use education records for advertising, marketing, creating user profiles for non-educational purposes, or any other purpose unrelated to the services the school has authorized.',
          'No Sale of Student Data: We do not sell student data or education records to any third party, for any reason.',
          'Re-Disclosure Restrictions: We do not disclose education records to third parties except as directed by the school, as needed for our sub-processors to operate the Service (see Sub-Processors below), or as required by law.',
          `Access and Correction: Parents, legal guardians, and eligible students have the right to inspect and review student data. Requests should be directed to the student's school, which may contact us at ${CONTACT_EMAIL} to obtain data exports.`,
          'Data Return and Disposal: Upon termination of the relationship with a school or district, we will delete or return student education records within 60 days of a written request, except where retention is required by law or the data has been de-identified.',
          `Breach Notification: In the event of an unauthorized disclosure of student education records, we will notify the affected school or district without unreasonable delay and in any event within 30 days. Contact: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    title: 'Student Data Privacy (Utah)',
    contents: [
      `When the Service is used by a Utah school or school district, we comply with the Utah Student Data Protection Act (Title 53E, Chapter 9, Utah Code) and related rules. In addition to the commitments above:`,
      {
        type: 'ul',
        items: [
          'Collection Limitation: We collect only the student data necessary to provide the Service as described in this Policy. We do not collect student data beyond what is needed for the authorized educational purpose.',
          'No Secondary Use: We do not use student data for any secondary purpose, including targeted advertising, data mining for non-educational purposes, or building commercial profiles.',
          'Transparency: This Policy, along with any Data Privacy Agreement (DPA) executed with the school or district, describes all categories of student data we collect, the purposes for processing, and the third parties with whom data may be shared. Schools and districts may request our data governance documentation.',
          'Data Security: We maintain administrative, technical, and physical safeguards reasonably designed to protect student data from unauthorized access, use, or disclosure. These include encryption in transit, access controls, and regular review of security practices.',
          `Deletion upon Request: Schools and districts may request deletion of student data at any time by contacting ${CONTACT_EMAIL}. We will complete verified deletion requests within 60 days.`,
          'Annual Notification: Schools and districts that use the Service are encouraged to include MyBreakPoint in their annual notification to parents regarding third-party services that access student data, in accordance with Utah law.',
          `Industry Standards: We support the Student Data Privacy Consortium (SDPC) framework and are willing to execute a Utah National Data Privacy Agreement (NDPA) with requesting districts. Contact ${CONTACT_EMAIL} to initiate.`,
        ],
      },
    ],
  },
  {
    title: 'App Permissions (Why We Ask)',
    contents: [
      'The app may request certain device permissions. Here is what we use them for, so you can make an informed choice:',
      {
        type: 'ul',
        items: [
          'Network / internet: Required so the app can load your teams, chats, calendar, and match data and show you when you’re offline.',
          'Notifications: So we can send you event reminders and new message alerts if you choose to allow them. We do not use notifications for marketing.',
          'Camera and microphone: Used only when you start a live stream (e.g. broadcasting a match) or record a voice message in chat. We do not access your camera or mic otherwise.',
          'Storage / audio files: Needed for recording and playing voice messages in chat. We do not read or upload your personal files for other purposes.',
          'Background / “start on startup”: So event reminders you’ve set can still fire after your device restarts. We do not run other background activity beyond what’s needed for reminders and sync.',
        ],
      },
      'You can revoke permissions in your device settings. Some features (e.g. streaming, voice messages) will stop working if the related permission is turned off.',
    ],
  },
  {
    title: 'Security',
    contents: [
      'We employ administrative, technical, and physical safeguards designed to protect information. No method of transmission or storage is completely secure.',
      `Report security issues to ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'International Data Transfers',
    contents: [
      'We may process and store information in the United States and other countries. When transferring personal data from the EEA/UK, we use appropriate safeguards such as standard contractual clauses.',
    ],
  },
  {
    title: 'Region-Specific Disclosures (U.S.)',
    contents: [
      'Residents of certain U.S. states (e.g., California, Colorado, Virginia) have additional rights.',
      {
        type: 'ul',
        items: [
          'Right to Know/Access: request details about personal information collected.',
          'Right to Delete: request deletion of personal information, subject to exceptions.',
          'Right to Correct: request correction of inaccurate personal information.',
          'Right to Opt-Out of Sale/Sharing/Targeted Advertising.',
          'Right to Appeal: if we deny your request, you may appeal.',
        ],
      },
      `Submit requests by emailing ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'Region-Specific Disclosures (EEA/UK)',
    contents: [
      {
        type: 'ul',
        items: [
          'Controller: we are the controller of personal data processed through the Service.',
          'Rights: you may request access, rectification, erasure, restriction, portability, and object to processing.',
          'Complaints: you may lodge a complaint with your local supervisory authority.',
        ],
      },
      `Contact us at ${CONTACT_EMAIL} to exercise these rights.`,
    ],
  },
  {
    title: 'Changes to This Policy',
    contents: [
      'We may update this Policy from time to time. Material changes will be notified within the Service. Your continued use after the effective date means you accept the updated Policy.',
    ],
  },
];

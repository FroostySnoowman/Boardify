import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { TabScreenChrome } from '../components/TabScreenChrome';

const SHIFT = 5;

export type AccountConfig = {
  notificationsEnabled: boolean;
  defaultBoardId: string | null;
  theme: 'system' | 'light' | 'dark';
};

const DEFAULT_CONFIG: AccountConfig = {
  notificationsEnabled: true,
  defaultBoardId: null,
  theme: 'system',
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [config, setConfig] = useState<AccountConfig>(DEFAULT_CONFIG);
  const isWeb = Platform.OS === 'web';

  const updateConfig = <K extends keyof AccountConfig>(key: K, value: AccountConfig[K]) => {
    hapticLight();
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
  const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;

  const scroll = (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: isWeb ? 24 : 16,
          maxWidth: isWeb ? 600 : undefined,
          alignSelf: isWeb ? 'center' : undefined,
        },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={Platform.OS === 'ios'}
    >
        <View style={styles.hero}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>
            {user?.email ?? 'Not signed in'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.cardWrap}>
            <View style={styles.cardShadow} />
            <View style={styles.card}>
              <ConfigRow
                label="Notifications"
                sublabel="Push for board updates"
                right={
                  <Switch
                    value={config.notificationsEnabled}
                    onValueChange={(v) => updateConfig('notificationsEnabled', v)}
                    trackColor={{ false: '#e0e0e0', true: '#a5d6a5' }}
                    thumbColor="#fff"
                  />
                }
              />
              <ConfigRowDivider />
              <ConfigRow
                label="Default board"
                sublabel={config.defaultBoardId ?? 'None'}
                onPress={() => {}}
                showChevron
              />
              <ConfigRowDivider />
              <ConfigRow
                label="Theme"
                sublabel={config.theme === 'system' ? 'System' : config.theme === 'light' ? 'Light' : 'Dark'}
                onPress={() => {
                  const next = { system: 'light' as const, light: 'dark' as const, dark: 'system' as const };
                  updateConfig('theme', next[config.theme]);
                }}
                showChevron
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.cardWrap}>
            <View style={styles.cardShadow} />
            <View style={styles.card}>
              <ConfigRow label="Profile" sublabel="Name, photo" onPress={() => {}} showChevron />
              <ConfigRowDivider />
              <ConfigRow label="Sign out" sublabel="" onPress={() => {}} />
            </View>
          </View>
        </View>
    </ScrollView>
  );

  if (isWeb) {
    return <View style={styles.container}>{scroll}</View>;
  }

  return <TabScreenChrome>{scroll}</TabScreenChrome>;
}

function ConfigRow({
  label,
  sublabel,
  right,
  onPress,
  showChevron,
}: {
  label: string;
  sublabel: string;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  const content = (
    <>
      <View style={styles.configLabelBlock}>
        <Text style={styles.configLabel}>{label}</Text>
        {sublabel ? <Text style={styles.configSublabel}>{sublabel}</Text> : null}
      </View>
      {right ?? (showChevron ? <Feather name="chevron-right" size={18} color="#666" /> : null)}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.configRow}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.configRow}>{content}</View>;
}

function ConfigRowDivider() {
  return <View style={styles.configDivider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  hero: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 6,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  cardWrap: {
    position: 'relative',
    marginRight: SHIFT,
    marginBottom: SHIFT,
  },
  cardShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: '#e0e0e0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
  },
  card: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  configLabelBlock: {
    flex: 1,
  },
  configLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  configSublabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  configDivider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginLeft: 0,
  },
});

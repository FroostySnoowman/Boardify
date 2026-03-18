import React from 'react';
import { View, Text, ScrollView, Platform, Linking, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../../src/config/layout';

const APP_VERSION = '1.0.0';

function InfoCard({ icon, color, title, children }: { icon: string; color: string; title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 20,
        marginBottom: 16,
      }}
    >
      <View className="flex-row items-center" style={{ marginBottom: 16 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: color + '18',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Feather name={icon as any} size={18} color={color} />
        </View>
        <Text className="font-bold text-white text-lg">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row justify-between items-center"
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text style={{ color: '#94a3b8', fontSize: 14 }}>{label}</Text>
      <Text className="text-white font-semibold" style={{ fontSize: 14 }}>{value}</Text>
    </View>
  );
}

function LinkRow({ icon, label, url, isLast }: { icon: string; label: string; url: string; isLast?: boolean }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.6}
      className="flex-row items-center"
      style={{
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Feather name={icon as any} size={16} color="#94a3b8" />
      </View>
      <Text style={{ color: '#f1f5f9', fontSize: 15 }} className="flex-1">{label}</Text>
      <Feather name="external-link" size={14} color="#475569" />
    </TouchableOpacity>
  );
}

function TechBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 14,
        paddingVertical: 7,
      }}
    >
      <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return (
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop:
            (isWeb ? 24 : Math.max(insets.top / 2, 12)) +
            (Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0),
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: isWeb ? 24 : 16,
          flexGrow: 1,
          maxWidth: isWeb ? 1200 : undefined,
          alignSelf: isWeb ? 'center' : undefined,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
      >
        <View style={{ marginBottom: 28 }}>
          <Text className="text-3xl font-bold text-white" style={{ marginBottom: 4 }}>About</Text>
          <Text className="text-gray-400 text-base">
            Learn more about this app.
          </Text>
        </View>

        <InfoCard icon="info" color="#60a5fa" title="App Info">
          <InfoRow label="Version" value={APP_VERSION} />
          <InfoRow label="Platform" value={Platform.OS} />
          <View className="flex-row justify-between items-center" style={{ paddingVertical: 12 }}>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>Built with</Text>
            <Text className="text-white font-semibold" style={{ fontSize: 14 }}>Expo + React Native</Text>
          </View>
        </InfoCard>

        <InfoCard icon="layers" color="#a78bfa" title="Tech Stack">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['Expo 56', 'React Native', 'TypeScript', 'NativeWind', 'Reanimated', 'Expo Router'].map((tech) => (
              <TechBadge key={tech} label={tech} />
            ))}
          </View>
        </InfoCard>
      </ScrollView>
    </View>
  );
}

import React from 'react';
import { View, Text, ScrollView, Pressable, Platform, Alert, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';

const BACKGROUND_COLOR = '#020617';

function SettingsRow({
  icon,
  label,
  onPress,
  destructive,
  isLast,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Feather
        name={icon as any}
        size={18}
        color={destructive ? '#ef4444' : '#94a3b8'}
        style={{ marginRight: 14 }}
      />
      <Text
        style={{
          fontSize: 15,
          flex: 1,
          color: destructive ? '#ef4444' : '#ffffff',
        }}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color="#475569" />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
          Settings
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
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 64,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(96, 165, 250, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="sliders" size={18} color="#60a5fa" />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>General</Text>
            </View>

            <SettingsRow icon="user" label="Edit Profile" onPress={() => {}} />
            <SettingsRow icon="bell" label="Notifications" onPress={() => {}} />
            <SettingsRow icon="shield" label="Privacy" onPress={() => {}} isLast />
          </View>

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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="info" size={18} color="#a78bfa" />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>About</Text>
            </View>

            <SettingsRow icon="help-circle" label="Help & Support" onPress={() => {}} />
            <SettingsRow icon="file-text" label="Terms & Privacy Policy" onPress={() => {}} isLast />
          </View>

          {user && (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                padding: 20,
              }}
            >
              <SettingsRow
                icon="log-out"
                label="Log Out"
                onPress={handleLogout}
                destructive
                isLast
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
});

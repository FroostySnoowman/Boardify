import React from 'react';
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';

const BACKGROUND_COLOR = '#020617';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
          Profile
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
        colors={['rgba(96, 165, 250, 0.15)', 'rgba(139, 92, 246, 0.10)', 'rgba(2, 6, 23, 0.95)']}
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
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 32 }}>
            <LinearGradient
              colors={['#3b82f6', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '800' }}>
                {user?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </LinearGradient>
            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '800' }}>
              {user?.username || 'Guest'}
            </Text>
            {user?.email && (
              <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                {user.email}
              </Text>
            )}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
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
                <Feather name="user" size={18} color="#60a5fa" />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Account Info</Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Username</Text>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                {user?.username || '—'}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Email</Text>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                {user?.email || '—'}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="settings" size={18} color="#4ade80" />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Quick Actions</Text>
            </View>

            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.05)',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Feather name="settings" size={18} color="#94a3b8" style={{ marginRight: 14 }} />
              <Text style={{ color: '#ffffff', fontSize: 15, flex: 1 }}>Settings</Text>
              <Feather name="chevron-right" size={16} color="#475569" />
            </Pressable>

            <Pressable
              onPress={() => {}}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Feather name="edit-2" size={18} color="#94a3b8" style={{ marginRight: 14 }} />
              <Text style={{ color: '#ffffff', fontSize: 15, flex: 1 }}>Edit Profile</Text>
              <Feather name="chevron-right" size={16} color="#475569" />
            </Pressable>
          </View>
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

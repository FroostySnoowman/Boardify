import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { hapticLight } from '../utils/haptics';
import { Skeleton } from '../components/Skeleton';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const onRefresh = async () => {
    setRefreshing(true);
    hapticLight();
    // TODO: Fetch your data here
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View className="relative flex-1" style={{ backgroundColor: '#020617' }}>
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          paddingTop:
            (isWeb ? 24 : Math.max(insets.top / 2, 12)) +
            (Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0),
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: isWeb ? 24 : 16,
          flexGrow: 1,
          maxWidth: isWeb ? 1200 : undefined,
          alignSelf: isWeb ? 'center' : undefined,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['#60a5fa']}
            progressViewOffset={Platform.OS === 'android' ? 60 : undefined}
          />
        }
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-white mb-1">
            Welcome{user ? '' : ' back'}
          </Text>
          <Text className="text-gray-400 text-base">
            Here's what's happening today.
          </Text>
        </View>

        <View className="mb-8" style={{ gap: 16 }}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              // TODO: Navigate to your action
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(34, 197, 94, 0.2)', 'rgba(16, 185, 129, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 72,
                padding: 20,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}
            >
              <View style={{ marginRight: 16 }}>
                <Feather name="plus-circle" size={28} color="#4ade80" />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="font-semibold text-white text-lg">Quick Action</Text>
                <Text className="text-sm text-gray-400">Tap to do something</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#4ade80" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              hapticLight();
              // TODO: Navigate to your action
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.2)', 'rgba(6, 182, 212, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 72,
                padding: 20,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}
            >
              <View style={{ marginRight: 16 }}>
                <Feather name="search" size={28} color="#60a5fa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="font-semibold text-white text-lg">Another Action</Text>
                <Text className="text-sm text-gray-400">Browse or explore</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#60a5fa" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View className="mb-8">
          <View className="p-4 rounded-xl bg-white/5 border border-white/10 shadow-lg">
            <View className="flex-row items-center mb-4">
              <Feather name="activity" size={20} color="#ede5a6" />
              <Text className="font-semibold text-white text-lg ml-2">Overview</Text>
            </View>
            {isLoading ? (
              <View className="flex-row gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="flex-1 h-20 rounded-lg" />
                ))}
              </View>
            ) : (
              <View className="flex-row gap-4">
                <View className="flex-1 p-4 rounded-lg bg-white/5 border border-white/10 items-center">
                  <Text className="text-gray-400 text-xs mb-2">Stat 1</Text>
                  <Text className="text-white font-bold text-xl">0</Text>
                </View>
                <View className="flex-1 p-4 rounded-lg bg-white/5 border border-white/10 items-center">
                  <Text className="text-gray-400 text-xs mb-2">Stat 2</Text>
                  <Text className="text-white font-bold text-xl">0</Text>
                </View>
                <View className="flex-1 p-4 rounded-lg bg-white/5 border border-white/10 items-center">
                  <Text className="text-gray-400 text-xs mb-2">Stat 3</Text>
                  <Text className="text-white font-bold text-xl">0</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="mb-16">
          <View className="p-6 rounded-xl bg-white/5 border border-white/10 shadow-lg">
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-row items-center">
                <Feather name="clock" size={20} color="#4ade80" />
                <Text className="font-semibold text-white text-lg ml-2">Recent Items</Text>
              </View>
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => {
                  hapticLight();
                  // TODO: Navigate to full list
                }}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-medium mr-1" style={{ color: '#4ade80' }}>View All</Text>
                <Feather name="arrow-right" size={16} color="#4ade80" />
              </TouchableOpacity>
            </View>
            <View className="gap-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))
              ) : (
                <View className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]">
                  <Feather name="inbox" size={40} color="#9ca3af" />
                  <Text className="font-semibold text-white text-lg mb-2 mt-3">No items yet</Text>
                  <Text className="text-sm text-gray-500 text-center">
                    Your recent items will appear here.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {!user && (
          <View className="flex-col items-center justify-center py-12 px-6 bg-white/5 rounded-xl border border-white/10 mb-16 shadow-lg">
            <Text className="text-3xl font-bold text-white mb-4 text-center">
              Get Started
            </Text>
            <Text className="text-gray-400 mb-8 max-w-md text-lg text-center">
              Sign in to unlock the full experience.
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push('/login');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#22c55e', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingHorizontal: 32, paddingVertical: 16, borderRadius: 9999 }}
              >
                <Text className="text-white font-semibold text-lg">Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

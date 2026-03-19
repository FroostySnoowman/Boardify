import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { ActivitiesHeader } from '../components/ActivitiesHeader';

const SHIFT = 5;

const PRESS_DURATION = 60;
const RELEASE_DURATION = 100;

function BoardCardPressable({
  shadowStyle,
  topStyle,
  onPress,
  children,
}: {
  shadowStyle: object;
  topStyle: object;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { translateY: offset.value },
    ],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        offset.value = withTiming(SHIFT, { duration: PRESS_DURATION });
      }}
      onPressOut={() => {
        offset.value = withTiming(0, { duration: RELEASE_DURATION });
      }}
      style={homeStyles.boardCardWrap}
    >
      <View style={[homeStyles.boardCardShadow, shadowStyle]} />
      <Animated.View style={[topStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const MOCK_BOARDS = [
  { id: '1', name: 'Work', color: '#a5d6a5' },
  { id: '2', name: 'Personal', color: '#F3D9B1' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loading } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isWeb = Platform.OS === 'web';

  const onRefresh = async () => {
    setRefreshing(true);
    hapticLight();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const onBoardPress = (id: string) => {
    hapticLight();
    router.push('/board');
  };

  const onCreateBoard = () => {
    hapticLight();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f0e8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0a0a0a" />
      </View>
    );
  }

  return (
    <View className="relative flex-1" style={{ backgroundColor: '#f5f0e8' }}>
      {isWeb && <ActivitiesHeader />}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          paddingTop:
            (isWeb ? 24 : Math.max(12, insets.top / 2)) +
            (Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0),
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: isWeb ? 24 : 16,
          flexGrow: 1,
          maxWidth: isWeb ? 800 : undefined,
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
            tintColor="#0a0a0a"
            colors={['#0a0a0a']}
            progressViewOffset={Platform.OS === 'android' ? 60 : undefined}
          />
        }
      >
        <View style={homeStyles.hero}>
          <Text style={homeStyles.title}>Home</Text>
          <Text style={homeStyles.subtitle}>Your boards and recent work</Text>
        </View>

        <View style={homeStyles.section}>
          <Text style={homeStyles.sectionTitle}>My Boards</Text>
          <View style={homeStyles.boardGrid}>
            {MOCK_BOARDS.map((board) => (
              <BoardCardPressable
                key={board.id}
                shadowStyle={{ backgroundColor: board.color }}
                topStyle={homeStyles.boardCard}
                onPress={() => onBoardPress(board.id)}
              >
                <Text style={homeStyles.boardCardName} numberOfLines={1}>{board.name}</Text>
                <Feather name="chevron-right" size={18} color="#666" />
              </BoardCardPressable>
            ))}
            <BoardCardPressable
              shadowStyle={{}}
              topStyle={homeStyles.createBoardCard}
              onPress={onCreateBoard}
            >
              <Feather name="plus" size={24} color="#666" />
              <Text style={homeStyles.createBoardText}>Create board</Text>
            </BoardCardPressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const homeStyles = StyleSheet.create({
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
  boardGrid: {
    gap: 12,
  },
  boardCardWrap: {
    position: 'relative',
    marginRight: SHIFT,
    marginBottom: SHIFT,
  },
  boardCardShadow: {
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
  boardCard: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 14,
  },
  boardCardName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  createBoardCard: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#e8e8e8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  createBoardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});

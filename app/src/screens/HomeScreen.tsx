import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { ActivitiesHeader, MOBILE_NAV_HEIGHT } from '../components/ActivitiesHeader';
import { TabScreenChrome } from '../components/TabScreenChrome';
import { HomeScreenSkeleton } from '../components/skeletons';
import { NeuListRowPressable, getNeuListRowCardBase } from '../components/NeuListRowPressable';
import { useTheme } from '../theme';
import { sortBoards, useBoardSort } from '../contexts/BoardSortContext';
import type { BoardListItem } from '../data/boards';
import { listBoards } from '../api/boards';
import { apiBoardToListItem } from '../api/boardMappers';
/** Neu list row, same building blocks as Messages inbox rows (not glass). */
function SignInHeroCta({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        label: {
          flex: 1,
          minWidth: 0,
          fontSize: 15,
          fontWeight: '500',
          color: colors.textPrimary,
          paddingRight: 8,
        },
      }),
    [colors]
  );

  return (
    <NeuListRowPressable
      shadowStyle={{ backgroundColor: colors.shadowFill }}
      topStyle={getNeuListRowCardBase(colors)}
      onPress={() => {
        hapticLight();
        onPress();
      }}
    >
      <View style={styles.avatar}>
        <Feather name="message-circle" size={20} color={colors.iconPrimary} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        Sign in
      </Text>
      <Feather name="chevron-right" size={18} color={colors.iconChevron} />
    </NeuListRowPressable>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const homeStyles = useMemo(
    () =>
      StyleSheet.create({
        hero: {
          marginBottom: 28,
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.textPrimary,
        },
        subtitle: {
          fontSize: 15,
          color: colors.subtitle,
          marginTop: 6,
          fontWeight: '500',
        },
        section: {
          marginBottom: 24,
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.sectionLabel,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 12,
        },
        boardGrid: {
          gap: 12,
        },
        boardCardName: {
          flex: 1,
          fontSize: 17,
          fontWeight: '700',
          color: colors.textPrimary,
        },
        createBoardCard: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: colors.columnSurface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 20,
          paddingHorizontal: 24,
        },
        createBoardText: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.textSecondary,
        },
      }),
    [colors]
  );

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading, invalidateLocalAuth } = useAuth();
  const { sortMode } = useBoardSort();
  const scrollViewRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const isWeb = Platform.OS === 'web';

  const loadBoards = useCallback(async () => {
    try {
      setBoardsError(null);
      const { boards: rows } = await listBoards();
      setBoards((rows ?? []).map(apiBoardToListItem));
    } catch (e: unknown) {
      const status = typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined;
      if (status === 401) {
        await invalidateLocalAuth();
        setBoards([]);
        setBoardsError(null);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Could not load boards';
      setBoardsError(msg);
      setBoards([]);
    }
  }, [invalidateLocalAuth]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void loadBoards();
    }, [loadBoards, user])
  );

  const sortedBoards = useMemo(() => sortBoards(boards, sortMode), [boards, sortMode]);

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    hapticLight();
    await loadBoards();
    setRefreshing(false);
  };

  const onBoardPress = (id: string, name: string) => {
    hapticLight();
    router.push({
      pathname: '/board',
      params: { boardId: id, boardName: name },
    });
  };

  const onCreateBoard = () => {
    hapticLight();
    router.push('/create-board');
  };

  if (loading) {
    const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
    const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;
    const skeleton = (
      <HomeScreenSkeleton
        contentPaddingTop={contentPaddingTop}
        contentPaddingBottom={insets.bottom + 24}
        horizontalPadding={isWeb ? 24 : 16}
        isWeb={isWeb}
      />
    );
    if (isWeb) {
      return (
        <View className="flex-1" style={{ backgroundColor: colors.canvas }}>
          <ActivitiesHeader user={null} />
          {skeleton}
        </View>
      );
    }
    return <TabScreenChrome>{skeleton}</TabScreenChrome>;
  }

  if (!user) {
    const ipadPadGuest = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
    const contentPaddingTopGuest = (isWeb ? 24 : 12) + ipadPadGuest;
    if (isWeb) {
      return (
        <View className="flex-1" style={{ backgroundColor: colors.canvas }}>
          <ActivitiesHeader user={null} />
          <ScrollView
            contentContainerStyle={{
              paddingTop: contentPaddingTopGuest,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 24,
              flexGrow: 1,
              maxWidth: 480,
              alignSelf: 'center',
              width: '100%',
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={homeStyles.hero}>
              <Text style={homeStyles.title}>Welcome</Text>
              <Text style={homeStyles.subtitle}>Sign in to load your boards and stay in sync.</Text>
            </View>
            <SignInHeroCta onPress={() => router.push('/login')} />
          </ScrollView>
        </View>
      );
    }
    return (
      <TabScreenChrome>
        <ScrollView
          contentContainerStyle={{
            paddingTop: contentPaddingTopGuest,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={homeStyles.hero}>
            <Text style={homeStyles.title}>Welcome</Text>
            <Text style={homeStyles.subtitle}>Sign in to load your boards and stay in sync.</Text>
          </View>
          <SignInHeroCta onPress={() => router.push('/login')} />
        </ScrollView>
      </TabScreenChrome>
    );
  }

  const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
  const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;
  const androidRefreshOffset = MOBILE_NAV_HEIGHT + insets.top;

  const scroll = (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1"
      contentContainerStyle={{
        paddingTop: contentPaddingTop,
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
          tintColor={colors.iconPrimary}
          colors={[colors.iconPrimary]}
          progressViewOffset={Platform.OS === 'android' ? androidRefreshOffset : undefined}
        />
      }
    >
      <View style={homeStyles.hero}>
        <Text style={homeStyles.title}>Home</Text>
        <Text style={homeStyles.subtitle}>Your boards and recent work</Text>
      </View>

      <View style={homeStyles.section}>
        <Text style={homeStyles.sectionTitle}>My Boards</Text>
        {boardsError ? (
          <Text style={{ color: colors.dangerText, marginBottom: 12, fontSize: 14 }}>{boardsError}</Text>
        ) : null}
        <View style={homeStyles.boardGrid}>
          {sortedBoards.map((board) => (
            <NeuListRowPressable
              key={board.id}
              shadowStyle={{ backgroundColor: board.color }}
              topStyle={getNeuListRowCardBase(colors)}
              onPress={() => onBoardPress(board.id, board.name)}
            >
              <Text style={homeStyles.boardCardName} numberOfLines={1}>{board.name}</Text>
              <Feather name="chevron-right" size={18} color={colors.iconChevron} />
            </NeuListRowPressable>
          ))}
          <NeuListRowPressable
            shadowStyle={{ backgroundColor: colors.shadowFill }}
            topStyle={[getNeuListRowCardBase(colors), homeStyles.createBoardCard]}
            onPress={onCreateBoard}
          >
            <Feather name="plus" size={24} color={colors.iconChevron} />
            <Text style={homeStyles.createBoardText}>Create board</Text>
          </NeuListRowPressable>
        </View>
      </View>
    </ScrollView>
  );

  if (isWeb) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.canvas }}>
        <ActivitiesHeader user={user} />
        {scroll}
      </View>
    );
  }

  return <TabScreenChrome>{scroll}</TabScreenChrome>;
}

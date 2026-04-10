import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import type { BoardListItem } from '../src/data/boards';
import { listBoards } from '../src/api/boards';
import { apiBoardToListItem } from '../src/api/boardMappers';
import { getStoredDefaultBoardId, setStoredDefaultBoardId } from '../src/storage/accountPrefs';
import { sortBoards, useBoardSort } from '../src/contexts/BoardSortContext';
import { useAuth } from '../src/contexts/AuthContext';
import { NeuListRowPressable } from '../src/components/NeuListRowPressable';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 10;
const SHIFT = 5;
const PRESS_IN = 60;

function createBoardRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    face: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
      paddingHorizontal: 16,
      paddingLeft: 14,
    },
    name: {
      flex: 1,
      minWidth: 0,
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
}

function createDefaultBoardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    flex: {
      flex: 1,
    },
    sheetFill: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      maxWidth: 800,
      width: '100%',
      alignSelf: 'center',
    },
    helper: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500',
      lineHeight: 22,
      marginBottom: 20,
    },
    list: {
      gap: 12,
    },
    trailSpacer: {
      width: 20,
      height: 20,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 28,
      gap: 12,
      width: '100%',
      overflow: 'hidden',
      paddingBottom: SHIFT + 6,
    },
    boardBtnWrap: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      marginRight: SHIFT,
      marginBottom: SHIFT,
      zIndex: 0,
    },
    boardBtnShadow: {
      position: 'absolute',
      left: SHIFT,
      top: SHIFT,
      right: -SHIFT,
      bottom: -SHIFT,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 0,
    },
    boardBtnFace: {
      position: 'relative',
      zIndex: 1,
      elevation: 4,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    boardBtnFaceDisabled: {
      backgroundColor: colors.surfaceMuted,
    },
    boardBtnLabel: {
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
      width: '100%',
      color: colors.textPrimary,
    },
    labelCancel: {
      color: colors.textPrimary,
    },
    labelCreate: {
      color: colors.textPrimary,
    },
    labelCreateDisabled: {
      color: colors.textTertiary,
    },
  });
}

type DefaultBoardSheet = ReturnType<typeof createDefaultBoardStyles>;

function BoardStyleButton({
  sheet,
  shadowColor,
  onPress,
  disabled,
  label,
  labelStyle,
}: {
  sheet: DefaultBoardSheet;
  shadowColor: string;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  labelStyle: object;
}) {
  const offset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { translateY: offset.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) {
          offset.value = withTiming(SHIFT, { duration: PRESS_IN });
        }
      }}
      onPressOut={() => {
        cancelAnimation(offset);
        offset.value = 0;
      }}
      style={sheet.boardBtnWrap}
    >
      <View style={[sheet.boardBtnShadow, { backgroundColor: shadowColor }]} pointerEvents="none" />
      <Animated.View
        style={[sheet.boardBtnFace, disabled && sheet.boardBtnFaceDisabled, animatedStyle]}
      >
        <Text style={[sheet.boardBtnLabel, labelStyle]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function DefaultBoardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createDefaultBoardStyles(colors), [colors]);
  const boardRow = useMemo(() => createBoardRowStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { sortMode } = useBoardSort();
  const { user, invalidateLocalAuth } = useAuth();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = await getStoredDefaultBoardId();
    setSavedId(id);
    setSelectedId(id);
    if (!user) {
      setBoards([]);
      return;
    }
    try {
      const { boards: rows } = await listBoards();
      setBoards((rows ?? []).map(apiBoardToListItem));
    } catch (e: unknown) {
      const status =
        typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined;
      if (status === 401) {
        await invalidateLocalAuth();
      }
      setBoards([]);
    }
  }, [user, invalidateLocalAuth]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const sortedBoards = sortBoards(boards, sortMode);

  const dirty = selectedId !== savedId;
  const canSave = dirty;

  const close = () => {
    hapticLight();
    router.back();
  };

  const save = async () => {
    if (!canSave) return;
    hapticLight();
    await setStoredDefaultBoardId(selectedId);
    setSavedId(selectedId);
    router.back();
  };

  const select = (id: string | null) => {
    hapticLight();
    setSelectedId(id);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={
            Platform.OS === 'ios'
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: colors.modalCreamCanvas }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          Default board
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>

      <View style={[styles.flex, styles.sheetFill]}>
        <ScrollView
          style={styles.sheetFill}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + BELOW_HEADER_GAP,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.helper}>
            This board is used when the app needs a single board (e.g. shortcuts).
          </Text>

          <View style={styles.list}>
            <NeuListRowPressable
              shadowStyle={{ backgroundColor: colors.shadowFill }}
              topStyle={boardRow.face}
              onPress={() => select(null)}
            >
              <Text style={boardRow.name} numberOfLines={1}>
                None
              </Text>
              {selectedId === null ? (
                <Feather name="check" size={20} color={colors.iconPrimary} />
              ) : (
                <View style={styles.trailSpacer} />
              )}
            </NeuListRowPressable>

            {sortedBoards.map((b) => (
              <NeuListRowPressable
                key={b.id}
                shadowStyle={{ backgroundColor: b.color }}
                topStyle={boardRow.face}
                onPress={() => select(b.id)}
              >
                <Text style={boardRow.name} numberOfLines={1}>
                  {b.name}
                </Text>
                {selectedId === b.id ? (
                  <Feather name="check" size={20} color={colors.iconPrimary} />
                ) : (
                  <View style={styles.trailSpacer} />
                )}
              </NeuListRowPressable>
            ))}
          </View>

          <View style={styles.actions}>
            <BoardStyleButton
              sheet={styles}
              shadowColor={colors.shadowFill}
              onPress={close}
              label="Cancel"
              labelStyle={styles.labelCancel}
            />
            <BoardStyleButton
              sheet={styles}
              shadowColor={canSave ? colors.success : colors.shadowFill}
              onPress={save}
              disabled={!canSave}
              label="Save"
              labelStyle={canSave ? styles.labelCreate : styles.labelCreateDisabled}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

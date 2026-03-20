import React, { useCallback, useState } from 'react';
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
import { MOCK_BOARDS } from '../src/data/boards';
import { getStoredDefaultBoardId, setStoredDefaultBoardId } from '../src/storage/accountPrefs';
import { sortBoards, useBoardSort } from '../src/contexts/BoardSortContext';
import { NeuListRowPressable } from '../src/components/NeuListRowPressable';

const BELOW_HEADER_GAP = 10;
const BG = '#f5f0e8';
const SHIFT = 5;
const PRESS_IN = 60;

const boardRow = StyleSheet.create({
  face: {
    position: 'relative',
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
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});

function BoardStyleButton({
  shadowColor,
  onPress,
  disabled,
  label,
  labelStyle,
}: {
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
      style={styles.boardBtnWrap}
    >
      <View
        style={[styles.boardBtnShadow, { backgroundColor: shadowColor }]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.boardBtnFace,
          disabled && styles.boardBtnFaceDisabled,
          animatedStyle,
        ]}
      >
        <Text style={[styles.boardBtnLabel, labelStyle]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function DefaultBoardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { sortMode } = useBoardSort();
  const boards = sortBoards(MOCK_BOARDS, sortMode);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = await getStoredDefaultBoardId();
    setSavedId(id);
    setSelectedId(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
              : { backgroundColor: BG }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#0a0a0a' }}>
          Default board
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor="#0a0a0a" />
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
              shadowStyle={{ backgroundColor: '#d4d4d4' }}
              topStyle={boardRow.face}
              onPress={() => select(null)}
            >
              <Text style={boardRow.name} numberOfLines={1}>
                None
              </Text>
              {selectedId === null ? (
                <Feather name="check" size={20} color="#0a0a0a" />
              ) : (
                <View style={styles.trailSpacer} />
              )}
            </NeuListRowPressable>

            {boards.map((b) => (
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
                  <Feather name="check" size={20} color="#0a0a0a" />
                ) : (
                  <View style={styles.trailSpacer} />
                )}
              </NeuListRowPressable>
            ))}
          </View>

          <View style={styles.actions}>
            <BoardStyleButton
              shadowColor="#e0e0e0"
              onPress={close}
              label="Cancel"
              labelStyle={styles.labelCancel}
            />
            <BoardStyleButton
              shadowColor={canSave ? '#a5d6a5' : '#d0d0d0'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  sheetFill: {
    flex: 1,
    backgroundColor: BG,
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
    color: '#666',
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
    borderColor: '#000',
    zIndex: 0,
  },
  boardBtnFace: {
    position: 'relative',
    zIndex: 1,
    elevation: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  boardBtnFaceDisabled: {
    backgroundColor: '#eee',
  },
  boardBtnLabel: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    color: '#0a0a0a',
  },
  labelCancel: {
    color: '#0a0a0a',
  },
  labelCreate: {
    color: '#0a0a0a',
  },
  labelCreateDisabled: {
    color: '#888',
  },
});

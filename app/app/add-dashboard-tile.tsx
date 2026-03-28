import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../src/utils/haptics';
import {
  dashboardTileSignature,
  parseDashboardTilesParam,
  setPendingDashboardAddTile,
} from '../src/utils/dashboardAddTileNavigation';
import { AddDashboardTileForm } from '../src/components/dashboard/AddDashboardTileForm';
import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineTimeframe,
} from '../src/types/dashboard';

const BELOW_HEADER_GAP = 10;

const BG = '#f5f0e8';

export default function AddDashboardTileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { tiles: tilesParam } = useLocalSearchParams<{ tiles?: string | string[] }>();
  const existingCombos = parseDashboardTilesParam(tilesParam);

  const [kind, setKind] = useState<DashboardChartKind>('bar');
  const [dimension, setDimension] = useState<DashboardDimension>('list');
  const [lineTimeframe, setLineTimeframe] = useState<DashboardLineTimeframe>('week');

  useFocusEffect(
    useCallback(() => {
      setKind('bar');
      setDimension('list');
      setLineTimeframe('week');
    }, [])
  );

  const close = () => {
    hapticLight();
    Keyboard.dismiss();
    router.back();
  };

  const submit = () => {
    const sig = dashboardTileSignature({
      kind,
      dimension,
      lineTimeframe: kind === 'line' ? lineTimeframe : undefined,
    });
    const taken = existingCombos.some((t) => dashboardTileSignature(t) === sig);
    if (taken) {
      hapticLight();
      return;
    }
    hapticLight();
    Keyboard.dismiss();
    setPendingDashboardAddTile({
      status: 'added',
      kind,
      dimension,
      ...(kind === 'line' ? { lineTimeframe } : {}),
    });
    router.back();
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
          {kind === 'bar' ? 'Add bar chart' : kind === 'pie' ? 'Add pie chart' : 'Add line chart'}
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor="#0a0a0a" />
        </Stack.Toolbar>
      </Stack.Screen>

      <KeyboardAvoidingView
        style={[styles.flex, styles.sheetFill]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={styles.sheetFill}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + BELOW_HEADER_GAP,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <AddDashboardTileForm
            existingCombos={existingCombos}
            kind={kind}
            dimension={dimension}
            lineTimeframe={lineTimeframe}
            onKindChange={setKind}
            onDimensionChange={setDimension}
            onLineTimeframeChange={setLineTimeframe}
            onCancel={close}
            onAdd={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
});

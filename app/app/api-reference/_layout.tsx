import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function ApiReferenceLayout() {
  const { colors } = useTheme();

  const sheetStack = useMemo(
    () => ({
      headerShown: true,
      headerLargeTitle: false,
      headerTransparent: false,
      headerStyle: { backgroundColor: colors.modalCreamCanvas },
      headerShadowVisible: false,
      headerTintColor: colors.modalCreamHeaderTint,
      headerBackVisible: Platform.OS === 'web' ? true : undefined,
      contentStyle: { backgroundColor: colors.modalCreamCanvas },
      gestureEnabled: true,
      headerTitle: '',
      animation: Platform.OS === 'android' ? ('slide_from_bottom' as const) : ('default' as const),
    }),
    [colors]
  );

  const categorySheet = useMemo(
    () => ({
      ...sheetStack,
      presentation: Platform.OS === 'ios' ? ('formSheet' as const) : ('modal' as const),
      headerBackVisible: Platform.OS === 'web',
    }),
    [sheetStack]
  );

  return (
    <Stack screenOptions={sheetStack}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[category]" options={categorySheet} />
    </Stack>
  );
}

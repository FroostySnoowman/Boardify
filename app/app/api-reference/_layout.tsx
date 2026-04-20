import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function ApiReferenceLayout() {
  const { colors } = useTheme();

  const sheetStack = useMemo(
    () => ({
      headerShown: true,
      // Large titles inflate `useHeaderHeight()` and leave a big empty band under the toolbar on sheets.
      headerLargeTitle: false,
      // Opaque header matches sheet canvas and avoids a translucent / white hairline at the top of
      // pageSheet + formSheet on iOS (transparent + blur can show system white above cream content).
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
      // Topic sheets use the same X toolbar as the hub; hide the system back chevron on iOS/Android formSheet.
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

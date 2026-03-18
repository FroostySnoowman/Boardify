import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoginScreen from '../src/screens/LoginScreen';

const BACKGROUND_COLOR = '#020617';

export default function LoginRoute() {
  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Sign In' }} />
      <LoginScreen />
    </>
  );
}

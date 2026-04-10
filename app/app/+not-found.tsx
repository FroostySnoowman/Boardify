import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

function createNotFoundStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    iconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surfaceMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      maxWidth: 300,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primaryButtonBg,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
    },
    buttonText: {
      color: colors.primaryButtonText,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createNotFoundStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Feather name="alert-circle" size={48} color={colors.iconMuted} />
      </View>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>This page doesn't exist or may have moved.</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/')}
        activeOpacity={0.8}
      >
        <Feather name="home" size={18} color={colors.primaryButtonText} />
        <Text style={styles.buttonText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

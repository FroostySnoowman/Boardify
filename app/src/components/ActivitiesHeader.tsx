import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { hapticLight } from '../utils/haptics';

export const ACTIVITIES_HEADER_HEIGHT = 64;
export const MOBILE_NAV_HEIGHT = 64;

export function ActivitiesHeader({ embeddedInLayout = false }: { embeddedInLayout?: boolean }) {
  const insets = useSafeAreaInsets();

  const onMenuPress = () => {
    hapticLight();
    router.push('/profile');
  };

  const onPlusPress = () => {
    hapticLight();
  };

  return (
    <View
      style={[
        styles.container,
        embeddedInLayout ? styles.containerEmbedded : { paddingTop: insets.top },
      ]}
    >
      <View style={styles.iconButtonWrap}>
        <View style={styles.iconButtonShadow} />
        <Pressable
          onPress={onMenuPress}
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Feather name="more-horizontal" size={24} color="#0a0a0a" />
        </Pressable>
      </View>
      <Text style={styles.title}>Activities</Text>
      <View style={styles.iconButtonWrap}>
        <View style={styles.iconButtonShadow} />
        <Pressable
          onPress={onPlusPress}
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Feather name="plus" size={24} color="#0a0a0a" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ACTIVITIES_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#f5f0e8',
    zIndex: 999,
    elevation: 10,
  },
  containerEmbedded: {
    position: 'relative',
    height: ACTIVITIES_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#f5f0e8',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  iconButtonWrap: {
    position: 'relative',
  },
  iconButtonShadow: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000',
  },
  iconButton: {
    position: 'relative',
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  iconButtonPressed: {
    opacity: 0.85,
  },
});

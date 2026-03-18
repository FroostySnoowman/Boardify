import React from 'react';
import { View, TouchableOpacity, Text, Platform, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
  Home: 'home',
  Calendar: 'calendar',
  Team: 'users',
  Matches: 'award',
  Spectate: 'play',
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const rawLabel = options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
          ? options.title
          : route.name;

        const label =
          typeof rawLabel === 'function'
            ? rawLabel({ focused: isFocused, color: isFocused ? '#60a5fa' : 'rgba(255, 255, 255, 0.5)', position: 'below-icon', children: '' }) ?? route.name
            : rawLabel ?? route.name;
        const labelText = typeof label === 'string' ? label : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const iconName = iconMap[route.name];

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={(options as any).tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            {iconName && (
              <Feather
                name={iconName}
                size={24}
                color={isFocused ? '#60a5fa' : 'rgba(255, 255, 255, 0.5)'}
                style={styles.icon}
              />
            )}
            <Text
              style={[
                styles.label,
                { color: isFocused ? '#60a5fa' : 'rgba(255, 255, 255, 0.5)' },
              ]}
            >
              {labelText}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 8 : 0,
    height: Platform.OS === 'android' ? 64 : 56,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  icon: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});

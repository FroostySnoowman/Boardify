import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Modal,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';

const ANDROID_HW_TEXTURE =
  Platform.OS === 'android' ? ({ renderToHardwareTextureAndroid: true } as const) : null;

let SwiftContextMenu: any;
let SwiftMenu: any;
let Button: any;
let Section: any;
let Host: any;
let menuGlassModifiers: any[] | undefined;
let menuPlainLabelModifiers: any[] | undefined;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    const { buttonStyle } = require('@expo/ui/swift-ui/modifiers');
    SwiftContextMenu = swiftUI.ContextMenu;
    SwiftMenu = swiftUI.Menu;
    Button = swiftUI.Button;
    Section = swiftUI.Section;
    Host = swiftUI.Host;
    menuGlassModifiers = [buttonStyle('glass')];
    menuPlainLabelModifiers = [buttonStyle('borderless')];
  } catch (error) {
    console.warn('SwiftUI components not available');
  }
}

interface ContextMenuOption {
  label: string;
  value: string;
  onPress: () => void;
}

interface ContextMenuProps {
  trigger: React.ReactNode;
  options: ContextMenuOption[];
  onSelect?: (value: string) => void;
  activationMethod?: 'singlePress' | 'longPress';
  onSinglePress?: () => void;
  triggerWrapperStyle?: StyleProp<ViewStyle>;
  hostMatchContents?: boolean;
  iosGlassMenuTrigger?: boolean;
}

export function ContextMenu({
  trigger,
  options,
  onSelect,
  activationMethod = 'singlePress',
  onSinglePress,
  triggerWrapperStyle,
  hostMatchContents = false,
  iosGlassMenuTrigger = true,
}: ContextMenuProps) {
  const { colors, resolvedScheme } = useTheme();
  const swiftScheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);

  const androidStyles = useMemo(
    () =>
      StyleSheet.create({
        androidMenuOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlayScrim,
        },
        androidMenuContainer: {
          minWidth: 200,
          backgroundColor: colors.surfaceElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
          overflow: 'hidden',
        },
        androidMenuItem: {
          paddingHorizontal: 20,
          paddingVertical: 12,
          minHeight: 44,
          justifyContent: 'center',
        },
        androidMenuItemText: {
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: '500',
          letterSpacing: 0.1,
        },
        androidMenuDivider: {
          height: 1,
          backgroundColor: colors.divider,
          marginHorizontal: 8,
        },
      }),
    [colors]
  );

  const iosMenuModifiers =
    iosGlassMenuTrigger && menuGlassModifiers && menuGlassModifiers.length > 0
      ? menuGlassModifiers
      : !iosGlassMenuTrigger && menuPlainLabelModifiers && menuPlainLabelModifiers.length > 0
        ? menuPlainLabelModifiers
        : [];
  const [androidMenuVisible, setAndroidMenuVisible] = useState(false);
  const androidMenuOpacity = useRef(new Animated.Value(0)).current;
  const androidMenuScale = useRef(new Animated.Value(0.9)).current;
  const triggerRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleAndroidPress = () => {
    hapticLight();
    if (triggerRef.current) {
      triggerRef.current.measure((x, y, width, height, pageX, pageY) => {
        const screenWidth = Dimensions.get('window').width;
        const menuMinWidth = 200;
        const padding = 16;
        
        let menuX = pageX;
        if (pageX + menuMinWidth > screenWidth - padding) {
          menuX = screenWidth - menuMinWidth - padding;
          if (pageX + width > menuX + menuMinWidth) {
            menuX = pageX + width - menuMinWidth;
          }
        }
        
        setMenuPosition({ x: Math.max(padding, menuX), y: pageY + height + 8 });
        setAndroidMenuVisible(true);
        Animated.parallel([
          Animated.timing(androidMenuOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(androidMenuScale, {
            toValue: 1,
            tension: 300,
            friction: 30,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      setMenuPosition({ x: 16, y: 200 });
      setAndroidMenuVisible(true);
      Animated.parallel([
        Animated.timing(androidMenuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(androidMenuScale, {
          toValue: 1,
          tension: 300,
          friction: 30,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleCloseAndroidMenu = () => {
    Animated.parallel([
      Animated.timing(androidMenuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(androidMenuScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAndroidMenuVisible(false);
    });
  };

  const handleAndroidMenuAction = (option: ContextMenuOption) => {
    hapticLight();
    handleCloseAndroidMenu();
    setTimeout(() => {
      option.onPress();
      if (onSelect) {
        onSelect(option.value);
      }
    }, 150);
  };

  if (Platform.OS === 'ios' && Host) {
    const menuItems = (
      <Section>
        {options.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            onPress={() => {
              hapticLight();
              option.onPress();
              if (onSelect) {
                onSelect(option.value);
              }
            }}
          />
        ))}
      </Section>
    );

    const triggerWrapStyle = [
      iosGlassMenuTrigger ? styles.triggerWrapper : styles.triggerWrapperCustomLabel,
      styles.triggerWrapperIos,
      triggerWrapperStyle,
    ];
    const hostSlotStyle = [styles.iosHostSlot];

    if (activationMethod === 'singlePress' && SwiftMenu) {
      return (
        <View
          style={[styles.iosSwiftMenuLift, hostMatchContents && styles.iosOrbMenuHostRow]}
          collapsable={false}
        >
          <Host
            colorScheme={swiftScheme}
            style={hostSlotStyle}
            matchContents={hostMatchContents ? true : undefined}
          >
            <SwiftMenu
              modifiers={iosMenuModifiers}
              label={
              <View
                ref={triggerRef}
                style={triggerWrapStyle}
                collapsable={false}
                {...(ANDROID_HW_TEXTURE ?? {})}
              >
                {trigger}
              </View>
            }>
              {menuItems}
            </SwiftMenu>
          </Host>
        </View>
      );
    }

    if (SwiftContextMenu) {
      return (
        <View
          style={[styles.iosSwiftMenuLift, hostMatchContents && styles.iosOrbMenuHostRow]}
          collapsable={false}
        >
          <Host
            colorScheme={swiftScheme}
            style={hostSlotStyle}
            matchContents={hostMatchContents ? true : undefined}
          >
            <SwiftContextMenu modifiers={iosMenuModifiers}>
              <SwiftContextMenu.Trigger>
                <View
                  ref={triggerRef}
                  style={triggerWrapStyle}
                  collapsable={false}
                  {...(ANDROID_HW_TEXTURE ?? {})}
                >
                  {trigger}
                </View>
              </SwiftContextMenu.Trigger>
              <SwiftContextMenu.Items>
                {menuItems}
              </SwiftContextMenu.Items>
            </SwiftContextMenu>
          </Host>
        </View>
      );
    }
  }

  const usePressableForTap = activationMethod === 'longPress' && onSinglePress != null;

  return (
    <>
      <View 
        ref={triggerRef}
        style={{ width: '100%' }}
        collapsable={false}
      >
        <Pressable 
          onPress={usePressableForTap ? onSinglePress : (activationMethod === 'longPress' ? undefined : handleAndroidPress)}
          onLongPress={activationMethod === 'longPress' ? handleAndroidPress : undefined}
          delayLongPress={400}
          style={{ width: '100%' }}
        >
          <View pointerEvents={usePressableForTap || activationMethod !== 'longPress' ? 'none' : 'auto'}>
            {trigger}
          </View>
        </Pressable>
      </View>

      <Modal
        visible={androidMenuVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseAndroidMenu}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseAndroidMenu}>
          <Animated.View
            style={[
              androidStyles.androidMenuOverlay,
              {
                opacity: androidMenuOpacity,
              },
            ]}
          />
        </Pressable>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: menuPosition.y, left: menuPosition.x }}
        >
          <Animated.View
            style={[
              androidStyles.androidMenuContainer,
              {
                opacity: androidMenuOpacity,
                transform: [{ scale: androidMenuScale }],
              },
            ]}
          >
            {options.map((option, index) => (
              <React.Fragment key={option.value}>
                {index > 0 && <View style={androidStyles.androidMenuDivider} />}
                <TouchableOpacity
                  onPress={() => handleAndroidMenuAction(option)}
                  style={androidStyles.androidMenuItem}
                  activeOpacity={0.7}
                >
                  <Text style={androidStyles.androidMenuItemText}>{option.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iosSwiftMenuLift: {
    zIndex: 50,
    overflow: 'visible',
    elevation: 0,
  },
  iosOrbMenuHostRow: {
    width: '100%',
    alignItems: 'center',
  },
  iosHostSlot: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  triggerWrapper: {
    width: '100%',
    borderRadius: 22.5,
    overflow: 'hidden',
    zIndex: 40,
    elevation: 0,
  },
  triggerWrapperCustomLabel: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'visible',
    zIndex: 40,
    elevation: 0,
  },
  triggerWrapperIos: {
    overflow: 'visible',
  },
});
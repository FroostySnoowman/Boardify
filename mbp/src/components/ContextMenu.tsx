import React, { useState, useRef } from 'react';
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
import { hapticLight } from '../utils/haptics';

let SwiftContextMenu: any;
let SwiftMenu: any;
let Button: any;
let Section: any;
let Host: any;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftContextMenu = swiftUI.ContextMenu;
    SwiftMenu = swiftUI.Menu;
    Button = swiftUI.Button;
    Section = swiftUI.Section;
    Host = swiftUI.Host;
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
}

export function ContextMenu({ trigger, options, onSelect, activationMethod = 'singlePress', onSinglePress }: ContextMenuProps) {
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

    if (activationMethod === 'singlePress' && SwiftMenu) {
      return (
        <Host>
          <SwiftMenu label={
            <View ref={triggerRef} style={styles.triggerWrapper} collapsable={false}>
              {trigger}
            </View>
          }>
            {menuItems}
          </SwiftMenu>
        </Host>
      );
    }

    if (SwiftContextMenu) {
      return (
        <Host>
          <SwiftContextMenu>
            <SwiftContextMenu.Trigger>
              <View ref={triggerRef} style={styles.triggerWrapper} collapsable={false}>
                {trigger}
              </View>
            </SwiftContextMenu.Trigger>
            <SwiftContextMenu.Items>
              {menuItems}
            </SwiftContextMenu.Items>
          </SwiftContextMenu>
        </Host>
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
              styles.androidMenuOverlay,
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
              styles.androidMenuContainer,
              {
                opacity: androidMenuOpacity,
                transform: [{ scale: androidMenuScale }],
              },
            ]}
          >
            {options.map((option, index) => (
              <React.Fragment key={option.value}>
                {index > 0 && <View style={styles.androidMenuDivider} />}
                <TouchableOpacity
                  onPress={() => handleAndroidMenuAction(option)}
                  style={styles.androidMenuItem}
                  activeOpacity={0.7}
                >
                  <Text style={styles.androidMenuItemText}>{option.label}</Text>
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
  triggerWrapper: {
    width: '100%',
  },
  androidMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  androidMenuContainer: {
    minWidth: 200,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  androidMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
});
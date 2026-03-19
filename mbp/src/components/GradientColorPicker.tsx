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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';

interface GradientOption {
  name: string;
  start: string;
  end: string;
}

interface GradientColorPickerProps {
  trigger: React.ReactNode;
  gradients: GradientOption[];
  selectedStart: string;
  selectedEnd: string;
  onSelect: (start: string, end: string) => void;
}

export function GradientColorPicker({
  trigger,
  gradients,
  selectedStart,
  selectedEnd,
  onSelect,
}: GradientColorPickerProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.9)).current;
  const triggerRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handlePress = () => {
    hapticLight();
    if (triggerRef.current) {
      triggerRef.current.measure((x, y, width, height, pageX, pageY) => {
        const screenWidth = Dimensions.get('window').width;
        const menuWidth = 280;
        const padding = 16;

        let menuX = pageX;
        if (pageX + menuWidth > screenWidth - padding) {
          menuX = screenWidth - menuWidth - padding;
          if (pageX + width > menuX + menuWidth) {
            menuX = pageX + width - menuWidth;
          }
        }

        setMenuPosition({ x: Math.max(padding, menuX), y: pageY + height + 8 });
        setMenuVisible(true);
        Animated.parallel([
          Animated.timing(menuOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(menuScale, {
            toValue: 1,
            tension: 300,
            friction: 30,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      setMenuPosition({ x: 16, y: 200 });
      setMenuVisible(true);
      Animated.parallel([
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(menuScale, {
          toValue: 1,
          tension: 300,
          friction: 30,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleCloseMenu = () => {
    Animated.parallel([
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(menuScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
    });
  };

  const handleGradientSelect = (gradient: GradientOption) => {
    hapticLight();
    handleCloseMenu();
    setTimeout(() => {
      onSelect(gradient.start, gradient.end);
    }, 150);
  };

  const isIOS = Platform.OS === 'ios';

  return (
    <>
      <View
        ref={triggerRef}
        style={{ width: '100%' }}
        collapsable={false}
      >
        <Pressable
          onPress={handlePress}
          style={{ width: '100%' }}
        >
          <View pointerEvents="none">
            {trigger}
          </View>
        </Pressable>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseMenu}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseMenu}>
          <Animated.View
            style={[
              styles.menuOverlay,
              {
                opacity: menuOpacity,
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
              isIOS ? styles.iosMenuContainer : styles.androidMenuContainer,
              {
                opacity: menuOpacity,
                transform: [{ scale: menuScale }],
              },
            ]}
          >
            <View style={styles.gradientGrid}>
              {gradients.map((gradient) => {
                const isSelected = selectedStart === gradient.start && selectedEnd === gradient.end;
                return (
                  <TouchableOpacity
                    key={gradient.name}
                    onPress={() => handleGradientSelect(gradient)}
                    style={styles.gradientItem}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={[gradient.start, gradient.end]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.gradientSwatch,
                        isSelected && styles.gradientSwatchSelected,
                      ]}
                    >
                      {isSelected && (
                        <Feather name="check" size={16} color="#ffffff" />
                      )}
                    </LinearGradient>
                    <Text style={styles.gradientLabel}>{gradient.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.4)',
  },
  iosMenuContainer: {
    width: 280,
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  androidMenuContainer: {
    width: 280,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  gradientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  gradientItem: {
    alignItems: 'center',
    gap: 6,
  },
  gradientSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientSwatchSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  gradientLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
  },
});

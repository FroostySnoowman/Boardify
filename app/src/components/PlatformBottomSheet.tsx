import React, { useEffect, useRef } from 'react';
import { View, Modal, Pressable, Animated, StyleSheet, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let Host: any;
let BottomSheet: any;
let RNHostView: any;
let Group: any;
let presentationDetentsMod: any;
let presentationDragIndicatorMod: any;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    Host = swiftUI.Host;
    BottomSheet = swiftUI.BottomSheet;
    RNHostView = swiftUI.RNHostView;
    Group = swiftUI.Group;
    const mods = require('@expo/ui/swift-ui/modifiers');
    presentationDetentsMod = mods.presentationDetents;
    presentationDragIndicatorMod = mods.presentationDragIndicator;
  } catch (error) {
    console.warn('SwiftUI components not available');
  }
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BACKGROUND_COLOR = '#020617';

interface PlatformBottomSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (opened: boolean) => void;
  /** Fractions of screen height (e.g. `[0.35, 0.5]`). iOS uses all for snap points; Android/web use the largest for sheet height. */
  presentationDetents?: number[];
  presentationDragIndicator?: 'visible' | 'hidden';
  /** Sheet panel background (defaults to dark navy). */
  sheetBackgroundColor?: string;
  /** Scrim behind the sheet (defaults to semi-transparent black). */
  overlayBackgroundColor?: string;
  /** Drag handle pill color. */
  handleBarColor?: string;
  children: React.ReactNode;
}

export function PlatformBottomSheet({
  isOpened,
  onIsOpenedChange,
  presentationDetents = [0.5],
  presentationDragIndicator = 'visible',
  sheetBackgroundColor = BACKGROUND_COLOR,
  overlayBackgroundColor = 'rgba(0, 0, 0, 0.5)',
  handleBarColor = 'rgba(255, 255, 255, 0.3)',
  children,
}: PlatformBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const detent =
    presentationDetents.length > 0 ? Math.max(...presentationDetents) : 0.5;
  const sheetHeight =
    Platform.OS === 'web'
      ? Math.max(280, Math.min(SCREEN_HEIGHT * detent, 520))
      : SCREEN_HEIGHT * detent;

  useEffect(() => {
    if (isOpened) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpened, slideAnim, opacityAnim]);

  if (Platform.OS === 'ios' && Host && BottomSheet && Group && presentationDetentsMod && presentationDragIndicatorMod) {
    const detents = presentationDetents.map(d => ({ fraction: d }));
    const modifiers = [
      presentationDetentsMod(detents),
      presentationDragIndicatorMod(presentationDragIndicator),
    ];

    return (
      <Host style={{ position: 'absolute', width: 0, height: 0 }}>
        <BottomSheet
          isPresented={isOpened}
          onIsPresentedChange={onIsOpenedChange}
        >
          <Group modifiers={modifiers}>
            {RNHostView ? (
              <RNHostView>
                <View
                  style={{
                    flex: 1,
                    marginBottom: -insets.bottom,
                    backgroundColor: sheetBackgroundColor,
                  }}
                >
                  {children}
                </View>
              </RNHostView>
            ) : (
              <View
                style={{
                  flex: 1,
                  marginBottom: -insets.bottom,
                  backgroundColor: sheetBackgroundColor,
                }}
              >
                {children}
              </View>
            )}
          </Group>
        </BottomSheet>
      </Host>
    );
  }

  return (
    <Modal
      visible={isOpened}
      transparent
      animationType="none"
      onRequestClose={() => onIsOpenedChange(false)}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
            backgroundColor: overlayBackgroundColor,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onIsOpenedChange(false)}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: sheetHeight,
            transform: [{ translateY: slideAnim }],
            backgroundColor: sheetBackgroundColor,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable 
          onPress={(e) => e.stopPropagation()}
          style={{ flex: 1 }}
        >
          {presentationDragIndicator === 'visible' && (
            <View style={styles.handleBarContainer}>
              <View style={[styles.handleBar, { backgroundColor: handleBarColor }]} />
            </View>
          )}
          <View
            style={[styles.content, { paddingBottom: insets.bottom, backgroundColor: sheetBackgroundColor }]}
          >
            {children}
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  handleBarContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    width: '100%',
  },
});

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
  presentationDetents?: number[];
  presentationDragIndicator?: 'visible' | 'hidden';
  children: React.ReactNode;
}

export function PlatformBottomSheet({
  isOpened,
  onIsOpenedChange,
  presentationDetents = [0.5],
  presentationDragIndicator = 'visible',
  children,
}: PlatformBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  const detent = presentationDetents[0] || 0.5;
  const sheetHeight = Platform.OS === 'web' 
    ? Math.max(280, Math.min(SCREEN_HEIGHT * detent, 420))
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
                <View style={{ flex: 1, marginBottom: -insets.bottom }}>
                  {children}
                </View>
              </RNHostView>
            ) : (
              <View style={{ flex: 1, marginBottom: -insets.bottom }}>
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
              <View style={styles.handleBar} />
            </View>
          )}
          <View style={[styles.content, { paddingBottom: insets.bottom }]}>
            {children}
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BACKGROUND_COLOR,
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    width: '100%',
  },
});

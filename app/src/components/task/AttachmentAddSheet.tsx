import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PlatformBottomSheet } from '../PlatformBottomSheet';
import { useTheme } from '../../theme';
import { hapticLight } from '../../utils/haptics';

const SHEET_BODY_HORIZONTAL_PADDING = 16;

type Props = {
  visible: boolean;
  onClose: () => void;
  onFiles: () => void;
  onPhotos: () => void;
  onCamera: () => void;
};

type TileProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  tileShadow: ViewStyle;
  colors: ReturnType<typeof useTheme>['colors'];
};

function AttachmentTile({ icon, label, hint, onPress, tileShadow, colors }: TileProps) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => [
        styles.tile,
        tileShadow,
        {
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        pressed && styles.pressedTile,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${hint}`}
    >
      <View style={[styles.iconWrap, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <Feather name={icon} size={22} color={colors.iconPrimary} />
      </View>
      <View style={styles.tileTextWrap}>
        <Text
          style={[styles.tileLabel, { color: colors.textPrimary }]}
          numberOfLines={1}
          {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
        >
          {label}
        </Text>
        <Text
          style={[styles.tileHint, { color: colors.textTertiary }]}
          numberOfLines={2}
          {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
        >
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

export function AttachmentAddSheet({
  visible,
  onClose,
  onFiles,
  onPhotos,
  onCamera,
}: Props) {
  const { colors, resolvedScheme } = useTheme();
  const showMedia = Platform.OS !== 'web';
  const [sheetBodyWidth, setSheetBodyWidth] = useState(0);
  const onSheetBodyLayout = useCallback((e: LayoutChangeEvent) => {
    /** Outer width minus `sheetBody` horizontal padding so the row matches the content box. */
    const inner = Math.max(
      0,
      e.nativeEvent.layout.width - SHEET_BODY_HORIZONTAL_PADDING * 2
    );
    setSheetBodyWidth((prev) => (Math.abs(prev - inner) < 0.5 ? prev : inner));
  }, []);

  const handleBarColor = useMemo(
    () =>
      resolvedScheme === 'dark' ? 'rgba(245, 240, 232, 0.22)' : 'rgba(10, 10, 10, 0.2)',
    [resolvedScheme]
  );

  const tileShadow = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: resolvedScheme === 'dark' ? 0.35 : 0.12,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
        default: {},
      }),
    [resolvedScheme]
  );

  return (
    <PlatformBottomSheet
      isOpened={visible}
      onIsOpenedChange={(open) => {
        if (!open) onClose();
      }}
      presentationDetents={[0.34, 0.5]}
      presentationDragIndicator="visible"
      sheetBackgroundColor={colors.surfaceElevated}
      overlayBackgroundColor={colors.overlayScrim}
      handleBarColor={handleBarColor}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sheetBody} onLayout={onSheetBodyLayout}>
          <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">
            Add attachment
          </Text>

          <View style={[styles.row, sheetBodyWidth > 0 && { minWidth: sheetBodyWidth }]}>
            {showMedia ? (
              <>
                <AttachmentTile
                  icon="camera"
                  label="Camera"
                  hint="New photo"
                  onPress={onCamera}
                  tileShadow={tileShadow}
                  colors={colors}
                />
                <AttachmentTile
                  icon="image"
                  label="Photos"
                  hint="Library"
                  onPress={onPhotos}
                  tileShadow={tileShadow}
                  colors={colors}
                />
              </>
            ) : null}
            <AttachmentTile
              icon="paperclip"
              label="Files"
              hint={showMedia ? 'PDFs & docs' : 'PDFs, documents, and more'}
              onPress={onFiles}
              tileShadow={tileShadow}
              colors={colors}
            />
          </View>
        </View>
      </ScrollView>
    </PlatformBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
    alignSelf: 'stretch',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'stretch',
    paddingTop: 26,
    paddingBottom: 16,
  },
  sheetBody: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: SHEET_BODY_HORIZONTAL_PADDING,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.35,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'space-evenly',
    gap: 12,
    flexWrap: 'nowrap',
  },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 118,
  },
  pressedTile: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  tileTextWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
  },
  tileHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 14,
    width: '100%',
  },
});

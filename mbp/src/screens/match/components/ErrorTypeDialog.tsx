import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'

interface ErrorTypeDialogProps {
  visible: boolean
  onClose: () => void
  onSelect: (errorType: 'UNFORCED ERROR' | 'FORCED ERROR') => void
}

export default function ErrorTypeDialog({ visible, onClose, onSelect }: ErrorTypeDialogProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  return (
    <PlatformBottomSheet
      isOpened={visible}
      presentationDragIndicator="visible"
      presentationDetents={[0.25]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.title}>Error Type</Text>
                <Text style={styles.subtitle}>Was this an unforced error or forced error?</Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => onSelect('UNFORCED ERROR')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <LinearGradient
                      colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.optionGradient}
                    >
                      <Text style={styles.optionText}>Unforced Error</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => onSelect('FORCED ERROR')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <LinearGradient
                      colors={['rgba(249, 115, 22, 0.2)', 'rgba(234, 88, 12, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.optionGradient}
                    >
                      <Text style={styles.optionText}>Forced Error</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
    </PlatformBottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
})

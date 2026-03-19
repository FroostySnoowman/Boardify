import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'

interface UndoPointDialogProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export default function UndoPointDialog({ 
  visible, 
  onClose, 
  onConfirm,
  loading = false
}: UndoPointDialogProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  return (
    <PlatformBottomSheet
      isOpened={visible}
      presentationDragIndicator="visible"
      presentationDetents={[0.3]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.title}>Undo Entire Point?</Text>
                <Text style={styles.subtitle}>
                  Are you sure you want to undo the entire last point? This will revert all shots and the point result.
                </Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    disabled={loading}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={styles.cancelButtonInner}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmButton, loading && styles.disabledButton]}
                    onPress={onConfirm}
                    disabled={loading}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <LinearGradient
                      colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.confirmButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Undo Point</Text>
                      )}
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
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
})

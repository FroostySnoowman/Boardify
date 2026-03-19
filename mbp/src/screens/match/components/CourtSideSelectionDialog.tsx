import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'
import { hapticLight } from '../../../utils/haptics'

interface CourtSideSelectionDialogProps {
  visible: boolean
  onClose: () => void
  onSelect: (courtSide: 'top' | 'bottom') => void
  yourTeamName: string
}

export default function CourtSideSelectionDialog({ 
  visible, 
  onClose, 
  onSelect,
  yourTeamName
}: CourtSideSelectionDialogProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const handleSelect = (courtSide: 'top' | 'bottom') => {
    hapticLight()
    onSelect(courtSide)
  }

  return (
    <PlatformBottomSheet
      isOpened={visible}
      presentationDragIndicator="visible"
      presentationDetents={[0.35]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.title}>Which Side is Your Team Starting On?</Text>
                <Text style={styles.subtitle}>{yourTeamName}</Text>

                <View style={styles.buttonColumn}>
                  <TouchableOpacity
                    onPress={() => handleSelect('top')}
                    style={styles.optionButton}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <LinearGradient
                      colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.optionGradient, styles.topOption]}
                    >
                      <Text style={styles.optionText}>Top (Blue)</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSelect('bottom')}
                    style={styles.optionButton}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <LinearGradient
                      colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.optionGradient, styles.bottomOption]}
                    >
                      <Text style={styles.optionText}>Bottom (Red)</Text>
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
  buttonColumn: {
    gap: 12,
  },
  optionButton: {
    borderRadius: 9999,
    overflow: 'hidden',
  },
  optionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 9999,
    alignItems: 'center',
  },
  topOption: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  bottomOption: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  optionText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 16,
  },
})

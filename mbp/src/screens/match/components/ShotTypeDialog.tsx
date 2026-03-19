import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'
import { StrokeType } from '../utils/courtBounds'

interface ShotTypeDialogProps {
  visible: boolean
  title?: string
  subtitle?: string
  onClose: () => void
  onSelect: (shotType: StrokeType) => void
}

const SHOT_OPTIONS: Array<{ type: StrokeType; label: string; colors: [string, string]; borderColor: string }> = [
  { type: 'forehand', label: 'Forehand', colors: ['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.2)'], borderColor: 'rgba(59, 130, 246, 0.3)' },
  { type: 'backhand', label: 'Backhand', colors: ['rgba(139, 92, 246, 0.2)', 'rgba(124, 58, 237, 0.2)'], borderColor: 'rgba(139, 92, 246, 0.3)' },
  { type: 'volley', label: 'Volley', colors: ['rgba(34, 197, 94, 0.2)', 'rgba(22, 163, 74, 0.2)'], borderColor: 'rgba(34, 197, 94, 0.3)' },
  { type: 'overhead', label: 'Overhead', colors: ['rgba(234, 179, 8, 0.2)', 'rgba(202, 138, 4, 0.2)'], borderColor: 'rgba(234, 179, 8, 0.3)' },
  { type: 'drop-shot', label: 'Drop Shot', colors: ['rgba(236, 72, 153, 0.2)', 'rgba(219, 39, 119, 0.2)'], borderColor: 'rgba(236, 72, 153, 0.3)' },
  { type: 'lob', label: 'Lob', colors: ['rgba(6, 182, 212, 0.2)', 'rgba(8, 145, 178, 0.2)'], borderColor: 'rgba(6, 182, 212, 0.3)' },
]

export default function ShotTypeDialog({ 
  visible, 
  title = 'Shot Type',
  subtitle = 'What type of shot was hit?',
  onClose, 
  onSelect 
}: ShotTypeDialogProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  return (
    <PlatformBottomSheet
      isOpened={visible}
      presentationDragIndicator="visible"
      presentationDetents={[0.35]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>

                <View style={styles.buttonGrid}>
                  {SHOT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.type}
                      style={styles.optionButton}
                      onPress={() => onSelect(option.type)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <LinearGradient
                        colors={option.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.optionGradient, 
                          { borderColor: option.borderColor }
                        ]}
                      >
                        <Text style={styles.optionText}>{option.label}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
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
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    width: '47%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
})

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'
import { StrokeType } from '../utils/courtBounds'

interface VolleyTypeDialogProps {
  visible: boolean
  context: 'click' | 'error' | 'winner' | null
  onClose: () => void
  onSelect: (shotType: StrokeType) => void
}

const VOLLEY_OPTIONS: Array<{ type: StrokeType; label: string; colors: [string, string]; borderColor: string }> = [
  { type: 'forehand', label: 'Forehand Volley', colors: ['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.2)'], borderColor: 'rgba(59, 130, 246, 0.3)' },
  { type: 'backhand', label: 'Backhand Volley', colors: ['rgba(139, 92, 246, 0.2)', 'rgba(124, 58, 237, 0.2)'], borderColor: 'rgba(139, 92, 246, 0.3)' },
  { type: 'drop-shot', label: 'Drop Shot', colors: ['rgba(236, 72, 153, 0.2)', 'rgba(219, 39, 119, 0.2)'], borderColor: 'rgba(236, 72, 153, 0.3)' },
  { type: 'lob', label: 'Lob', colors: ['rgba(6, 182, 212, 0.2)', 'rgba(8, 145, 178, 0.2)'], borderColor: 'rgba(6, 182, 212, 0.3)' },
  { type: 'overhead', label: 'Overhead', colors: ['rgba(234, 179, 8, 0.2)', 'rgba(202, 138, 4, 0.2)'], borderColor: 'rgba(234, 179, 8, 0.3)' },
]

export default function VolleyTypeDialog({ 
  visible, 
  context,
  onClose, 
  onSelect 
}: VolleyTypeDialogProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const title = 'Volley Type'
  const subtitle = context === 'error' 
    ? 'What type of shot was missed at the net?' 
    : 'What type of shot was hit at the net?'

  return (
    <PlatformBottomSheet
      isOpened={visible}
      presentationDragIndicator="visible"
      presentationDetents={[0.35, 0.7]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>

                <View style={styles.buttonGrid}>
                  {VOLLEY_OPTIONS.map((option) => (
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
              </ScrollView>
    </PlatformBottomSheet>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
})

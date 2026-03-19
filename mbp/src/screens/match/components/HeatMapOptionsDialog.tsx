import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'

export type HeatMapType = 
  | 'serve-placement' 
  | 'return-placement' 
  | 'rally-shots' 
  | 'winners' 
  | 'errors' 
  | 'forehand' 
  | 'backhand' 
  | 'volley' 
  | 'overhead' 
  | 'all-shots'

export type ServeType = 'first' | 'second' | 'all'

interface HeatMapOptionsDialogProps {
  visible: boolean
  heatMapType: HeatMapType
  heatMapPlayer: string | 'all'
  heatMapServeType: ServeType
  players: Array<{ id: string; name: string }>
  onClose: () => void
  onTypeChange: (type: HeatMapType) => void
  onPlayerChange: (playerId: string | 'all') => void
  onServeTypeChange: (serveType: ServeType) => void
}

const HEAT_MAP_TYPES: Array<{ value: HeatMapType; label: string }> = [
  { value: 'serve-placement', label: 'Serve Placement' },
  { value: 'return-placement', label: 'Return Placement' },
  { value: 'rally-shots', label: 'Rally Shots' },
  { value: 'winners', label: 'Winners' },
  { value: 'errors', label: 'Errors' },
  { value: 'forehand', label: 'Forehand' },
  { value: 'backhand', label: 'Backhand' },
  { value: 'volley', label: 'Volley' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'all-shots', label: 'All Shots' },
]

const SERVE_TYPES: Array<{ value: ServeType; label: string }> = [
  { value: 'all', label: 'All Serves' },
  { value: 'first', label: '1st Serve' },
  { value: 'second', label: '2nd Serve' },
]

export default function HeatMapOptionsDialog({ 
  visible, 
  heatMapType,
  heatMapPlayer,
  heatMapServeType,
  players,
  onClose, 
  onTypeChange,
  onPlayerChange,
  onServeTypeChange,
}: HeatMapOptionsDialogProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  return (
    <PlatformBottomSheet
      isOpened={visible}
      presentationDragIndicator="visible"
      presentationDetents={[0.5, 0.8]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
              <Text style={styles.title}>Heat Map Options</Text>

              {/* Heat Map Type */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Type</Text>
                <View style={styles.optionGrid}>
                  {HEAT_MAP_TYPES.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionChip,
                        heatMapType === option.value && styles.optionChipSelected
                      ]}
                      onPress={() => onTypeChange(option.value)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Text style={[
                        styles.optionChipText,
                        heatMapType === option.value && styles.optionChipTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Player Filter */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Player</Text>
                <View style={styles.optionGrid}>
                  <TouchableOpacity
                    style={[
                      styles.optionChip,
                      heatMapPlayer === 'all' && styles.optionChipSelected
                    ]}
                    onPress={() => onPlayerChange('all')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text style={[
                      styles.optionChipText,
                      heatMapPlayer === 'all' && styles.optionChipTextSelected
                    ]}>
                      All Players
                    </Text>
                  </TouchableOpacity>
                  {players.map((player) => (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.optionChip,
                        heatMapPlayer === player.id && styles.optionChipSelected
                      ]}
                      onPress={() => onPlayerChange(player.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Text style={[
                        styles.optionChipText,
                        heatMapPlayer === player.id && styles.optionChipTextSelected
                      ]}>
                        {player.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Serve Type Filter (only for serve-related heat maps) */}
              {(heatMapType === 'serve-placement' || heatMapType === 'return-placement') && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Serve Type</Text>
                  <View style={styles.optionGrid}>
                    {SERVE_TYPES.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionChip,
                          heatMapServeType === option.value && styles.optionChipSelected
                        ]}
                        onPress={() => onServeTypeChange(option.value)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      >
                        <Text style={[
                          styles.optionChipText,
                          heatMapServeType === option.value && styles.optionChipTextSelected
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
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
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionChipSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  optionChipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#ffffff',
  },
})

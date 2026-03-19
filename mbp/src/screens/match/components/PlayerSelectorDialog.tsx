import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'

interface Player {
  id: string
  name: string
  team: 'your' | 'opponent'
}

interface PlayerSelectorDialogProps {
  visible: boolean
  players: Player[]
  onClose: () => void
  onSelect: (playerId: string) => void
}

export default function PlayerSelectorDialog({ 
  visible, 
  players,
  onClose, 
  onSelect 
}: PlayerSelectorDialogProps) {
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
                <Text style={styles.title}>Who hit the shot?</Text>
                <Text style={styles.subtitle}>Select the player who made this shot</Text>

                <View style={styles.buttonGrid}>
                  {players.map((player) => {
                    const colors: [string, string] = player.team === 'your'
                      ? ['rgba(34, 197, 94, 0.2)', 'rgba(22, 163, 74, 0.2)']
                      : ['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.2)']
                    const borderColor = player.team === 'your'
                      ? 'rgba(34, 197, 94, 0.3)'
                      : 'rgba(59, 130, 246, 0.3)'

                    return (
                      <TouchableOpacity
                        key={player.id}
                        style={styles.optionButton}
                        onPress={() => onSelect(player.id)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <LinearGradient
                          colors={colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.optionGradient, 
                            { borderColor }
                          ]}
                        >
                          <Text style={styles.optionText}>{player.name}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )
                  })}
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
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
})

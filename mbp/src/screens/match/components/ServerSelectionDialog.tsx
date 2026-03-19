import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ServerSelectionDialogProps } from '../utils/types'
import { hapticImpactLight } from '../utils/matchUtils'
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet'

const ServerSelectionDialog = ({ open, onClose, onSelect, match, team }: ServerSelectionDialogProps) => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  if (!match) return null

  const yourTeam = [match.yourPlayer1, match.yourPlayer2].filter(Boolean) as string[]
  const oppTeam = [match.oppPlayer1, match.oppPlayer2].filter(Boolean) as string[]

  let playersToShow: string[] = []
  if (team === 'all') {
    playersToShow = [...yourTeam, ...oppTeam]
  } else if (team === 'your') {
    playersToShow = yourTeam
  } else {
    playersToShow = oppTeam
  }

  const handleSelect = (player: string) => {
    hapticImpactLight()
    onSelect(player)
  }

  return (
    <PlatformBottomSheet
      isOpened={open}
      presentationDragIndicator="visible"
      presentationDetents={[0.25]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <View style={styles.container}>
        <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title}>Who is Serving?</Text>
          <View style={styles.buttonGrid}>
            {playersToShow.map((player) => (
              <TouchableOpacity
                key={player}
                onPress={() => handleSelect(player)}
                style={styles.playerButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.playerButtonInner}>
                  <Text style={styles.playerButtonText} numberOfLines={1}>
                    {player}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </PlatformBottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
    flex: 1,
    width: '100%',
  },
  content: {
    padding: 20,
    paddingTop: 16,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  playerButton: {
    borderRadius: 9999,
  },
  playerButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  playerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default ServerSelectionDialog

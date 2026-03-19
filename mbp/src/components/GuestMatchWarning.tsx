import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { PlatformBottomSheet } from './PlatformBottomSheet';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../utils/haptics';

interface GuestMatchWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function GuestMatchWarning({ isOpen, onClose, onConfirm }: GuestMatchWarningProps) {
  const handleConfirm = () => {
    hapticLight();
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    hapticLight();
    onClose();
  };

  // Web needs more height so "Continue as Guest" and content don't get cut off
  const detent = Platform.OS === 'web' ? 0.52 : 0.4;
  
  return (
    <PlatformBottomSheet isOpened={isOpen} onIsOpenedChange={onClose} presentationDetents={[detent]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Feather name="alert-triangle" size={Platform.OS === 'web' ? 24 : 32} color="#f59e0b" />
          </View>
        </View>

        <Text style={styles.title}>Continue as Guest?</Text>

        <Text style={styles.message}>
          This match will not be saved. All data will be lost when you close the app or navigate away.
        </Text>

        <Text style={styles.subMessage}>
          Sign in to save your matches and track your stats over time.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.8}
            style={[styles.button, styles.cancelButton]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleConfirm}
            activeOpacity={0.9}
            style={styles.button}
          >
            <LinearGradient
              colors={['#2563eb', '#1d4ed8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.confirmButtonText}>Continue as Guest</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </PlatformBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Platform.OS === 'web' ? 16 : 24,
    paddingTop: Platform.OS === 'web' ? 8 : 12,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'web' ? 12 : 16,
  },
  iconCircle: {
    width: Platform.OS === 'web' ? 48 : 64,
    height: Platform.OS === 'web' ? 48 : 64,
    borderRadius: Platform.OS === 'web' ? 24 : 32,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'web' ? 6 : 8,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 18 : 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: Platform.OS === 'web' ? 8 : 12,
  },
  message: {
    fontSize: Platform.OS === 'web' ? 14 : 16,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: Platform.OS === 'web' ? 8 : 12,
    lineHeight: Platform.OS === 'web' ? 20 : 24,
  },
  subMessage: {
    fontSize: Platform.OS === 'web' ? 12 : 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: Platform.OS === 'web' ? 16 : 24,
    lineHeight: Platform.OS === 'web' ? 16 : 20,
  },
  scrollView: {
    flexGrow: 0,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  button: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 36 : 48,
    borderRadius: Platform.OS === 'web' ? 8 : 12,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 8 : 14,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 13 : 16,
    fontWeight: '600',
  },
  gradientButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 8 : 14,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 13 : 16,
    fontWeight: '600',
    flexShrink: 0,
  },
});

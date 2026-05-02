import { Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      Alert.alert('Copy failed', 'Select and copy manually.');
      return false;
    }
  }
  try {
    await Clipboard.setStringAsync(text);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }
    return true;
  } catch {
    Alert.alert('Copy failed', 'Could not copy to the clipboard.');
    return false;
  }
}

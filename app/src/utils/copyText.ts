import { Platform, Share, Alert } from 'react-native';

export async function copyTextToClipboard(text: string, successTitle = 'Copied'): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      Alert.alert(successTitle, 'Ready to paste.');
    } catch {
      Alert.alert('Copy failed', 'Select and copy manually.');
    }
    return;
  }
  try {
    await Share.share({ message: text });
  } catch {
    // dismissed
  }
}

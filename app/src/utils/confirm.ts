import { Alert, Platform } from 'react-native';

function canUseWindow(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function alertOk(title: string, message?: string) {
  if (canUseWindow()) {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export async function confirmDestructive(args: {
  title: string;
  message: string;
  confirmText?: string;
}): Promise<boolean> {
  const { title, message, confirmText = 'Confirm' } = args;
  if (canUseWindow()) {
    return window.confirm(`${title}\n\n${message}`);
  }
  return await new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}


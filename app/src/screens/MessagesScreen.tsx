import React from 'react';
import { View, Text, ScrollView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { TabScreenChrome } from '../components/TabScreenChrome';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
  const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;

  const scroll = (
    <ScrollView
      contentContainerStyle={{
        paddingTop: contentPaddingTop,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: isWeb ? 24 : 16,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
      bounces={Platform.OS === 'ios'}
    >
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>No conversations yet.</Text>
    </ScrollView>
  );

  if (isWeb) {
    return <View style={styles.root}>{scroll}</View>;
  }

  return <TabScreenChrome>{scroll}</TabScreenChrome>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
  },
});

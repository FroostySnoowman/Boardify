import { TeamScreen } from '../../src/screens';
import { useAuth } from '../../src/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LoginScreen } from '../../src/screens';
import { useLocalSearchParams } from 'expo-router';

function ProtectedTeamScreen() {
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<{ teamId?: string; convId?: string; conversationName?: string }>();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const initialParams = params.teamId ? {
    teamId: params.teamId,
    convId: params.convId,
    conversationName: params.conversationName,
  } : undefined;

  // Use key to force remount when teamId changes, so initialRouteName works
  return <TeamScreen key={params.teamId || 'default'} initialParams={initialParams} />;
}

export default ProtectedTeamScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
});

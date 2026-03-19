import { MatchesScreen } from '../../src/screens';
import { useAuth } from '../../src/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LoginScreen } from '../../src/screens';
import { useLocalSearchParams } from 'expo-router';
import { hasGuestMatch } from '../../src/utils/guestMatchStorage';
import { useEffect, useState } from 'react';

function ProtectedMatchesScreen() {
  const { user, loading } = useAuth();
  const params = useLocalSearchParams();
  const [hasGuest, setHasGuest] = useState(false);
  const [checkingGuest, setCheckingGuest] = useState(true);

  // Check for guest match if user is not authenticated
  useEffect(() => {
    if (!user && !loading) {
      hasGuestMatch().then(setHasGuest).finally(() => setCheckingGuest(false));
    } else {
      setCheckingGuest(false);
    }
  }, [user, loading]);

  if (loading || checkingGuest) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  // Allow access if user is authenticated OR if there's a guest match (or guestMatchId param)
  if (!user && !hasGuest && !params.guestMatchId) {
    return <LoginScreen />;
  }

  return (
    <MatchesScreen
      tabParam={params.tab as string | undefined}
      statsModeParam={params.statsMode as string | undefined}
    />
  );
}

export default ProtectedMatchesScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
});

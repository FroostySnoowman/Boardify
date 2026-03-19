import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BoardScreen from '../src/screens/BoardScreen';

export default function BoardRoute() {
  const router = useRouter();
  const { boardName } = useLocalSearchParams<{ boardName?: string | string[] }>();
  const raw = Array.isArray(boardName) ? boardName[0] : boardName;
  const resolvedName = raw?.trim() ? raw.trim() : 'My Board';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BoardScreen boardName={resolvedName} onBack={() => router.back()} />
    </>
  );
}

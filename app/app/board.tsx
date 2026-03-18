import { Stack, useRouter } from 'expo-router';
import BoardScreen from '../src/screens/BoardScreen';

export default function BoardRoute() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BoardScreen boardName="Work" onBack={() => router.back()} />
    </>
  );
}

import { useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import BoardScreen from '../src/screens/BoardScreen';

export default function BoardRoute() {
  const router = useRouter();
  const { boardName, boardId } = useLocalSearchParams<{
    boardName?: string | string[];
    boardId?: string | string[];
  }>();
  const rawName = Array.isArray(boardName) ? boardName[0] : boardName;
  const rawId = Array.isArray(boardId) ? boardId[0] : boardId;
  const resolvedName = rawName?.trim() ? rawName.trim() : 'My Board';
  const resolvedId = rawId?.trim() ? rawId.trim() : '';

  useEffect(() => {
    if (!resolvedId) {
      router.replace('/');
    }
  }, [resolvedId, router]);

  if (!resolvedId) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BoardScreen
        boardId={resolvedId}
        boardName={resolvedName}
        onBack={() => router.back()}
        onOpenBoardSettings={() =>
          router.push({
            pathname: '/board-settings',
            params: { boardId: resolvedId, boardName: resolvedName },
          })
        }
        onOpenBoardNotifications={() =>
          router.push({
            pathname: '/board-notifications',
            params: { boardId: resolvedId, boardName: resolvedName },
          })
        }
      />
    </>
  );
}

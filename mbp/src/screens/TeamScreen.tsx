import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationIndependentTree } from '@react-navigation/native';
import TeamDashboardScreen from './team/TeamDashboardScreen';
import TeamDetailScreen from './team/TeamScreen';
import ChatRoomScreen from './team/ChatRoomScreen';
import CreateTeamScreen from './team/CreateTeamScreen';

const Stack = createNativeStackNavigator();

type TeamScreenProps = {
  initialParams?: {
    teamId?: string;
    convId?: string;
    conversationName?: string;
  };
};

function TeamScreenNavigator({ initialParams }: TeamScreenProps) {
  return (
    <NavigationIndependentTree>
      <Stack.Navigator
        initialRouteName={initialParams?.teamId ? 'TeamDetail' : 'TeamDashboard'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#020617' },
          animation: 'none',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen 
          name="TeamDashboard" 
          component={TeamDashboardScreen}
          initialParams={initialParams}
        />
        <Stack.Screen 
          name="TeamDetail" 
          component={TeamDetailScreen}
          initialParams={initialParams}
        />
        <Stack.Screen 
          name="ChatRoom" 
          component={ChatRoomScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen 
          name="CreateTeam" 
          component={CreateTeamScreen}
        />
      </Stack.Navigator>
    </NavigationIndependentTree>
  );
}

export default function TeamScreen({ initialParams }: TeamScreenProps = {}) {
  return <TeamScreenNavigator initialParams={initialParams} />;
}
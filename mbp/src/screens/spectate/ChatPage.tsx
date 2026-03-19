import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../../utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

interface ChatPageProps {
  teamId: string;
}

export default function ChatPage({ teamId }: ChatPageProps) {
  const [message, setMessage] = useState('');

  const chatExample = [
    { id: 1, user: 'Alex', time: '2:31 PM', text: 'What a rally! 🎾' },
    { id: 2, user: 'Jordan', time: '2:32 PM', text: 'Go Falcons! 🦅' },
    { id: 3, user: 'Cam', time: '2:35 PM', text: 'Great first set.' }
  ];

  const reactions = [
    { emoji: '👏', count: 42 },
    { emoji: '🔥', count: 28 },
    { emoji: '🏆', count: 15 },
  ];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-col gap-6 flex-1">
      {/* Main Chat Area */}
      <View className="flex-1 min-h-[400px]">
        {/* Messages */}
        <View className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl mb-4">
          <ScrollView showsVerticalScrollIndicator={false}>
            {chatExample.map(msg => (
              <View key={msg.id} className="mb-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="font-semibold text-white">{msg.user}</Text>
                  <Text className="text-xs text-gray-400">{msg.time}</Text>
                </View>
                <View className="bg-white/5 p-2 rounded-lg self-start">
                  <Text className="text-gray-300">{msg.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Input Area */}
        <View className="flex-row gap-2">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-white"
          />
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              // Handle send
              setMessage('');
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#22c55e', '#10b981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="px-6 py-2 rounded-full"
            >
              <Text className="font-semibold text-white">Send</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reactions Sidebar */}
        <View className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <Text className="font-bold text-white mb-3">Reactions</Text>
          <View className="flex-row justify-around">
          {reactions.map(({ emoji, count }) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => hapticLight()}
              className="items-center"
              activeOpacity={0.7}
            >
              <Text className="text-3xl">{emoji}</Text>
              <Text className="text-xs text-gray-300 mt-1">{count}</Text>
            </TouchableOpacity>
          ))}
          </View>
        </View>
        <KeyboardSpacer extraOffset={24} />
      </View>
    </ScrollView>
  );
}

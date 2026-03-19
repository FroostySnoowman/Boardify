import '@expo/metro-runtime';
import TrackPlayer from 'react-native-track-player';

import { radioTrackPlayerPlaybackService } from './src/services/radioTrackPlayerService';
import 'expo-router/entry';

TrackPlayer.registerPlaybackService(() => radioTrackPlayerPlaybackService);

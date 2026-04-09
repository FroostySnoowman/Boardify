import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadProfilePicture, removeProfilePicture } from '../api/user';
import { hapticLight } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { getImageUrl } from '../utils/imageUrl';
import { SkeletonBlock } from './skeletons/SkeletonBlock';

interface ProfilePictureUploadProps {
  currentImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onRemoveSuccess?: () => void;
  tone?: 'dark' | 'light';
}

export default function ProfilePictureUpload({
  currentImageUrl,
  onUploadSuccess,
  onRemoveSuccess,
  tone = 'dark',
}: ProfilePictureUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshUser } = useAuth();
  const light = tone === 'light';

  useEffect(() => {
    const imageUrl = getImageUrl(currentImageUrl);
    setPreview(imageUrl || null);
  }, [currentImageUrl]);

  const handleImagePick = async () => {
    hapticLight();

    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 400,
        maxHeight: 400,
        includeBase64: false,
      },
      async (response) => {
        if (response.didCancel || response.errorCode || !response.assets?.[0]) {
          if (response.errorCode === 'permission') {
            Alert.alert(
              'Permission needed',
              'Please grant camera roll permissions to upload a profile picture.'
            );
          }
          return;
        }

        const asset = response.assets[0];
        if (!asset.uri) return;

        setError(null);

        try {
          setPreview(asset.uri);
          setUploading(true);

          const fetchResponse = await fetch(asset.uri);
          const blob = await fetchResponse.blob();

          const url = await uploadProfilePicture(blob);
          const processedUrl = getImageUrl(url);
          setPreview(processedUrl || url);
          onUploadSuccess(url);
          await refreshUser();
          hapticLight();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
          setPreview(currentImageUrl || null);
        } finally {
          setUploading(false);
        }
      }
    );
  };

  const handleRemove = async () => {
    hapticLight();
    if (currentImageUrl) {
      setRemoving(true);
      setError(null);
      try {
        await removeProfilePicture();
        setPreview(null);
        if (onRemoveSuccess) onRemoveSuccess();
        await refreshUser();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove picture');
      } finally {
        setRemoving(false);
      }
    } else {
      setPreview(null);
    }
  };

  const avatarSize = light ? styles.avatarLight : styles.avatarDark;
  const uploadLabel =
    uploading ? 'Uploading...' : preview ? 'Change picture' : 'Upload picture';

  return (
    <View style={styles.column}>
      <View style={styles.avatarCol}>
        {preview ? (
          <>
            <View style={[styles.avatarWrap, avatarSize]}>
              <ExpoImage
                source={{ uri: preview }}
                style={styles.image}
                cachePolicy="memory-disk"
                transition={200}
                contentFit="cover"
              />
              {uploading ? (
                <View style={styles.uploadOverlay} pointerEvents="none">
                  <SkeletonBlock
                    width="100%"
                    height={128}
                    borderRadius={64}
                    variant="onWhite"
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ) : null}
            </View>
            {!uploading && (
              <TouchableOpacity
                onPress={handleRemove}
                disabled={removing}
                style={[
                  light ? styles.removeBtnLight : styles.removeBtnDark,
                  { opacity: removing ? 0.5 : 1 },
                ]}
                activeOpacity={0.8}
              >
                <Text style={light ? styles.removeTextLight : styles.removeTextDark}>
                  {removing ? 'Removing…' : 'Remove picture'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : light ? (
          <View style={styles.placeholderLight}>
            <Feather name="camera" size={40} color="#444" />
          </View>
        ) : (
          <LinearGradient
            colors={['#3b82f6', '#06b6d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.placeholderCircle}
          >
            <Feather name="camera" size={48} color="rgba(255, 255, 255, 0.8)" />
          </LinearGradient>
        )}
      </View>

      <TouchableOpacity
        onPress={handleImagePick}
        disabled={uploading || removing}
        activeOpacity={0.9}
        style={{ opacity: uploading || removing ? 0.5 : 1 }}
      >
        {light ? (
          <View style={styles.uploadBtnLight}>
            <Text style={styles.uploadBtnLightText}>{uploadLabel}</Text>
          </View>
        ) : (
          <LinearGradient
            colors={['#3b82f6', '#06b6d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.uploadButton}
          >
            <Text style={styles.uploadBtnDarkText}>{uploadLabel}</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {error && (
        <View style={light ? styles.errorLight : styles.errorDark}>
          <Text style={light ? styles.errorTextLight : styles.errorTextDark}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  avatarCol: {
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  avatarDark: {
    width: 128,
    height: 128,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarLight: {
    width: 128,
    height: 128,
    borderWidth: 2,
    borderColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLight: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#e8e4dc',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnDark: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  removeTextDark: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '500',
  },
  removeBtnLight: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    minHeight: 36,
    justifyContent: 'center',
  },
  removeTextLight: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnLight: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  uploadBtnLightText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadBtnDarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorDark: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
  },
  errorTextDark: {
    color: '#f87171',
    fontSize: 14,
  },
  errorLight: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
  },
  errorTextLight: {
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '500',
  },
});

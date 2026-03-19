import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getImageUrl } from '../utils/imageUrl';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  iconColorStart?: string | null;
  iconColorEnd?: string | null;
}

const sizes = {
  xs: { container: 24, fontSize: 10 },
  sm: { container: 32, fontSize: 12 },
  md: { container: 40, fontSize: 14 },
  lg: { container: 48, fontSize: 16 },
  xl: { container: 64, fontSize: 18 },
};

const DEFAULT_GRADIENT = ['#3b82f6', '#06b6d4'] as const;
const PLACEHOLDER_BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export function Avatar({ src, alt = 'User', size = 'md', iconColorStart, iconColorEnd }: AvatarProps) {
  const { container, fontSize } = sizes[size];
  const [hasError, setHasError] = useState(false);

  const initials = alt
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const imageUrl = getImageUrl(src);

  const gradientColors: readonly [string, string] = (iconColorStart && iconColorEnd)
    ? [iconColorStart, iconColorEnd]
    : DEFAULT_GRADIENT;

  const renderFallback = () => (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.fallback,
        {
          width: container,
          height: container,
          borderRadius: container / 2,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </LinearGradient>
  );

  if (!imageUrl || hasError) {
    return renderFallback();
  }

  return (
    <ExpoImage
      source={{ uri: imageUrl }}
      placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
      cachePolicy="memory-disk"
      transition={200}
      onError={() => setHasError(true)}
      style={[
        styles.image,
        {
          width: container,
          height: container,
          borderRadius: container / 2,
        },
      ]}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

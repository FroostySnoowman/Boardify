import React from 'react';
import { View } from 'react-native';

interface SkeletonProps {
  className?: string;
  style?: any;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <View
      className={`animate-pulse rounded-md bg-white/10 ${className || ''}`}
      style={style}
    />
  );
}


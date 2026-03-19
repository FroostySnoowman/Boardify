import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const RING_RADIUS = 60;
const CHAR_SIZE = 18;
const REPEATS = 2;
const START_ANGLE = -90;

interface RotatingTextRingProps {
  label: string;
  centerChild: React.ReactNode;
  size?: number;
}

function toChars(s: string): string[] {
  return Array.from(s);
}

export function RotatingTextRing({ label, centerChild, size = 150 }: RotatingTextRingProps) {
  const center = Math.round(size / 2);
  const half = Math.round(CHAR_SIZE / 2);
  const repeated = (label + ' ').repeat(REPEATS).trim();
  const chars = toChars(repeated);
  const n = chars.length;

  const items = chars.map((char, i) => {
    const angleDeg = START_ANGLE + (i / n) * 360;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = RING_RADIUS * Math.cos(angleRad);
    const y = RING_RADIUS * Math.sin(angleRad);
    const rotation = Math.round(angleDeg + 90);
    const left = Math.round(center + x - half);
    const top = Math.round(center + y - half);
    return (
      <View
        key={i}
        style={[
          styles.charSlot,
          {
            left,
            top,
            width: CHAR_SIZE,
            height: CHAR_SIZE,
            transform: [{ rotate: `${rotation}deg` }],
          },
        ]}
      >
        <Text allowFontScaling={false} style={styles.char}>
          {char}
        </Text>
      </View>
    );
  });

  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      <View style={[styles.ring, { width: size, height: size }]}>{items}</View>
      <View style={styles.center}>{centerChild}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'relative',
  },
  charSlot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  char: {
    fontSize: 11,
    fontWeight: '500',
    color: '#000000',
    letterSpacing: 1,
    includeFontPadding: false,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

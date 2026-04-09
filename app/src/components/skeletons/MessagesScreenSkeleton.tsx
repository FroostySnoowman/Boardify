import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from './SkeletonBlock';
import { neuListRowCardBase } from '../NeuListRowPressable';

const ACCENTS = ['#a5d6a5', '#F3D9B1', '#b39ddb', '#d0d0d0', '#c4c4c4'];

function RowSkeleton({ accent }: { accent: string }) {
  return (
    <View style={s.rowOuter}>
      <View style={[s.shadow, { backgroundColor: accent }]} />
      <View
        style={[
          neuListRowCardBase,
          s.face,
          { borderLeftWidth: 4, borderLeftColor: accent, alignItems: 'flex-start', paddingVertical: 14 },
        ]}
      >
        <SkeletonBlock width={44} height={44} borderRadius={10} variant="onWhite" />
        <View style={s.textCol}>
          <View style={s.headlineLine}>
            <SkeletonBlock height={16} width={72} borderRadius={5} variant="onWhite" />
            <SkeletonBlock height={16} width={140} borderRadius={5} variant="onWhite" style={{ marginLeft: 6 }} />
          </View>
          <SkeletonBlock height={14} width="92%" borderRadius={5} variant="onWhite" style={{ marginTop: 6 }} />
        </View>
        <View style={s.right}>
          <View style={s.timeStack}>
            <SkeletonBlock height={12} width={44} borderRadius={4} variant="onWhite" />
            <SkeletonBlock width={8} height={8} borderRadius={4} variant="onWhite" style={{ marginTop: 4 }} />
          </View>
          <SkeletonBlock width={18} height={18} borderRadius={4} variant="onWhite" />
        </View>
      </View>
    </View>
  );
}

export function MessagesScreenSkeleton() {
  return (
    <View style={s.list}>
      {ACCENTS.map((a, i) => (
        <RowSkeleton key={i} accent={a} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 12,
  },
  rowOuter: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    left: 4,
    top: 4,
    right: -4,
    bottom: -4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
  },
  face: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  headlineLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  timeStack: {
    alignItems: 'flex-end',
    gap: 4,
  },
});

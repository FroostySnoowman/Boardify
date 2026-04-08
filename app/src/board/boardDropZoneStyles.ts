import type { ViewStyle } from 'react-native';

export const boardDropZoneChrome: Pick<
  ViewStyle,
  'borderWidth' | 'borderStyle' | 'borderColor' | 'backgroundColor'
> = {
  borderWidth: 2,
  borderStyle: 'dashed',
  borderColor: 'rgba(10,10,10,0.25)',
  backgroundColor: 'rgba(255,255,255,0.35)',
};

export const BOARD_DROP_ZONE_CARD_RADIUS = 8;

export const BOARD_DROP_ZONE_COLUMN_RADIUS = 12;

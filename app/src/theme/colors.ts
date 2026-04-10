export type ResolvedScheme = 'light' | 'dark';

/** Semantic colors — use via `useTheme().colors`; avoid raw hex in UI. */
export type ThemeColors = {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  iconPrimary: string;
  iconMuted: string;
  iconChevron: string;
  /** Hard-shadow / offset layer behind neu cards */
  shadowFill: string;
  shadowFillColumn: string;
  columnSurface: string;
  cardFace: string;
  cardFaceOnColumn: string;
  inputBackground: string;
  overlayScrim: string;
  /** Stack modals that use the “cream” sheet (login, settings, …) */
  modalCreamCanvas: string;
  modalCreamHeaderTint: string;
  /** High-contrast sheet (e.g. some overlays) */
  modalNavyCanvas: string;
  modalNavyHeaderTint: string;
  success: string;
  successTrack: string;
  danger: string;
  dangerText: string;
  offlineBanner: string;
  offlineBannerText: string;
  switchTrackOff: string;
  switchThumb: string;
  skeletonWarm: string;
  skeletonOnSurface: string;
  skeletonOnCard: string;
  skeletonDark: string;
  avatarBg: string;
  boardHeaderBg: string;
  glassFallbackBg: string;
  glassFallbackBorder: string;
  divider: string;
  sectionLabel: string;
  subtitle: string;
  placeholder: string;
  link: string;
  focusRing: string;
  bottomBarIcon: string;
  bottomBarIconMuted: string;
  tableHeaderBg: string;
  tableRowAlt: string;
  calendarGridLine: string;
  timelineLine: string;
  chartAxis: string;
  chartGrid: string;
  /** iOS header blur / material hint */
  headerBlurMaterial: 'light' | 'dark' | 'systemChromeMaterialLight' | 'systemChromeMaterialDark';
  dropZoneBorder: string;
  dropZoneBg: string;
  focusDotInactive: string;
  boardLink: string;
  /** “Done” / positive action text on panels */
  successEmphasis: string;
  primaryButtonBg: string;
  primaryButtonText: string;
};

const light: ThemeColors = {
  canvas: '#f5f0e8',
  surface: '#ffffff',
  surfaceMuted: '#ebe6de',
  surfaceElevated: '#ffffff',
  border: '#000000',
  textPrimary: '#0a0a0a',
  textSecondary: '#666666',
  textTertiary: '#888888',
  iconPrimary: '#0a0a0a',
  iconMuted: '#666666',
  iconChevron: '#666666',
  shadowFill: '#e0e0e0',
  shadowFillColumn: '#000000',
  columnSurface: '#e8e8e8',
  cardFace: '#ffffff',
  cardFaceOnColumn: '#ffffff',
  inputBackground: '#ffffff',
  overlayScrim: 'rgba(0,0,0,0.48)',
  modalCreamCanvas: '#f5f0e8',
  modalCreamHeaderTint: '#0a0a0a',
  modalNavyCanvas: '#020617',
  modalNavyHeaderTint: '#ffffff',
  success: '#a5d6a5',
  successTrack: '#a5d6a5',
  danger: '#b91c1c',
  dangerText: '#b91c1c',
  offlineBanner: '#475569',
  offlineBannerText: '#ffffff',
  switchTrackOff: '#e0e0e0',
  switchThumb: '#ffffff',
  skeletonWarm: '#dfd9cf',
  skeletonOnSurface: '#e8e4dc',
  skeletonOnCard: '#e8e4dc',
  skeletonDark: 'rgba(255,255,255,0.14)',
  avatarBg: '#f0ebe3',
  boardHeaderBg: '#f5f0e8',
  glassFallbackBg: 'rgba(255,255,255,0.85)',
  glassFallbackBorder: '#000000',
  divider: '#e5e5e5',
  sectionLabel: '#666666',
  subtitle: '#666666',
  placeholder: '#999999',
  link: '#0a0a0a',
  focusRing: '#0a0a0a',
  bottomBarIcon: '#0a0a0a',
  bottomBarIconMuted: 'rgba(10,10,10,0.6)',
  tableHeaderBg: '#f0ebe3',
  tableRowAlt: 'rgba(0,0,0,0.03)',
  calendarGridLine: 'rgba(0,0,0,0.12)',
  timelineLine: 'rgba(0,0,0,0.15)',
  chartAxis: '#666666',
  chartGrid: 'rgba(0,0,0,0.08)',
  headerBlurMaterial: 'systemChromeMaterialLight',
  primaryButtonBg: '#0a0a0a',
  primaryButtonText: '#ffffff',
  dropZoneBorder: 'rgba(10,10,10,0.25)',
  dropZoneBg: 'rgba(255,255,255,0.35)',
  focusDotInactive: '#c4c4c4',
  boardLink: '#0c66e4',
  successEmphasis: '#15803d',
};

const dark: ThemeColors = {
  canvas: '#141210',
  surface: '#1e1c1a',
  surfaceMuted: '#2a2825',
  surfaceElevated: '#262320',
  border: '#000000',
  textPrimary: '#f5f0e8',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  iconPrimary: '#f5f0e8',
  iconMuted: '#a8a29e',
  iconChevron: '#a8a29e',
  shadowFill: '#050505',
  shadowFillColumn: '#000000',
  columnSurface: '#2a2825',
  cardFace: '#1e1c1a',
  cardFaceOnColumn: '#232120',
  inputBackground: '#1e1c1a',
  overlayScrim: 'rgba(0,0,0,0.65)',
  modalCreamCanvas: '#141210',
  modalCreamHeaderTint: '#f5f0e8',
  modalNavyCanvas: '#0a0c12',
  modalNavyHeaderTint: '#f5f0e8',
  success: '#6b9b6b',
  successTrack: '#4a7a4a',
  danger: '#f87171',
  dangerText: '#fca5a5',
  offlineBanner: '#334155',
  offlineBannerText: '#f1f5f9',
  switchTrackOff: '#3f3d3a',
  switchThumb: '#f5f0e8',
  skeletonWarm: '#3d3a36',
  skeletonOnSurface: '#2f2c28',
  skeletonOnCard: '#2f2c28',
  skeletonDark: 'rgba(255,255,255,0.12)',
  avatarBg: '#2a2825',
  boardHeaderBg: '#141210',
  glassFallbackBg: 'rgba(30,28,26,0.92)',
  glassFallbackBorder: '#3f3d3a',
  divider: '#3f3d3a',
  sectionLabel: '#a8a29e',
  subtitle: '#a8a29e',
  placeholder: '#78716c',
  link: '#d6d3d1',
  focusRing: '#f5f0e8',
  bottomBarIcon: '#f5f0e8',
  bottomBarIconMuted: 'rgba(245,240,232,0.55)',
  tableHeaderBg: '#2a2825',
  tableRowAlt: 'rgba(255,255,255,0.04)',
  calendarGridLine: 'rgba(255,255,255,0.12)',
  timelineLine: 'rgba(255,255,255,0.15)',
  chartAxis: '#a8a29e',
  chartGrid: 'rgba(255,255,255,0.08)',
  headerBlurMaterial: 'systemChromeMaterialDark',
  primaryButtonBg: '#f5f0e8',
  primaryButtonText: '#141210',
  dropZoneBorder: 'rgba(245,240,232,0.22)',
  dropZoneBg: 'rgba(30,28,26,0.55)',
  focusDotInactive: '#52504d',
  boardLink: '#7ab8ff',
  successEmphasis: '#86efac',
};

export function getThemeColors(scheme: ResolvedScheme): ThemeColors {
  return scheme === 'dark' ? dark : light;
}

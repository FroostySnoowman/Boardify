// Court bounds constants for tennis court positioning
// All values are percentages (0-100) relative to court dimensions

export const COURT_BOUNDS = {
  width: 100,
  height: 100,
  netY: 763 / 1539 * 100,
  topServiceBox: {
    ad:    { x: 175 / 736 * 100, y: 464 / 1539 * 100, width: 198 / 736 * 100, height: 295 / 1539 * 100 },
    deuce: { x: 365 / 736 * 100, y: 464 / 1539 * 100, width: 197 / 736 * 100, height: 295 / 1539 * 100 },
  },
  bottomServiceBox: {
    ad:    { x: 175 / 736 * 100, y: 767 / 1539 * 100, width: 198 / 736 * 100, height: 295 / 1539 * 100 },
    deuce: { x: 365 / 736 * 100, y: 767 / 1539 * 100, width: 197 / 736 * 100, height: 295 / 1539 * 100 },
  },

  serviceBoxZones: {
    deuce: {
      wide: { start: 0, end: 0.33 },
      body: { start: 0.33, end: 0.67 },
      t: { start: 0.67, end: 1.0 }
    },
    ad: {
      t: { start: 0, end: 0.33 },
      body: { start: 0.33, end: 0.67 },
      wide: { start: 0.67, end: 1.0 }
    }
  },
  singles: {
    left: 175 / 736 * 100,
    right: 562 / 736 * 100,
    top: 210 / 1539 * 100,
    bottom: 1316 / 1539 * 100,
    topServiceLine: 759 / 1539 * 100,
    bottomServiceLine: 767 / 1539 * 100,
  },
  doubles: {
    left: 111 / 736 * 100,
    right: 626 / 736 * 100,
    top: 210 / 1539 * 100,
    bottom: 1316 / 1539 * 100,
    topServiceLine: 759 / 1539 * 100,
    bottomServiceLine: 767 / 1539 * 100,
  },
  topBaseline: { y: 210 / 1539 * 100 },
  bottomBaseline: { y: 1316 / 1539 * 100 },
  centerServiceLine: { x: 369 / 736 * 100 },
} as const

export type ServeSide = 'deuce' | 'ad'
export type CourtSide = 'top' | 'bottom'
export type ServePlacement = 'body' | 'wide' | 't'
export type StrokeType = 'forehand' | 'backhand' | 'volley' | 'overhead' | 'drop-shot' | 'lob' | 'serve' | 'return'

export interface BallLocation {
  id: string
  x: number
  y: number
  timestamp: number
  type: 'serve' | 'return' | 'rally' | 'outcome'
  playerId?: string
  outcome?: string
  servePlacement?: ServePlacement
  strokeType?: StrokeType
  isIn?: boolean
  sameSideError?: boolean
}

export interface UndoRestoreState {
  locations: BallLocation[]
  faultCount: number
  rallyLength: number
  stage: 'serve' | 'rally'
  lastServeLocation: { x: number; y: number } | null
}

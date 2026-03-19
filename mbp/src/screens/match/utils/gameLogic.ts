import { COURT_BOUNDS, ServeSide, ServePlacement, CourtSide } from './courtBounds'

/**
 * Check if a player position is at the net
 */
export const isPlayerAtNet = (playerY: number): boolean => {
  const topServiceBoxFront = COURT_BOUNDS.topServiceBox.deuce.y
  const bottomServiceBoxBack = COURT_BOUNDS.bottomServiceBox.deuce.y + COURT_BOUNDS.bottomServiceBox.deuce.height
  const netY = COURT_BOUNDS.netY
  const isOnTopSide = playerY < netY
  
  if (isOnTopSide) {
    return playerY > topServiceBoxFront && playerY < netY
  } else {
    return playerY > netY && playerY < bottomServiceBoxBack
  }
}

/**
 * Check if a ball location is in bounds on the court
 */
export const isInBounds = (x: number, y: number, isDoubles: boolean): boolean => {
  const bounds = isDoubles ? COURT_BOUNDS.doubles : COURT_BOUNDS.singles
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
}

/**
 * Check if a position is in the service box
 */
export const isInServiceBox = (x: number, y: number, side: ServeSide, courtSide: CourtSide): boolean => {
  const serviceBox = courtSide === 'top' 
    ? COURT_BOUNDS.topServiceBox[side]
    : COURT_BOUNDS.bottomServiceBox[side]
  
  return (
    x >= serviceBox.x &&
    x <= serviceBox.x + serviceBox.width &&
    y >= serviceBox.y &&
    y <= serviceBox.y + serviceBox.height
  )
}

/**
 * Determine serve placement (wide, body, T) based on position
 */
export const getServePlacement = (x: number, y: number, serveSide: ServeSide): ServePlacement | undefined => {
  const isTopHalf = y < COURT_BOUNDS.netY
  const serviceBox = isTopHalf 
    ? COURT_BOUNDS.topServiceBox[serveSide]
    : COURT_BOUNDS.bottomServiceBox[serveSide]
  
  // Check if in service box
  if (
    x < serviceBox.x ||
    x > serviceBox.x + serviceBox.width ||
    y < serviceBox.y ||
    y > serviceBox.y + serviceBox.height
  ) {
    return undefined
  }
  
  // Calculate relative X position within service box (0-1)
  const relativeX = (x - serviceBox.x) / serviceBox.width
  const zones = COURT_BOUNDS.serviceBoxZones[serveSide]
  
  if (relativeX >= zones.wide.start && relativeX < zones.wide.end) {
    return 'wide'
  } else if (relativeX >= zones.body.start && relativeX < zones.body.end) {
    return 'body'
  } else if (relativeX >= zones.t.start && relativeX <= zones.t.end) {
    return 't'
  }
  
  return undefined
}

/**
 * Determine which side of the net a position is on
 */
export const getCourtSide = (y: number): CourtSide => {
  return y < COURT_BOUNDS.netY ? 'top' : 'bottom'
}

/**
 * Calculate the default player position for a given player role
 */
export const getDefaultPlayerPosition = (
  playerKey: 'server' | 'receiver' | 'server-partner' | 'receiver-partner',
  serverIsBottom: boolean,
  serveSide: ServeSide,
  isDoubles: boolean
): { x: number; y: number } => {
  const topBaselineY = COURT_BOUNDS.topBaseline.y
  const bottomBaselineY = COURT_BOUNDS.bottomBaseline.y
  
  // Default X positions
  const centerX = 50
  const leftX = 30
  const rightX = 70
  
  switch (playerKey) {
    case 'server':
      if (serverIsBottom) {
        return { x: serveSide === 'deuce' ? rightX : leftX, y: bottomBaselineY }
      } else {
        return { x: serveSide === 'deuce' ? leftX : rightX, y: topBaselineY }
      }
    case 'receiver':
      if (serverIsBottom) {
        return { x: serveSide === 'deuce' ? rightX : leftX, y: topBaselineY }
      } else {
        return { x: serveSide === 'deuce' ? leftX : rightX, y: bottomBaselineY }
      }
    case 'server-partner':
      if (!isDoubles) return { x: centerX, y: centerX }
      if (serverIsBottom) {
        return { x: serveSide === 'deuce' ? leftX : rightX, y: (COURT_BOUNDS.netY + bottomBaselineY) / 2 }
      } else {
        return { x: serveSide === 'deuce' ? rightX : leftX, y: (COURT_BOUNDS.netY + topBaselineY) / 2 }
      }
    case 'receiver-partner':
      if (!isDoubles) return { x: centerX, y: centerX }
      if (serverIsBottom) {
        return { x: serveSide === 'deuce' ? leftX : rightX, y: (COURT_BOUNDS.netY + topBaselineY) / 2 }
      } else {
        return { x: serveSide === 'deuce' ? rightX : leftX, y: (COURT_BOUNDS.netY + bottomBaselineY) / 2 }
      }
    default:
      return { x: centerX, y: centerX }
  }
}

/**
 * Clamp coordinates to court bounds
 */
export const clampToCourtBounds = (x: number, y: number): { x: number; y: number } => {
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y))
  }
}

/**
 * Convert touch coordinates to court percentage
 */
export const touchToCourtPercent = (
  touchX: number,
  touchY: number,
  courtWidth: number,
  courtHeight: number
): { x: number; y: number } => {
  return {
    x: (touchX / courtWidth) * 100,
    y: (touchY / courtHeight) * 100
  }
}

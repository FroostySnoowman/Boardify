import { hapticLight } from '../../../utils/haptics'
import type { CompletedSet } from '../../../api/matches'

export const hapticImpactLight = hapticLight

export function computeSetStreaks(
  sets: CompletedSet[],
  p1Ids: string[],
  p2Ids: string[],
): { p1: number; p2: number } {
  let p1Best = 0, p2Best = 0, p1Cur = 0, p2Cur = 0;
  for (const set of sets) {
    const p1Games = p1Ids.reduce((sum, id) => sum + (set.games[id] || 0), 0);
    const p2Games = p2Ids.reduce((sum, id) => sum + (set.games[id] || 0), 0);
    if (p1Games > p2Games) {
      p1Cur += 1; p2Cur = 0;
      if (p1Cur > p1Best) p1Best = p1Cur;
    } else if (p2Games > p1Games) {
      p2Cur += 1; p1Cur = 0;
      if (p2Cur > p2Best) p2Best = p2Cur;
    }
  }
  return { p1: p1Best, p2: p2Best };
}

export const getPlayerDisplayName = (name: string, isDoubles: boolean): string => {
  if (!name) return ''

  const nameParts = name.trim().split(' ')
  const lastName = nameParts[nameParts.length - 1]

  if (isDoubles) {
    return lastName.substring(0, 3).toUpperCase()
  }

  return name
}

export const formatPercent = (numerator: number, denominator: number): string => {
  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) {
    return '-'
  }
  return `${Math.round((numerator / denominator) * 100)}%`
}

export const formatFraction = (numerator: number, denominator: number): string => {
  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) {
    return '-'
  }
  return `${numerator}/${denominator}`
}

export const formatFractionAndPercent = (numerator: number, denominator: number): string => {
  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) {
    return '-'
  }
  const fraction = `${numerator}/${denominator}`
  const percentage = `(${Math.round((numerator / denominator) * 100)}%)`
  return `${fraction} ${percentage}`
}


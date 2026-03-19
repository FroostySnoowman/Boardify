import { Match } from '../../../api/matches'

export type Player = 'p1' | 'p2'

export interface SetScore {
  mainScore: number
  tiebreakScore?: number
}

export interface ScorecardProps {
  title: string
  status: string
  time?: string
  /** When true, shows LIVE badge (green dot + "LIVE") in header */
  isLive?: boolean
  player1Names: string[]
  player1Sets: (number | SetScore)[]
  player2Names: string[]
  player2Sets: (number | SetScore)[]
  serverName?: string
  player1Serving?: boolean
  player2Serving?: boolean
  player1IsWinner?: boolean
  player2IsWinner?: boolean
  player1GameScore?: number | string
  player2GameScore?: number | string
}

export interface ServerSelectionDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (serverId: string) => void
  match: Match
  team: 'all' | 'your' | 'opp'
}


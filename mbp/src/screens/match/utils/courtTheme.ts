export interface CourtTheme {
  player: {
    your: string
    opponent: string
    server: string
  }
  ball: {
    serveIn: string
    serveInBorder: string
    serveOut: string
    serveOutBorder: string
    rallyIn: string
    rallyInBorder: string
    rallyOut: string
    rallyOutBorder: string
    outcome: string
    outcomeBorder: string
    servePulseIn: string
    servePulseOut: string
  }
  serviceBox: {
    border: string
    background: string
    shadow: string
  }
  rally: {
    border: string
    background: string
  }
}

const hard1Theme: CourtTheme = {
  player: {
    your: '#f59e0b',
    opponent: '#ec4899',
    server: '#fbbf24',
  },
  ball: {
    serveIn: '#22c55e',
    serveInBorder: '#86efac',
    serveOut: '#ef4444',
    serveOutBorder: '#fca5a5',
    rallyIn: '#8b5cf6',
    rallyInBorder: '#c4b5fd',
    rallyOut: '#f97316',
    rallyOutBorder: '#fdba74',
    outcome: '#a855f7',
    outcomeBorder: '#d8b4fe',
    servePulseIn: '#22c55e',
    servePulseOut: '#ef4444',
  },
  serviceBox: {
    border: '#22c55e',
    background: 'rgba(34, 197, 94, 0.3)',
    shadow: '#22c55e',
  },
  rally: {
    border: '#a78bfa',
    background: 'rgba(167, 139, 250, 0.1)',
  },
}

const hard2Theme: CourtTheme = {
  player: {
    your: '#34d399',
    opponent: '#fb923c',
    server: '#fbbf24',
  },
  ball: {
    serveIn: '#2dd4bf',
    serveInBorder: '#99f6e4',
    serveOut: '#f87171',
    serveOutBorder: '#fecaca',
    rallyIn: '#c084fc',
    rallyInBorder: '#e9d5ff',
    rallyOut: '#fb923c',
    rallyOutBorder: '#fed7aa',
    outcome: '#e879f9',
    outcomeBorder: '#f5d0fe',
    servePulseIn: '#2dd4bf',
    servePulseOut: '#f87171',
  },
  serviceBox: {
    border: '#2dd4bf',
    background: 'rgba(45, 212, 191, 0.3)',
    shadow: '#2dd4bf',
  },
  rally: {
    border: '#c084fc',
    background: 'rgba(192, 132, 252, 0.1)',
  },
}

const clayTheme: CourtTheme = {
  player: {
    your: '#3b82f6',
    opponent: '#10b981',
    server: '#fbbf24',
  },
  ball: {
    serveIn: '#06b6d4',
    serveInBorder: '#67e8f9',
    serveOut: '#ef4444',
    serveOutBorder: '#fca5a5',
    rallyIn: '#8b5cf6',
    rallyInBorder: '#c4b5fd',
    rallyOut: '#f59e0b',
    rallyOutBorder: '#fcd34d',
    outcome: '#a855f7',
    outcomeBorder: '#d8b4fe',
    servePulseIn: '#06b6d4',
    servePulseOut: '#ef4444',
  },
  serviceBox: {
    border: '#06b6d4',
    background: 'rgba(6, 182, 212, 0.3)',
    shadow: '#06b6d4',
  },
  rally: {
    border: '#8b5cf6',
    background: 'rgba(139, 92, 246, 0.1)',
  },
}

const grassTheme: CourtTheme = {
  player: {
    your: '#f43f5e',
    opponent: '#f59e0b',
    server: '#fbbf24',
  },
  ball: {
    serveIn: '#ec4899',
    serveInBorder: '#f9a8d4',
    serveOut: '#ef4444',
    serveOutBorder: '#fca5a5',
    rallyIn: '#f59e0b',
    rallyInBorder: '#fcd34d',
    rallyOut: '#ef4444',
    rallyOutBorder: '#fca5a5',
    outcome: '#f472b6',
    outcomeBorder: '#fbcfe8',
    servePulseIn: '#ec4899',
    servePulseOut: '#ef4444',
  },
  serviceBox: {
    border: '#ec4899',
    background: 'rgba(236, 72, 153, 0.3)',
    shadow: '#ec4899',
  },
  rally: {
    border: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.1)',
  },
}

const themes: Record<string, CourtTheme> = {
  hard_1: hard1Theme,
  hard_2: hard2Theme,
  clay_court: clayTheme,
  grass_court: grassTheme,
}

export function getCourtTheme(courtStyle: string): CourtTheme {
  return themes[courtStyle] || hard1Theme
}

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow'

export interface Position {
  row: number
  col: number
}

export interface Player {
  id: string
  color: PlayerColor
  name: string
  isAI: boolean
}

export interface Piece {
  id: string
  playerId: string
  color: PlayerColor
  position: Position | null  // null = off-board (home)
  pathIndex: number          // -1 = home, 0+ = position on path
  isFinished: boolean
}

export interface Card {
  id: string
  value: number  // 1-6
}

export interface PlayerHand {
  playerId: string
  cards: Card[]
  deck: Card[]
  discard: Card[]
}

export interface LogEntry {
  id: string
  playerName: string
  playerColor: PlayerColor
  action: 'moved' | 'entered' | 'captured' | 'finished' | 'skipped' | 'refreshed'
  cardValue?: number
  targetPlayer?: string
}

export interface GameState {
  players: Player[]
  pieces: Piece[]
  hands: PlayerHand[]
  currentPlayerId: string
  phase: 'select_card' | 'select_action' | 'game_over'
  selectedCard: Card | null
  winner: string | null
  log: LogEntry[]
  isHotseat: boolean
  turnReady: boolean
}

export type GameAction =
  | { type: 'SELECT_CARD'; cardId: string }
  | { type: 'UNSELECT_CARD' }
  | { type: 'MOVE_PIECE'; pieceId: string }
  | { type: 'ENTER_PIECE'; pieceId: string }
  | { type: 'END_TURN' }
  | { type: 'START_TURN' }
  | { type: 'REFRESH_HAND' }
  | { type: 'RESET_GAME'; playerCount: number; humanColor: PlayerColor; isHotseat: boolean }

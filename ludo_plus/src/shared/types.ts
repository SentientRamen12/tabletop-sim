export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow'

// V2: Piece type system
export type SupportType = 'escort' | 'blocker' | 'assassin' | 'pusher'
export type PieceKind = 'hero' | 'support'

export const ALL_SUPPORT_TYPES: SupportType[] = ['escort', 'blocker', 'assassin', 'pusher']
export const MAX_SUPPORTS_ON_FIELD = 3

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
  // V2: piece differentiation
  kind: PieceKind
  supportType?: SupportType  // only for kind='support'
}

// V2: Support roster tracking per player
export interface SupportRoster {
  playerId: string
  available: SupportType[]   // supports that can be summoned
  onField: string[]          // piece IDs currently deployed (max 3)
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
  action: 'moved' | 'entered' | 'captured' | 'finished' | 'skipped' | 'refreshed' | 'claimed' | 'stole'
        | 'summoned' | 'hero_reset' | 'support_removed' | 'ability_used' | 'intercepted'  // V2
  cardValue?: number
  targetPlayer?: string
  supportType?: SupportType  // V2: which support was involved
}

export type GamePhase =
  | 'select_card'
  | 'select_action'
  | 'select_summon'     // V2: choosing which support to deploy
  | 'select_push_target' // V2: targeting for Pusher ability
  | 'portal_choice'
  | 'game_over'

export interface GameState {
  players: Player[]
  pieces: Piece[]
  hands: PlayerHand[]
  supportRosters: SupportRoster[]  // V2: track available/deployed supports
  currentPlayerId: string
  phase: GamePhase
  selectedCard: Card | null
  winner: string | null
  log: LogEntry[]
  isHotseat: boolean
  turnReady: boolean
  claimedSummons: Partial<Record<PlayerColor, Position>>
  pendingPortal: Position | null  // summon position player can claim/update
  // V2: ability targeting
  selectedPieceForAbility: string | null  // piece using active ability (Pusher)
  pusherUsedThisTurn: boolean  // Pusher ability is free but once per turn
}

export type GameAction =
  | { type: 'SELECT_CARD'; cardId: string }
  | { type: 'UNSELECT_CARD' }
  | { type: 'MOVE_PIECE'; pieceId: string }
  | { type: 'ENTER_PIECE'; pieceId: string; usePortal?: boolean }
  | { type: 'CLAIM_PORTAL' }        // Claim/update portal at pendingPortal position
  | { type: 'SKIP_PORTAL' }         // Skip claiming the pending portal
  | { type: 'STEAL_PORTAL'; position: Position }  // Claim portal when piece on it isn't portal's color
  | { type: 'END_TURN' }
  | { type: 'START_TURN' }
  | { type: 'REFRESH_HAND' }
  | { type: 'RESET_GAME'; playerCount: number; humanColor: PlayerColor; isHotseat: boolean }
  // V2: Support actions
  | { type: 'SUMMON_SUPPORT'; supportType: SupportType; usePortal?: boolean }
  | { type: 'ACTIVATE_PUSHER'; pieceId: string }  // enter push targeting mode
  | { type: 'EXECUTE_PUSH'; targetPieceId: string }  // push the target
  | { type: 'CANCEL_ABILITY' }  // cancel ability targeting

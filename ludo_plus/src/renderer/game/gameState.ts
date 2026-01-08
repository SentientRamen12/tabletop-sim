import type { GameState, GameAction, Player, Piece, PlayerColor, LogEntry } from '../../shared/types'
import { createPlayerHand, playCard, drawCard, getCardById, refreshHand } from './deck'
import {
  ENTRY_POSITIONS,
  TOTAL_PATH_LENGTH,
  isSafePosition,
  isSummonPosition,
  positionsEqual,
  getPositionForPlayer,
  PLAYER_PATHS
} from './board'

const ALL_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']
const PIECES_PER_PLAYER = 4
const MAX_PIECES_PER_CELL = 2

/**
 * Calculate move result - pieces can pass through others, only check at final landing spot.
 * Returns the final pathIndex and any piece that would be captured.
 */
function calculateMove(
  pieces: Piece[],
  movingPiece: Piece,
  color: PlayerColor,
  steps: number
): { finalIndex: number; capturedPieceId: string | null; blocked: boolean } {
  const centerIndex = TOTAL_PATH_LENGTH - 1
  const startIndex = movingPiece.pathIndex
  const targetIndex = Math.min(startIndex + steps, centerIndex)

  // Can't overshoot center
  if (startIndex + steps > centerIndex) {
    return { finalIndex: startIndex, capturedPieceId: null, blocked: true }
  }

  const targetPos = getPositionForPlayer(color, targetIndex)
  if (!targetPos) {
    return { finalIndex: startIndex, capturedPieceId: null, blocked: true }
  }

  // Check pieces at target position
  const piecesAtTarget = pieces.filter(
    p => p.id !== movingPiece.id && p.position && positionsEqual(p.position, targetPos) && !p.isFinished
  )

  // Max pieces per cell check
  if (piecesAtTarget.length >= MAX_PIECES_PER_CELL) {
    return { finalIndex: startIndex, capturedPieceId: null, blocked: true }
  }

  if (piecesAtTarget.length > 0) {
    const pieceAtTarget = piecesAtTarget[0]
    const isOwnPiece = pieceAtTarget.playerId === movingPiece.playerId
    if (isOwnPiece || isSafePosition(targetPos)) {
      // Blocked: can't land here
      return { finalIndex: startIndex, capturedPieceId: null, blocked: true }
    }
    // Capture opponent
    return { finalIndex: targetIndex, capturedPieceId: pieceAtTarget.id, blocked: false }
  }

  // Target is empty
  return { finalIndex: targetIndex, capturedPieceId: null, blocked: false }
}

export function createInitialState(playerCount: number = 4, humanColor: PlayerColor = 'red', isHotseat: boolean = false): GameState {
  // Reorder colors so human's choice is first
  const otherColors = ALL_COLORS.filter(c => c !== humanColor)
  const colors = [humanColor, ...otherColors].slice(0, playerCount)

  const colorNames: Record<PlayerColor, string> = {
    red: 'Red',
    blue: 'Blue',
    green: 'Green',
    yellow: 'Yellow'
  }

  const players: Player[] = colors.map((color, idx) => ({
    id: `player-${idx}`,
    color,
    name: isHotseat ? colorNames[color] : (idx === 0 ? 'You' : `CPU ${idx}`),
    isAI: isHotseat ? false : idx > 0
  }))

  const pieces: Piece[] = []
  players.forEach(player => {
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      pieces.push({
        id: `${player.id}-piece-${i}`,
        playerId: player.id,
        color: player.color,
        position: null,
        pathIndex: -1,
        isFinished: false
      })
    }
  })

  const hands = players.map(p => createPlayerHand(p.id))

  return {
    players,
    pieces,
    hands,
    currentPlayerId: players[0].id,
    phase: 'select_card',
    selectedCard: null,
    winner: null,
    log: [],
    isHotseat,
    turnReady: !isHotseat, // In hotseat mode, first player must click to start
    claimedSummons: {},
    pendingPortal: null
  }
}

let logIdCounter = 0
function createLogEntry(
  player: Player,
  action: LogEntry['action'],
  cardValue?: number,
  targetPlayer?: string
): LogEntry {
  return {
    id: `log-${++logIdCounter}`,
    playerName: player.name,
    playerColor: player.color,
    action,
    cardValue,
    targetPlayer
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_CARD': {
      const hand = state.hands.find(h => h.playerId === state.currentPlayerId)
      if (!hand) return state

      const card = getCardById(hand, action.cardId)
      if (!card) return state

      return {
        ...state,
        selectedCard: card,
        phase: 'select_action'
      }
    }

    case 'UNSELECT_CARD': {
      if (state.phase !== 'select_action') return state

      return {
        ...state,
        selectedCard: null,
        phase: 'select_card'
      }
    }

    case 'ENTER_PIECE': {
      if (!state.selectedCard) return state

      const piece = state.pieces.find(p => p.id === action.pieceId)
      if (!piece || piece.playerId !== state.currentPlayerId) return state
      if (piece.position !== null) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const defaultEntryPos = ENTRY_POSITIONS[player.color]
      const claimedSummonPos = state.claimedSummons[player.color]

      // Determine which entry to use based on usePortal flag
      let entryPos: typeof defaultEntryPos
      let pathIndex: number

      if (action.usePortal && claimedSummonPos) {
        // Use portal (claimed summon point) - blocked by ANY piece
        const piecesAtSummon = state.pieces.filter(
          p => p.position && positionsEqual(p.position, claimedSummonPos) && !p.isFinished
        )
        if (piecesAtSummon.length > 0) {
          return state // Portal blocked
        }
        const summonPathIndex = PLAYER_PATHS[player.color].findIndex(
          pos => positionsEqual(pos, claimedSummonPos)
        )
        if (summonPathIndex < 0) return state
        entryPos = claimedSummonPos
        pathIndex = summonPathIndex
      } else {
        // Use default start entry
        const piecesAtEntry = state.pieces.filter(
          p => p.position && positionsEqual(p.position, defaultEntryPos) && !p.isFinished
        )
        // Blocked if at max capacity OR opponent present
        if (piecesAtEntry.length >= MAX_PIECES_PER_CELL) {
          return state // Entry at max capacity
        }
        if (piecesAtEntry.some(p => p.playerId !== state.currentPlayerId)) {
          return state // Start blocked by opponent
        }
        entryPos = defaultEntryPos
        pathIndex = 0
      }

      const newPieces = state.pieces.map(p =>
        p.id === piece.id
          ? { ...p, position: entryPos, pathIndex }
          : p
      )

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      const logEntry = createLogEntry(player, 'entered', state.selectedCard.value)

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        selectedCard: null,
        log: [...state.log, logEntry]
      })
    }

    case 'MOVE_PIECE': {
      if (!state.selectedCard) return state

      const piece = state.pieces.find(p => p.id === action.pieceId)
      if (!piece || piece.playerId !== state.currentPlayerId) return state
      if (piece.position === null || piece.isFinished) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const steps = state.selectedCard.value
      const { finalIndex, capturedPieceId, blocked } = calculateMove(state.pieces, piece, player.color, steps)

      // Blocked - can't move
      if (blocked) {
        return state
      }

      const centerIndex = TOTAL_PATH_LENGTH - 1
      const newPos = getPositionForPlayer(player.color, finalIndex)
      if (!newPos) return state

      const isFinishing = finalIndex === centerIndex

      // Handle capture
      let newPieces = [...state.pieces]
      let capturedPlayer: Player | undefined
      if (capturedPieceId) {
        const capturedPiece = newPieces.find(p => p.id === capturedPieceId)
        if (capturedPiece) {
          capturedPlayer = state.players.find(p => p.id === capturedPiece.playerId)
          newPieces = newPieces.map(p =>
            p.id === capturedPieceId
              ? { ...p, position: null, pathIndex: -1 }
              : p
          )
        }
      }

      newPieces = newPieces.map(p =>
        p.id === piece.id
          ? { ...p, position: newPos, pathIndex: finalIndex, isFinished: isFinishing }
          : p
      )

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      // Build log entries
      const newLog = [...state.log]
      if (isFinishing) {
        newLog.push(createLogEntry(player, 'finished', state.selectedCard.value))
      } else {
        newLog.push(createLogEntry(player, 'moved', state.selectedCard.value))
      }
      if (capturedPlayer) {
        newLog.push(createLogEntry(player, 'captured', undefined, capturedPlayer.name))
      }

      // Check if landing on unclaimed summon point
      let newClaimedSummons = state.claimedSummons
      let pendingPortal: typeof state.pendingPortal = null
      
      if (!isFinishing && isSummonPosition(newPos)) {
        const alreadyClaimed = Object.values(state.claimedSummons).some(
          pos => pos && positionsEqual(pos, newPos)
        )
        if (!alreadyClaimed) {
          if (!state.claimedSummons[player.color]) {
            // No existing portal - auto claim
            newClaimedSummons = { ...state.claimedSummons, [player.color]: newPos }
            newLog.push(createLogEntry(player, 'claimed'))
          } else {
            // Has existing portal - enter portal_choice phase
            pendingPortal = newPos
          }
        }
      }

      const playerPieces = newPieces.filter(p => p.playerId === state.currentPlayerId)
      const allFinished = playerPieces.every(p => p.isFinished)

      if (allFinished) {
        return {
          ...state,
          pieces: newPieces,
          hands: newHands,
          selectedCard: null,
          phase: 'game_over',
          winner: state.currentPlayerId,
          log: newLog,
          claimedSummons: newClaimedSummons,
          pendingPortal: null
        }
      }

      // If there's a pending portal choice, go to portal_choice phase
      if (pendingPortal) {
        return {
          ...state,
          pieces: newPieces,
          hands: newHands,
          selectedCard: null,
          log: newLog,
          claimedSummons: newClaimedSummons,
          phase: 'portal_choice',
          pendingPortal
        }
      }

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        selectedCard: null,
        log: newLog,
        claimedSummons: newClaimedSummons,
        pendingPortal: null
      })
    }

    case 'END_TURN': {
      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (player && state.phase === 'select_action') {
        const logEntry = createLogEntry(player, 'skipped')
        return endTurn({
          ...state,
          log: [...state.log, logEntry]
        })
      }
      return endTurn(state)
    }

    case 'START_TURN': {
      if (state.turnReady) return state
      return {
        ...state,
        turnReady: true
      }
    }

    case 'REFRESH_HAND': {
      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)
      if (!hand) return state

      hand = refreshHand(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      const logEntry = createLogEntry(player, 'refreshed')

      return endTurn({
        ...state,
        hands: newHands,
        selectedCard: null,
        log: [...state.log, logEntry]
      })
    }

    case 'CLAIM_PORTAL': {
      if (state.phase !== 'portal_choice' || !state.pendingPortal) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const newClaimedSummons = { ...state.claimedSummons, [player.color]: state.pendingPortal }
      const newLog = [...state.log, createLogEntry(player, 'claimed')]

      return endTurn({
        ...state,
        claimedSummons: newClaimedSummons,
        pendingPortal: null,
        log: newLog
      })
    }

    case 'SKIP_PORTAL': {
      if (state.phase !== 'portal_choice') return state

      return endTurn({
        ...state,
        pendingPortal: null
      })
    }

    case 'STEAL_PORTAL': {
      if (state.phase !== 'select_action') return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      // Find who owns this portal - must be a claimed portal
      let previousOwner: PlayerColor | null = null
      for (const [color, pos] of Object.entries(state.claimedSummons)) {
        if (pos && positionsEqual(pos, action.position)) {
          previousOwner = color as PlayerColor
          break
        }
      }
      if (!previousOwner || previousOwner === player.color) return state

      // Check if a piece is on the portal and piece color ≠ portal color
      const pieceAtPos = state.pieces.find(
        p => p.position && positionsEqual(p.position, action.position) && !p.isFinished
      )
      if (!pieceAtPos || pieceAtPos.color === previousOwner) return state

      // Update claimed summons: remove previous owner's claim, add current player's
      const newClaimedSummons = { ...state.claimedSummons }
      delete newClaimedSummons[previousOwner]
      newClaimedSummons[player.color] = action.position

      const targetPlayer = state.players.find(p => p.color === previousOwner)?.name
      const newLog = [...state.log, createLogEntry(player, 'stole', undefined, targetPlayer)]

      return endTurn({
        ...state,
        claimedSummons: newClaimedSummons,
        selectedCard: null,
        log: newLog,
        pendingPortal: null
      })
    }

    case 'RESET_GAME': {
      return createInitialState(action.playerCount, action.humanColor, action.isHotseat)
    }

    default:
      return state
  }
}

function endTurn(state: GameState): GameState {
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayerId)
  const nextIndex = (currentIndex + 1) % state.players.length
  const nextPlayer = state.players[nextIndex]

  // In hotseat mode, human players need to click to start their turn
  const turnReady = state.isHotseat ? nextPlayer.isAI : true

  return {
    ...state,
    currentPlayerId: nextPlayer.id,
    phase: 'select_card',
    selectedCard: null,
    turnReady,
    pendingPortal: null
  }
}

export function getValidMoves(state: GameState, pieceId: string): { 
  canMove: boolean
  canEnterStart: boolean
  canEnterPortal: boolean 
} {
  if (!state.selectedCard) return { canMove: false, canEnterStart: false, canEnterPortal: false }

  const piece = state.pieces.find(p => p.id === pieceId)
  if (!piece || piece.playerId !== state.currentPlayerId || piece.isFinished) {
    return { canMove: false, canEnterStart: false, canEnterPortal: false }
  }

  const player = state.players.find(p => p.id === state.currentPlayerId)
  if (!player) return { canMove: false, canEnterStart: false, canEnterPortal: false }

  const steps = state.selectedCard.value

  if (piece.position === null) {
    // Check default entry
    const defaultEntryPos = ENTRY_POSITIONS[player.color]
    const piecesAtDefaultEntry = state.pieces.filter(
      p => p.position && positionsEqual(p.position, defaultEntryPos) && !p.isFinished
    )
    // Can enter if: not at max AND no opponent blocking
    const canEnterStart = piecesAtDefaultEntry.length < MAX_PIECES_PER_CELL && 
                          !piecesAtDefaultEntry.some(p => p.playerId !== state.currentPlayerId)

    // Check claimed summon point (portal) - blocked by ANY piece
    const claimedSummonPos = state.claimedSummons[player.color]
    let canEnterPortal = false
    if (claimedSummonPos) {
      const piecesAtSummon = state.pieces.filter(
        p => p.position && positionsEqual(p.position, claimedSummonPos) && !p.isFinished
      )
      canEnterPortal = piecesAtSummon.length === 0
    }

    return { canMove: false, canEnterStart, canEnterPortal }
  }

  // Check if piece can move (not blocked)
  const { blocked } = calculateMove(state.pieces, piece, player.color, steps)

  return { canMove: !blocked, canEnterStart: false, canEnterPortal: false }
}

/**
 * Get positions where player can claim a portal (piece on portal but piece color ≠ portal color)
 */
export function getStealablePortals(state: GameState): { position: Position; ownerColor: PlayerColor }[] {
  if (state.phase !== 'select_action') return []
  
  const player = state.players.find(p => p.id === state.currentPlayerId)
  if (!player) return []

  const stealable: { position: Position; ownerColor: PlayerColor }[] = []

  // Check each claimed portal
  for (const [ownerColor, portalPos] of Object.entries(state.claimedSummons)) {
    if (!portalPos) continue
    if (ownerColor === player.color) continue // Already our portal

    // Check if ANY piece is on this portal and piece color ≠ portal color
    const pieceOnPortal = state.pieces.find(
      p => p.position && 
           positionsEqual(p.position, portalPos) && 
           !p.isFinished &&
           p.color !== ownerColor  // Piece color different from portal color
    )

    if (pieceOnPortal) {
      stealable.push({ position: portalPos, ownerColor: ownerColor as PlayerColor })
    }
  }

  return stealable
}

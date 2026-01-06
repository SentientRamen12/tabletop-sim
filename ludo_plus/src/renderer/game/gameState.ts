import type { GameState, GameAction, Player, Piece, PlayerColor } from '../../shared/types'
import { createPlayerHand, playCard, drawCard, getCardById } from './deck'
import {
  ENTRY_POSITIONS,
  TOTAL_PATH_LENGTH,
  MAX_PIECES_PER_CELL,
  isSafePosition,
  isColoredSafe,
  positionsEqual,
  getPositionForPlayer
} from './board'

const ALL_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']
const PIECES_PER_PLAYER = 4

export function createInitialState(playerCount: number = 4, humanColor: PlayerColor = 'red'): GameState {
  // Reorder colors so human's choice is first
  const otherColors = ALL_COLORS.filter(c => c !== humanColor)
  const colors = [humanColor, ...otherColors].slice(0, playerCount)

  const players: Player[] = colors.map((color, idx) => ({
    id: `player-${idx}`,
    color,
    name: idx === 0 ? 'You' : `CPU ${idx}`,
    isAI: idx > 0
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
    winner: null
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

    case 'ENTER_PIECE': {
      if (!state.selectedCard) return state

      const piece = state.pieces.find(p => p.id === action.pieceId)
      if (!piece || piece.playerId !== state.currentPlayerId) return state
      if (piece.position !== null) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const entryPos = ENTRY_POSITIONS[player.color]

      // Check if entry blocked by opponent
      const pieceAtEntry = state.pieces.find(
        p => p.position && positionsEqual(p.position, entryPos) && !p.isFinished
      )
      if (pieceAtEntry && pieceAtEntry.playerId !== state.currentPlayerId) {
        return state
      }

      // Enter at path index 0 (entry position)
      const newPieces = state.pieces.map(p =>
        p.id === piece.id
          ? { ...p, position: entryPos, pathIndex: 0 }
          : p
      )

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        selectedCard: null
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
      const newPathIndex = piece.pathIndex + steps
      const centerIndex = TOTAL_PATH_LENGTH - 1

      if (newPathIndex > centerIndex) {
        return state // Overshoot
      }

      const newPos = getPositionForPlayer(player.color, newPathIndex)
      if (!newPos) return state

      const isFinishing = newPathIndex === centerIndex

      // Check pieces at target
      let newPieces = [...state.pieces]
      const piecesAtTarget = newPieces.filter(
        p => p.position && positionsEqual(p.position, newPos) && !p.isFinished
      )
      const opponentPieces = piecesAtTarget.filter(p => p.playerId !== state.currentPlayerId)

      // Max 2 pieces per cell (any color)
      if (piecesAtTarget.length >= MAX_PIECES_PER_CELL) {
        return state
      }

      // Handle opponent interaction
      if (!isFinishing && opponentPieces.length > 0) {
        const isSafe = isSafePosition(newPos)
        const opponentOnColoredSafe = opponentPieces.some(p => isColoredSafe(newPos, p.color))

        if (isSafe || opponentOnColoredSafe) {
          // Safe spot: coexist (no capture), already checked 2-piece limit above
        } else {
          // Not safe: capture the opponent
          newPieces = newPieces.map(p =>
            p.id === opponentPieces[0].id
              ? { ...p, position: null, pathIndex: -1 }
              : p
          )
        }
      }

      newPieces = newPieces.map(p =>
        p.id === piece.id
          ? { ...p, position: newPos, pathIndex: newPathIndex, isFinished: isFinishing }
          : p
      )

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      const playerPieces = newPieces.filter(p => p.playerId === state.currentPlayerId)
      const allFinished = playerPieces.every(p => p.isFinished)

      if (allFinished) {
        return {
          ...state,
          pieces: newPieces,
          hands: newHands,
          selectedCard: null,
          phase: 'game_over',
          winner: state.currentPlayerId
        }
      }

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        selectedCard: null
      })
    }

    case 'END_TURN': {
      return endTurn(state)
    }

    case 'RESET_GAME': {
      return createInitialState(action.playerCount, action.humanColor)
    }

    default:
      return state
  }
}

function endTurn(state: GameState): GameState {
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayerId)
  const nextIndex = (currentIndex + 1) % state.players.length
  const nextPlayer = state.players[nextIndex]

  return {
    ...state,
    currentPlayerId: nextPlayer.id,
    phase: 'select_card',
    selectedCard: null
  }
}

export function getValidMoves(state: GameState, pieceId: string): { canMove: boolean; canEnter: boolean } {
  if (!state.selectedCard) return { canMove: false, canEnter: false }

  const piece = state.pieces.find(p => p.id === pieceId)
  if (!piece || piece.playerId !== state.currentPlayerId || piece.isFinished) {
    return { canMove: false, canEnter: false }
  }

  const player = state.players.find(p => p.id === state.currentPlayerId)
  if (!player) return { canMove: false, canEnter: false }

  const steps = state.selectedCard.value

  if (piece.position === null) {
    const entryPos = ENTRY_POSITIONS[player.color]
    const pieceAtEntry = state.pieces.find(
      p => p.position && positionsEqual(p.position, entryPos) && p.playerId !== state.currentPlayerId
    )
    return { canMove: false, canEnter: !pieceAtEntry }
  }

  const newPathIndex = piece.pathIndex + steps
  const centerIndex = TOTAL_PATH_LENGTH - 1

  if (newPathIndex > centerIndex) {
    return { canMove: false, canEnter: false }
  }

  const newPos = getPositionForPlayer(player.color, newPathIndex)
  if (!newPos) return { canMove: false, canEnter: false }

  const piecesAtTarget = state.pieces.filter(
    p => p.position && positionsEqual(p.position, newPos) && !p.isFinished
  )

  // Max 2 pieces per cell (any color)
  if (piecesAtTarget.length >= MAX_PIECES_PER_CELL) {
    return { canMove: false, canEnter: false }
  }

  return { canMove: true, canEnter: false }
}

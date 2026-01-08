import type { GameState, GameAction } from '../../shared/types'
import { getValidMoves } from '../game/gameState'

/**
 * Simple AI strategy: picks first valid action
 * Priority: move existing pieces > enter new pieces > refresh hand
 */
export function getAIAction(state: GameState): GameAction | null {
  const hand = state.hands.find(h => h.playerId === state.currentPlayerId)
  if (!hand || hand.cards.length === 0) {
    return { type: 'REFRESH_HAND' }
  }

  if (state.phase === 'select_card') {
    // Select first card
    return { type: 'SELECT_CARD', cardId: hand.cards[0].id }
  }

  if (state.phase === 'select_action' && state.selectedCard) {
    const myPieces = state.pieces.filter(
      p => p.playerId === state.currentPlayerId && !p.isFinished
    )

    // Priority 1: Move pieces already on board
    for (const piece of myPieces) {
      if (piece.position !== null) {
        const { canMove } = getValidMoves(state, piece.id)
        if (canMove) {
          return { type: 'MOVE_PIECE', pieceId: piece.id }
        }
      }
    }

    // Priority 2: Enter a piece from home (prefer portal if available)
    for (const piece of myPieces) {
      if (piece.position === null) {
        const { canEnterStart, canEnterPortal } = getValidMoves(state, piece.id)
        if (canEnterPortal) {
          return { type: 'ENTER_PIECE', pieceId: piece.id, usePortal: true }
        }
        if (canEnterStart) {
          return { type: 'ENTER_PIECE', pieceId: piece.id, usePortal: false }
        }
      }
    }

    // No valid moves: refresh hand
    return { type: 'REFRESH_HAND' }
  }

  return null
}

/**
 * AI delay in milliseconds
 */
export const AI_TURN_DELAY = 600


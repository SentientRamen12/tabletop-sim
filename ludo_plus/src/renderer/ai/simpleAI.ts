import type { GameState, GameAction, SupportType } from '../../shared/types'
import { ALL_SUPPORT_TYPES, MAX_SUPPORTS_ON_FIELD } from '../../shared/types'
import { getValidMoves, canSummonSupport, getPushTargets } from '../game/gameState'
import { areAdjacent } from '../game/board'

/**
 * V2 AI Strategy: Hero-first approach
 * Priority:
 * 0. Use Pusher ability FIRST (FREE, no card required, once per turn)
 * 1. Move hero toward center (hero is ALWAYS on board)
 * 2. Move Escort to stay adjacent to hero
 * 3. Summon supports when beneficial
 * 4. Move Assassin aggressively
 * 5. Move other supports
 * 6. Refresh hand as fallback
 */
export function getAIAction(state: GameState): GameAction | null {
  const hand = state.hands.find(h => h.playerId === state.currentPlayerId)
  if (!hand || hand.cards.length === 0) {
    return { type: 'REFRESH_HAND' }
  }

  // Pusher ability can be used during select_card OR select_action (FREE, no card needed)
  // Try to use it first if available
  if ((state.phase === 'select_card' || state.phase === 'select_action') && !state.pusherUsedThisTurn) {
    const myPieces = state.pieces.filter(
      p => p.playerId === state.currentPlayerId && !p.isFinished
    )
    const hero = myPieces.find(p => p.kind === 'hero')
    const supports = myPieces.filter(p => p.kind === 'support')
    const pusher = supports.find(s => s.supportType === 'pusher' && s.position)
    
    if (pusher && hero?.position) {
      const pushTargets = getPushTargets(state, pusher.id)
      // Push enemy pieces that are near hero
      const enemyNearHero = pushTargets.find(target =>
        target.playerId !== state.currentPlayerId &&
        areAdjacent(target.position!, hero.position!)
      )
      if (enemyNearHero) {
        return { type: 'ACTIVATE_PUSHER', pieceId: pusher.id }
      }
      // Also push any enemy if pusher is adjacent
      const anyEnemy = pushTargets.find(target => target.playerId !== state.currentPlayerId)
      if (anyEnemy) {
        return { type: 'ACTIVATE_PUSHER', pieceId: pusher.id }
      }
    }
  }

  if (state.phase === 'select_card') {
    // Select card with highest value for hero priority
    const sortedCards = [...hand.cards].sort((a, b) => b.value - a.value)
    return { type: 'SELECT_CARD', cardId: sortedCards[0].id }
  }

  if (state.phase === 'select_action' && state.selectedCard) {
    const myPieces = state.pieces.filter(
      p => p.playerId === state.currentPlayerId && !p.isFinished
    )

    const hero = myPieces.find(p => p.kind === 'hero')
    const supports = myPieces.filter(p => p.kind === 'support')
    const roster = state.supportRosters.find(r => r.playerId === state.currentPlayerId)

    // Priority 1: Move hero (hero is ALWAYS on board)
    if (hero) {
      const { canMove } = getValidMoves(state, hero.id)
      if (canMove) {
        return { type: 'MOVE_PIECE', pieceId: hero.id }
      }
    }

    // Priority 2: Move Escort to stay adjacent to hero
    const escort = supports.find(s => s.supportType === 'escort' && s.position)
    if (escort?.position && hero?.position) {
      if (!areAdjacent(escort.position, hero.position)) {
        const { canMove } = getValidMoves(state, escort.id)
        if (canMove) {
          return { type: 'MOVE_PIECE', pieceId: escort.id }
        }
      }
    }

    // Priority 3: Summon supports if beneficial
    if (roster && roster.onField.length < MAX_SUPPORTS_ON_FIELD) {
      // Prefer Escort if hero is on board and no escort deployed
      if (hero?.position && roster.available.includes('escort')) {
        const { canSummon } = canSummonSupport(state, 'escort')
        if (canSummon) {
          return { type: 'SUMMON_SUPPORT', supportType: 'escort', usePortal: false }
        }
      }

      // Summon Blocker for defense
      if (roster.available.includes('blocker')) {
        const { canSummon, canUsePortal } = canSummonSupport(state, 'blocker')
        if (canSummon) {
          return { type: 'SUMMON_SUPPORT', supportType: 'blocker', usePortal: canUsePortal }
        }
      }

      // Summon Pusher for utility
      if (roster.available.includes('pusher')) {
        const { canSummon, canUsePortal } = canSummonSupport(state, 'pusher')
        if (canSummon) {
          return { type: 'SUMMON_SUPPORT', supportType: 'pusher', usePortal: canUsePortal }
        }
      }

      // Summon Assassin for offense
      if (roster.available.includes('assassin')) {
        const { canSummon, canUsePortal } = canSummonSupport(state, 'assassin')
        if (canSummon) {
          return { type: 'SUMMON_SUPPORT', supportType: 'assassin', usePortal: canUsePortal }
        }
      }
    }

    // Priority 4: Move Assassin aggressively
    const assassin = supports.find(s => s.supportType === 'assassin' && s.position)
    if (assassin) {
      const { canMove } = getValidMoves(state, assassin.id)
      if (canMove) {
        return { type: 'MOVE_PIECE', pieceId: assassin.id }
      }
    }

    // Priority 5: Move any other support
    for (const support of supports) {
      if (support.position) {
        const { canMove } = getValidMoves(state, support.id)
        if (canMove) {
          return { type: 'MOVE_PIECE', pieceId: support.id }
        }
      }
    }

    // Priority 6: Refresh hand as fallback
    return { type: 'REFRESH_HAND' }
  }

  // Handle push target selection (AI should auto-push first valid target)
  if (state.phase === 'select_push_target' && state.selectedPieceForAbility) {
    const pushTargets = getPushTargets(state, state.selectedPieceForAbility)
    if (pushTargets.length > 0) {
      // Prefer pushing enemies
      const enemyTarget = pushTargets.find(p => p.playerId !== state.currentPlayerId)
      if (enemyTarget) {
        return { type: 'EXECUTE_PUSH', targetPieceId: enemyTarget.id }
      }
      // Otherwise push first available
      return { type: 'EXECUTE_PUSH', targetPieceId: pushTargets[0].id }
    }
    // No valid targets, cancel
    return { type: 'CANCEL_ABILITY' }
  }

  return null
}

/**
 * AI delay in milliseconds
 */
export const AI_TURN_DELAY = 600

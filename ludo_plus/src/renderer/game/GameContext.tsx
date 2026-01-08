import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react'
import type { GameState, Card, PlayerColor, Position, SupportType, Piece } from '../../shared/types'
import {
  gameReducer,
  createInitialState,
  getValidMoves,
  getStealablePortals,
  canSummonSupport,
  getPushTargets,
  getEffectiveMoveDistance,
  getCurrentRoster
} from './gameState'
import { getAIAction, AI_TURN_DELAY } from '../ai/simpleAI'

interface GameContextType {
  state: GameState
  selectCard: (cardId: string) => void
  unselectCard: () => void
  enterPiece: (pieceId: string, usePortal?: boolean) => void
  movePiece: (pieceId: string) => void
  claimPortal: () => void
  skipPortal: () => void
  stealPortal: (position: Position) => void
  refreshHand: () => void
  startTurn: () => void
  resetGame: (playerCount?: number, humanColor?: PlayerColor, isHotseat?: boolean) => void
  canEnterAtStart: (pieceId: string) => boolean
  canEnterAtPortal: (pieceId: string) => boolean
  canMovePiece: (pieceId: string) => boolean
  getCurrentPlayerHand: () => Card[]
  getStealablePortals: () => ReturnType<typeof getStealablePortals>
  // V2: Support actions
  summonSupport: (supportType: SupportType, usePortal?: boolean) => void
  activatePusher: (pieceId: string) => void
  executePush: (targetPieceId: string) => void
  cancelAbility: () => void
  canSummon: (supportType: SupportType) => { canSummon: boolean; canUsePortal: boolean }
  getPushTargets: (pieceId?: string) => Piece[]
  getEffectiveMoveDistance: (pieceId: string) => number
  getCurrentRoster: () => ReturnType<typeof getCurrentRoster>
}

const GameContext = createContext<GameContextType | null>(null)

interface GameProviderProps {
  children: ReactNode
  playerCount?: number
  humanColor?: PlayerColor
  isHotseat?: boolean
}

export function GameProvider({ children, playerCount = 4, humanColor = 'red', isHotseat = false }: GameProviderProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    { playerCount, humanColor, isHotseat },
    (init) => createInitialState(init.playerCount, init.humanColor, init.isHotseat)
  )

  const selectCard = useCallback((cardId: string) => {
    dispatch({ type: 'SELECT_CARD', cardId })
  }, [])

  const unselectCard = useCallback(() => {
    dispatch({ type: 'UNSELECT_CARD' })
  }, [])

  const enterPiece = useCallback((pieceId: string, usePortal?: boolean) => {
    dispatch({ type: 'ENTER_PIECE', pieceId, usePortal })
  }, [])

  const movePiece = useCallback((pieceId: string) => {
    dispatch({ type: 'MOVE_PIECE', pieceId })
  }, [])

  const claimPortal = useCallback(() => {
    dispatch({ type: 'CLAIM_PORTAL' })
  }, [])

  const skipPortal = useCallback(() => {
    dispatch({ type: 'SKIP_PORTAL' })
  }, [])

  const stealPortal = useCallback((position: Position) => {
    dispatch({ type: 'STEAL_PORTAL', position })
  }, [])

  const refreshHand = useCallback(() => {
    dispatch({ type: 'REFRESH_HAND' })
  }, [])

  const startTurn = useCallback(() => {
    dispatch({ type: 'START_TURN' })
  }, [])

  const resetGame = useCallback((count: number = 4, color: PlayerColor = 'red', hotseat: boolean = false) => {
    dispatch({ type: 'RESET_GAME', playerCount: count, humanColor: color, isHotseat: hotseat })
  }, [])

  const canEnterAtStart = useCallback((pieceId: string) => {
    return getValidMoves(state, pieceId).canEnterStart
  }, [state])

  const canEnterAtPortal = useCallback((pieceId: string) => {
    return getValidMoves(state, pieceId).canEnterPortal
  }, [state])

  const canMovePiece = useCallback((pieceId: string) => {
    return getValidMoves(state, pieceId).canMove
  }, [state])

  const getCurrentPlayerHand = useCallback(() => {
    const hand = state.hands.find(h => h.playerId === state.currentPlayerId)
    return hand?.cards ?? []
  }, [state])

  const getStealablePortalsCallback = useCallback(() => {
    return getStealablePortals(state)
  }, [state])

  // V2: Support callbacks
  const summonSupport = useCallback((supportType: SupportType, usePortal?: boolean) => {
    dispatch({ type: 'SUMMON_SUPPORT', supportType, usePortal })
  }, [])

  const activatePusher = useCallback((pieceId: string) => {
    dispatch({ type: 'ACTIVATE_PUSHER', pieceId })
  }, [])

  const executePush = useCallback((targetPieceId: string) => {
    dispatch({ type: 'EXECUTE_PUSH', targetPieceId })
  }, [])

  const cancelAbility = useCallback(() => {
    dispatch({ type: 'CANCEL_ABILITY' })
  }, [])

  const canSummon = useCallback((supportType: SupportType) => {
    return canSummonSupport(state, supportType)
  }, [state])

  const getPushTargetsCallback = useCallback((pieceId?: string) => {
    const id = pieceId ?? state.selectedPieceForAbility
    if (!id) return []
    return getPushTargets(state, id)
  }, [state])

  const getEffectiveMoveDistanceCallback = useCallback((pieceId: string) => {
    return getEffectiveMoveDistance(state, pieceId)
  }, [state])

  const getCurrentRosterCallback = useCallback(() => {
    return getCurrentRoster(state)
  }, [state])

  // AI turn handling
  useEffect(() => {
    const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
    if (!currentPlayer?.isAI || state.phase === 'game_over' || !state.turnReady) return

    // Handle portal_choice phase for AI
    if (state.phase === 'portal_choice') {
      const timeout = setTimeout(() => {
        // AI always claims new portal (it's closer to current position)
        dispatch({ type: 'CLAIM_PORTAL' })
      }, AI_TURN_DELAY)
      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => {
      const action = getAIAction(state)
      if (action) {
        dispatch(action)
      }
    }, AI_TURN_DELAY)

    return () => clearTimeout(timeout)
  }, [state.currentPlayerId, state.phase, state.selectedCard, state.turnReady, state.pendingPortal])

  return (
    <GameContext.Provider
      value={{
        state,
        selectCard,
        unselectCard,
        enterPiece,
        movePiece,
        claimPortal,
        skipPortal,
        stealPortal,
        refreshHand,
        startTurn,
        resetGame,
        canEnterAtStart,
        canEnterAtPortal,
        canMovePiece,
        getCurrentPlayerHand,
        getStealablePortals: getStealablePortalsCallback,
        // V2
        summonSupport,
        activatePusher,
        executePush,
        cancelAbility,
        canSummon,
        getPushTargets: getPushTargetsCallback,
        getEffectiveMoveDistance: getEffectiveMoveDistanceCallback,
        getCurrentRoster: getCurrentRosterCallback
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextType {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}

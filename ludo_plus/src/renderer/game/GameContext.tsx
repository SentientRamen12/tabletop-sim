import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react'
import type { GameState, Card, PlayerColor } from '../../shared/types'
import { gameReducer, createInitialState, getValidMoves } from './gameState'

interface GameContextType {
  state: GameState
  selectCard: (cardId: string) => void
  enterPiece: (pieceId: string) => void
  movePiece: (pieceId: string) => void
  skipTurn: () => void
  resetGame: (playerCount?: number, humanColor?: PlayerColor) => void
  canEnterPiece: (pieceId: string) => boolean
  canMovePiece: (pieceId: string) => boolean
  getHumanPlayerHand: () => Card[]
  humanPlayerId: string
}

const GameContext = createContext<GameContextType | null>(null)

interface GameProviderProps {
  children: ReactNode
  playerCount?: number
  humanColor?: PlayerColor
}

export function GameProvider({ children, playerCount = 4, humanColor = 'red' }: GameProviderProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    { playerCount, humanColor },
    (init) => createInitialState(init.playerCount, init.humanColor)
  )

  const humanPlayerId = 'player-0'

  const selectCard = useCallback((cardId: string) => {
    dispatch({ type: 'SELECT_CARD', cardId })
  }, [])

  const enterPiece = useCallback((pieceId: string) => {
    dispatch({ type: 'ENTER_PIECE', pieceId })
  }, [])

  const movePiece = useCallback((pieceId: string) => {
    dispatch({ type: 'MOVE_PIECE', pieceId })
  }, [])

  const skipTurn = useCallback(() => {
    dispatch({ type: 'END_TURN' })
  }, [])

  const resetGame = useCallback((count: number = 4, color: PlayerColor = 'red') => {
    dispatch({ type: 'RESET_GAME', playerCount: count, humanColor: color })
  }, [])

  const canEnterPiece = useCallback((pieceId: string) => {
    return getValidMoves(state, pieceId).canEnter
  }, [state])

  const canMovePiece = useCallback((pieceId: string) => {
    return getValidMoves(state, pieceId).canMove
  }, [state])

  const getHumanPlayerHand = useCallback(() => {
    const hand = state.hands.find(h => h.playerId === humanPlayerId)
    return hand?.cards ?? []
  }, [state])

  // AI turn handling
  useEffect(() => {
    const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
    if (!currentPlayer?.isAI || state.phase === 'game_over') return

    const timeout = setTimeout(() => {
      // Simple AI: pick first valid action
      const hand = state.hands.find(h => h.playerId === state.currentPlayerId)
      if (!hand || hand.cards.length === 0) {
        dispatch({ type: 'END_TURN' })
        return
      }

      if (state.phase === 'select_card') {
        // Select first card
        dispatch({ type: 'SELECT_CARD', cardId: hand.cards[0].id })
      } else if (state.phase === 'select_action' && state.selectedCard) {
        // Try to move or enter a piece
        const myPieces = state.pieces.filter(p => p.playerId === state.currentPlayerId && !p.isFinished)

        // Prefer moving pieces already on board
        for (const piece of myPieces) {
          if (piece.position !== null) {
            const { canMove } = getValidMoves(state, piece.id)
            if (canMove) {
              dispatch({ type: 'MOVE_PIECE', pieceId: piece.id })
              return
            }
          }
        }

        // Try entering a piece
        for (const piece of myPieces) {
          if (piece.position === null) {
            const { canEnter } = getValidMoves(state, piece.id)
            if (canEnter) {
              dispatch({ type: 'ENTER_PIECE', pieceId: piece.id })
              return
            }
          }
        }

        // No valid moves, skip turn
        dispatch({ type: 'END_TURN' })
      }
    }, 600)

    return () => clearTimeout(timeout)
  }, [state.currentPlayerId, state.phase, state.selectedCard])

  return (
    <GameContext.Provider
      value={{
        state,
        selectCard,
        enterPiece,
        movePiece,
        skipTurn,
        resetGame,
        canEnterPiece,
        canMovePiece,
        getHumanPlayerHand,
        humanPlayerId
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

import { useGame } from '../game/GameContext'
import { BOARD_SIZE, getCellType, getEntryColor, getColoredSafeColor, getSpiralArrows } from '../game/board'
import type { Piece } from '../../shared/types'
import './Board.css'

export default function Board() {
  const { state, movePiece, enterPiece, canMovePiece, canEnterPiece } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const currentPieces = state.pieces.filter(p => p.playerId === state.currentPlayerId)
  const openPieces = currentPieces.filter(p => p.position !== null && !p.isFinished).length
  const finishedPieces = currentPieces.filter(p => p.isFinished).length

  const getPiecesAtCell = (row: number, col: number): Piece[] => {
    return state.pieces.filter(
      p => p.position?.row === row && p.position?.col === col && !p.isFinished
    )
  }

  const handlePieceClick = (piece: Piece) => {
    if (!state.turnReady) return
    if (piece.playerId !== state.currentPlayerId) return
    if (state.phase !== 'select_action') return

    if (piece.position === null && canEnterPiece(piece.id)) {
      enterPiece(piece.id)
    } else if (piece.position !== null && canMovePiece(piece.id)) {
      movePiece(piece.id)
    }
  }

  const renderPieces = (pieces: Piece[]) => {
    if (pieces.length === 0) return null

    return (
      <div className="pieces-container">
        {pieces.map((piece, idx) => {
          const isSelectable =
            state.turnReady &&
            state.phase === 'select_action' &&
            piece.playerId === state.currentPlayerId &&
            (canMovePiece(piece.id) || canEnterPiece(piece.id))

          return (
            <div
              key={piece.id}
              className={`piece piece-${piece.color} ${isSelectable ? 'selectable' : ''}`}
              style={{
                transform: pieces.length > 1 ? `translate(${idx * 4}px, ${idx * 4}px)` : undefined
              }}
              onClick={() => handlePieceClick(piece)}
            />
          )
        })}
      </div>
    )
  }

  const grid = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cellType = getCellType(row, col)
      const entryColor = getEntryColor(row, col)
      const coloredSafeColor = getColoredSafeColor(row, col)
      const arrows = getSpiralArrows(row, col)
      const pieces = getPiecesAtCell(row, col)

      grid.push(
        <div
          key={`${row}-${col}`}
          className={`cell cell-${cellType} ${entryColor ? `entry-${entryColor}` : ''} ${coloredSafeColor ? `colored-safe-${coloredSafeColor}` : ''}`}
        >
          {arrows.map((arrow, idx) => (
            <div
              key={`arrow-${idx}`}
              className={`spiral-arrow arrow-${arrow.corner} arrow-${arrow.color}`}
            />
          ))}
          {renderPieces(pieces)}
        </div>
      )
    }
  }

  return (
    <div className="board-wrapper">
      <div className="action-status">
        {state.selectedCard ? (
          <span className="status-move">Move {state.selectedCard.value}</span>
        ) : (
          <span className="status-waiting">Select a card</span>
        )}
        <span className="status-divider">|</span>
        <span className="status-open">Open {openPieces}</span>
        <span className="status-divider">|</span>
        <span className="status-goal">Reached Goal {finishedPieces}</span>
      </div>
      <div className="board">{grid}</div>
    </div>
  )
}

import { useGame } from '../game/GameContext'
import { BOARD_SIZE, getCellType, getEntryColor, getColoredSafeColor } from '../game/board'
import type { Piece } from '../../shared/types'
import './Board.css'

export default function Board() {
  const { state, movePiece, enterPiece, canMovePiece, canEnterPiece } = useGame()

  const getPiecesAtCell = (row: number, col: number): Piece[] => {
    return state.pieces.filter(
      p => p.position?.row === row && p.position?.col === col && !p.isFinished
    )
  }

  const handlePieceClick = (piece: Piece) => {
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
      const pieces = getPiecesAtCell(row, col)

      grid.push(
        <div
          key={`${row}-${col}`}
          className={`cell cell-${cellType} ${entryColor ? `entry-${entryColor}` : ''} ${coloredSafeColor ? `colored-safe-${coloredSafeColor}` : ''}`}
        >
          {renderPieces(pieces)}
        </div>
      )
    }
  }

  return <div className="board">{grid}</div>
}

import { useGame } from '../game/GameContext'
import { BOARD_SIZE, getCellType, getEntryColor, getSpiralArrows, positionsEqual } from '../game/board'
import type { Piece, PlayerColor } from '../../shared/types'
import './Board.css'

export default function Board() {
  const { state, movePiece, canMovePiece } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const currentPieces = state.pieces.filter(p => p.playerId === state.currentPlayerId)
  const openPieces = currentPieces.filter(p => p.position !== null && !p.isFinished).length
  const finishedPieces = currentPieces.filter(p => p.isFinished).length

  const getPieceAtCell = (row: number, col: number): Piece | undefined => {
    return state.pieces.find(
      p => p.position?.row === row && p.position?.col === col && !p.isFinished
    )
  }

  const getClaimedSummonColor = (row: number, col: number): PlayerColor | null => {
    const pos = { row, col }
    for (const [color, summonPos] of Object.entries(state.claimedSummons)) {
      if (summonPos && positionsEqual(summonPos, pos)) {
        return color as PlayerColor
      }
    }
    return null
  }

  const handlePieceClick = (piece: Piece) => {
    if (!state.turnReady) return
    if (piece.playerId !== state.currentPlayerId) return
    if (state.phase !== 'select_action') return

    if (piece.position !== null && canMovePiece(piece.id)) {
      movePiece(piece.id)
    }
  }

  const renderPiece = (piece: Piece | undefined) => {
    if (!piece) return null

          const isSelectable =
            state.turnReady &&
            state.phase === 'select_action' &&
            piece.playerId === state.currentPlayerId &&
      canMovePiece(piece.id)

          return (
            <div
              className={`piece piece-${piece.color} ${isSelectable ? 'selectable' : ''}`}
              onClick={() => handlePieceClick(piece)}
            />
    )
  }

  const grid = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cellType = getCellType(row, col)
      const entryColor = getEntryColor(row, col)
      const claimedColor = cellType === 'summon' ? getClaimedSummonColor(row, col) : null
      const arrows = getSpiralArrows(row, col)
      const piece = getPieceAtCell(row, col)

      grid.push(
        <div
          key={`${row}-${col}`}
          className={`cell cell-${cellType} ${entryColor ? `entry-${entryColor}` : ''} ${claimedColor ? `summon-${claimedColor}` : ''}`}
        >
          {arrows.map((arrow, idx) => (
            <div
              key={`arrow-${idx}`}
              className={`spiral-arrow arrow-${arrow.corner} arrow-${arrow.color}`}
            />
          ))}
          {renderPiece(piece)}
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

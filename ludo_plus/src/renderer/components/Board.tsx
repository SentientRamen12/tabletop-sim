import { useGame } from '../game/GameContext'
import { BOARD_SIZE, getCellType, getEntryColor, getSpiralArrows, positionsEqual } from '../game/board'
import type { Piece, PlayerColor, SupportType } from '../../shared/types'
import './Board.css'

// Support type icons
const SUPPORT_ICONS: Record<SupportType, string> = {
  escort: 'E',
  blocker: 'B',
  assassin: 'A',
  pusher: 'P'
}

export default function Board() {
  const {
    state,
    movePiece,
    canMovePiece,
    executePush,
    getPushTargets,
    getEffectiveMoveDistance
  } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const hero = state.pieces.find(p => p.playerId === state.currentPlayerId && p.kind === 'hero')
  const supportsOnField = state.pieces.filter(
    p => p.playerId === state.currentPlayerId && p.kind === 'support' && p.position !== null
  ).length

  // Get push targets if in push mode
  const pushTargets = state.phase === 'select_push_target' ? getPushTargets() : []
  const pushTargetIds = pushTargets.map(p => p.id)

  const getPiecesAtCell = (row: number, col: number): Piece[] => {
    return state.pieces.filter(
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

    // Handle push target selection
    if (state.phase === 'select_push_target') {
      if (pushTargetIds.includes(piece.id)) {
        executePush(piece.id)
      }
      return
    }

    // Normal movement
    if (piece.playerId !== state.currentPlayerId) return
    if (state.phase !== 'select_action') return

    if (piece.position !== null && canMovePiece(piece.id)) {
      movePiece(piece.id)
    }
  }

  const renderPiece = (piece: Piece) => {
    const isPushTarget = pushTargetIds.includes(piece.id)
    const isOwnPiece = piece.playerId === state.currentPlayerId

    // Selectable in normal move mode
    const isSelectableForMove =
      state.turnReady &&
      state.phase === 'select_action' &&
      isOwnPiece &&
      canMovePiece(piece.id)

    // Selectable as push target
    const isSelectableForPush = state.phase === 'select_push_target' && isPushTarget

    const isSelectable = isSelectableForMove || isSelectableForPush

    // Build class names for V2 piece types
    const kindClass = piece.kind === 'hero' ? 'piece-hero' : 'piece-support'
    const typeClass = piece.supportType ? `piece-${piece.supportType}` : ''
    const pushTargetClass = isPushTarget ? 'push-target' : ''

    return (
      <div
        key={piece.id}
        className={`piece piece-${piece.color} ${kindClass} ${typeClass} ${pushTargetClass} ${isSelectable ? 'selectable' : ''}`}
        onClick={() => handlePieceClick(piece)}
      >
        {piece.kind === 'support' && piece.supportType && (
          <span className="support-icon">{SUPPORT_ICONS[piece.supportType]}</span>
        )}
      </div>
    )
  }

  const grid = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cellType = getCellType(row, col)
      const entryColor = getEntryColor(row, col)
      const claimedColor = cellType === 'summon' ? getClaimedSummonColor(row, col) : null
      const arrows = getSpiralArrows(row, col)
      const pieces = getPiecesAtCell(row, col)

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
          {pieces.map(piece => renderPiece(piece))}
        </div>
      )
    }
  }

  // Build status text
  let statusText = ''
  if (state.phase === 'select_push_target') {
    statusText = 'Select piece to push'
  } else if (state.selectedCard) {
    // Show effective move distance for hero
    const heroMoveDistance = hero && hero.position ? getEffectiveMoveDistance(hero.id) : state.selectedCard.value
    if (heroMoveDistance !== state.selectedCard.value) {
      statusText = `Move ${state.selectedCard.value} (+${heroMoveDistance - state.selectedCard.value} Escort)`
    } else {
      statusText = `Move ${state.selectedCard.value}`
    }
  } else {
    statusText = 'Select a card'
  }

  return (
    <div className="board-wrapper">
      <div className="action-status">
        <span className={state.selectedCard ? 'status-move' : 'status-waiting'}>
          {statusText}
        </span>
        <span className="status-divider">|</span>
        <span className="status-open">
          Hero: {hero?.position ? 'On Board' : hero?.isFinished ? 'Won!' : 'Home'}
        </span>
        <span className="status-divider">|</span>
        <span className="status-goal">Supports: {supportsOnField}/3</span>
      </div>
      <div className="board">{grid}</div>
    </div>
  )
}

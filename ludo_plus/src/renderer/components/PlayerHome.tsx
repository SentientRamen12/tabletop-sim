import { useGame } from '../game/GameContext'
import type { Piece } from '../../shared/types'
import './PlayerHome.css'

export default function PlayerHome() {
  const { state, enterPiece, canEnterPiece } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)

  // Get current player's pieces at home (not on board, not finished)
  const homePieces = state.pieces.filter(
    p => p.playerId === state.currentPlayerId && p.position === null && !p.isFinished
  )

  const finishedCount = state.pieces.filter(
    p => p.playerId === state.currentPlayerId && p.isFinished
  ).length

  const handlePieceClick = (piece: Piece) => {
    if (!state.turnReady || state.phase !== 'select_action') return
    if (canEnterPiece(piece.id)) {
      enterPiece(piece.id)
    }
  }

  const title = state.isHotseat ? `${currentPlayer?.name}'s Pieces` : 'Your Pieces'

  return (
    <div className="player-home">
      <h3>{title}</h3>
      <div className="home-pieces">
        <div className="home-section">
          <span className="label">At Home</span>
          <div className="pieces-row">
            {homePieces.map(piece => {
              const canEnter = state.turnReady && state.phase === 'select_action' && canEnterPiece(piece.id)
              return (
                <div
                  key={piece.id}
                  className={`home-piece piece-${piece.color} ${canEnter ? 'selectable' : ''}`}
                  onClick={() => handlePieceClick(piece)}
                />
              )
            })}
            {homePieces.length === 0 && <span className="empty">—</span>}
          </div>
        </div>
        <div className="home-section">
          <span className="label">Finished</span>
          <div className="pieces-row">
            {Array.from({ length: finishedCount }).map((_, i) => (
              <div key={i} className={`home-piece piece-${currentPlayer?.color} finished`} />
            ))}
            {finishedCount === 0 && <span className="empty">—</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

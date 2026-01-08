import { useState } from 'react'
import { useGame } from '../game/GameContext'
import type { Piece } from '../../shared/types'
import './PlayerHome.css'

export default function PlayerHome() {
  const { state, enterPiece, canEnterAtStart, canEnterAtPortal } = useGame()
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null)

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)

  // Get current player's pieces at home (not on board, not finished)
  const homePieces = state.pieces.filter(
    p => p.playerId === state.currentPlayerId && p.position === null && !p.isFinished
  )

  const finishedCount = state.pieces.filter(
    p => p.playerId === state.currentPlayerId && p.isFinished
  ).length

  const hasPortal = !!state.claimedSummons[currentPlayer?.color ?? 'red']

  const handlePieceClick = (piece: Piece) => {
    if (!state.turnReady || state.phase !== 'select_action') return
    
    const canStart = canEnterAtStart(piece.id)
    const canPortal = canEnterAtPortal(piece.id)
    
    if (canStart && canPortal) {
      // Both available - show choice
      setSelectedPiece(piece.id)
    } else if (canPortal) {
      enterPiece(piece.id, true)
      setSelectedPiece(null)
    } else if (canStart) {
      enterPiece(piece.id, false)
      setSelectedPiece(null)
    }
  }

  const handleEntryChoice = (usePortal: boolean) => {
    if (selectedPiece) {
      enterPiece(selectedPiece, usePortal)
      setSelectedPiece(null)
    }
  }

  // Reset selection when turn changes
  const currentTurnKey = `${state.currentPlayerId}-${state.phase}`

  const title = state.isHotseat ? `${currentPlayer?.name}'s Pieces` : 'Your Pieces'

  // Show entry choice popup
  if (selectedPiece && state.phase === 'select_action') {
    return (
      <div className="player-home">
        <h3>Choose Entry Point</h3>
        <div className="entry-choice">
          <button 
            className="entry-btn entry-start"
            onClick={() => handleEntryChoice(false)}
          >
            Start
          </button>
          <button 
            className="entry-btn entry-portal"
            onClick={() => handleEntryChoice(true)}
          >
            Portal
          </button>
          <button 
            className="entry-btn entry-cancel"
            onClick={() => setSelectedPiece(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="player-home">
      <h3>{title}</h3>
      <div className="home-pieces">
        <div className="home-section">
          <span className="label">At Home</span>
          <div className="pieces-row">
            {homePieces.map(piece => {
              const canStart = state.turnReady && state.phase === 'select_action' && canEnterAtStart(piece.id)
              const canPortal = state.turnReady && state.phase === 'select_action' && canEnterAtPortal(piece.id)
              const canEnter = canStart || canPortal
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
        {hasPortal && (
          <div className="home-section portal-status">
            <span className="label">Portal</span>
            <span className={`portal-indicator portal-${currentPlayer?.color}`}>✓</span>
          </div>
        )}
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

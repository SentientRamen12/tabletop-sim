import { useGame } from '../game/GameContext'
import './GameStatus.css'

interface GameStatusProps {
  onExit: () => void
}

export default function GameStatus({ onExit }: GameStatusProps) {
  const { state, refreshHand, claimPortal, skipPortal, stealPortal, getStealablePortals } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const stealable = getStealablePortals()

  if (state.phase === 'game_over') {
    const winner = state.players.find(p => p.id === state.winner)
    return (
      <div className="game-status game-over">
        <h2>Game Over!</h2>
        <p className={`winner winner-${winner?.color}`}>
          {winner?.name} wins!
        </p>
        <button onClick={onExit}>Play Again</button>
      </div>
    )
  }

  // Portal choice phase
  if (state.phase === 'portal_choice' && !currentPlayer?.isAI) {
    return (
      <div className="game-status portal-choice">
        <h3>Update Portal?</h3>
        <p className="portal-hint">You landed on an unclaimed portal.</p>
        <div className="portal-buttons">
          <button className="claim-btn" onClick={claimPortal}>
            Update Portal
          </button>
          <button className="skip-btn" onClick={skipPortal}>
            Keep Current
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="game-status">
      <div className="current-turn">
        <span className="label">Current Turn</span>
        <span className={`player-name player-${currentPlayer?.color}`}>
          {currentPlayer?.name}
          {currentPlayer?.isAI && ' (AI)'}
        </span>
      </div>
      <div className="players-list">
        {state.players.map(player => {
          const finished = state.pieces.filter(
            p => p.playerId === player.id && p.isFinished
          ).length

          return (
            <div
              key={player.id}
              className={`player-row ${player.id === state.currentPlayerId ? 'active' : ''}`}
            >
              <div className={`player-dot dot-${player.color}`} />
              <span className="player-label">{player.name}</span>
              <span className="player-stats">
                {finished}/4
              </span>
            </div>
          )
        })}
      </div>
      {/* These actions don't require card selection - work during select_card or select_action */}
      {currentPlayer && !currentPlayer.isAI && state.turnReady && 
       (state.phase === 'select_card' || state.phase === 'select_action') && 
       stealable.length > 0 && (
        <button className="steal-btn" onClick={() => stealPortal(stealable[0].position)}>
          Claim Portal
        </button>
      )}
      {currentPlayer && !currentPlayer.isAI && state.turnReady && 
       (state.phase === 'select_card' || state.phase === 'select_action') && (
        <button className="refresh-btn" onClick={refreshHand}>
          Refresh Hand
        </button>
      )}
      <button className="exit-btn" onClick={onExit}>
        Exit Game
      </button>
    </div>
  )
}

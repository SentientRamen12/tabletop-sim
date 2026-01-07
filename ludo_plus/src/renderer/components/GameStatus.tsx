import { useGame } from '../game/GameContext'
import './GameStatus.css'

interface GameStatusProps {
  onExit: () => void
}

export default function GameStatus({ onExit }: GameStatusProps) {
  const { state, refreshHand } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)

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
          const onBoard = state.pieces.filter(
            p => p.playerId === player.id && p.position !== null && !p.isFinished
          ).length
          const atHome = 4 - finished - onBoard

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
      {currentPlayer && !currentPlayer.isAI && state.turnReady && (
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

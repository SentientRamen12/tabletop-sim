import { useState } from 'react'
import { GameProvider } from './game/GameContext'
import Board from './components/Board'
import CardHand from './components/CardHand'
import PlayerHome from './components/PlayerHome'
import GameStatus from './components/GameStatus'
import GameLog from './components/GameLog'
import type { PlayerColor } from '../shared/types'
import './App.css'

const COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']

export default function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [playerCount, setPlayerCount] = useState(4)
  const [selectedColor, setSelectedColor] = useState<PlayerColor>('red')

  const handleExit = () => setGameStarted(false)

  if (!gameStarted) {
    return (
      <div className="start-screen">
        <h1>Lodu</h1>
        <p className="subtitle">A card-based race to the center</p>

        <div className="rules-box">
          <h3>How to Play</h3>
          <ul>
            <li>Play a card to move a piece or enter a new piece</li>
            <li>Race your 4 pieces around the spiral to the center</li>
            <li>Land on opponents to send them home (except safe spots)</li>
            <li>Max 2 pieces per cell; safe spots allow coexistence</li>
            <li>Exact card needed to reach center</li>
            <li>First to get all pieces to center wins</li>
          </ul>
        </div>

        <div className="option-row">
          <label>Your Color:</label>
          <div className="color-buttons">
            {COLORS.map(c => (
              <button
                key={c}
                className={`color-btn color-${c} ${selectedColor === c ? 'selected' : ''}`}
                onClick={() => setSelectedColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="option-row">
          <label>Players:</label>
          <div className="player-buttons">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                className={playerCount === n ? 'selected' : ''}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button className="start-btn" onClick={() => setGameStarted(true)}>
          Start Game
        </button>
      </div>
    )
  }

  return (
    <GameProvider playerCount={playerCount} humanColor={selectedColor}>
      <div className="game-container">
        <div className="game-log-area">
          <GameLog />
        </div>
        <div className="game-board-area">
          <Board />
        </div>
        <div className="game-sidebar">
          <GameStatus onExit={handleExit} />
          <CardHand />
          <PlayerHome />
        </div>
      </div>
    </GameProvider>
  )
}

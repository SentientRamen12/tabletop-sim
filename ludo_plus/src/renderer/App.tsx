import { useState } from 'react'
import { GameProvider } from './game/GameContext'
import Board from './components/Board'
import CardHand from './components/CardHand'
import PlayerHome from './components/PlayerHome'
import GameStatus from './components/GameStatus'
import type { PlayerColor } from '../shared/types'
import './App.css'

const COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']

export default function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [playerCount, setPlayerCount] = useState(4)
  const [selectedColor, setSelectedColor] = useState<PlayerColor>('red')

  if (!gameStarted) {
    return (
      <div className="start-screen">
        <h1>Ludo Plus</h1>
        <p className="subtitle">A card-based race to the center</p>

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
        <div className="game-board-area">
          <Board />
        </div>
        <div className="game-sidebar">
          <GameStatus />
          <CardHand />
          <PlayerHome />
        </div>
      </div>
    </GameProvider>
  )
}

import { useEffect, useRef } from 'react'
import { useGame } from '../game/GameContext'
import type { LogEntry } from '../../shared/types'
import './GameLog.css'

const ACTION_LABELS: Record<LogEntry['action'], string> = {
  moved: 'Move',
  entered: 'Enter',
  finished: 'Goal',
  captured: 'Capture',
  skipped: 'Skip',
  refreshed: 'Refresh'
}

export default function GameLog() {
  const { state } = useGame()
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log.length])

  return (
    <div className="game-log">
      <div className="log-header">
        <h3>Game Log</h3>
        <span className="log-count">{state.log.length}</span>
      </div>
      <div className="log-entries">
        {state.log.length === 0 ? (
          <p className="empty-log">Waiting for first move...</p>
        ) : (
          state.log.map(entry => (
            <div key={entry.id} className={`log-entry log-${entry.playerColor}`}>
              <span className="log-player">{entry.playerName}</span>
              <span className="log-action">{ACTION_LABELS[entry.action]}</span>
              {entry.cardValue !== undefined && (
                <span className="log-card">{entry.cardValue}</span>
              )}
              {entry.targetPlayer && (
                <span className="log-target">→ {entry.targetPlayer}</span>
              )}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useGame } from '../game/GameContext'
import type { SupportType } from '../../shared/types'
import { ALL_SUPPORT_TYPES, MAX_SUPPORTS_ON_FIELD } from '../../shared/types'
import './PlayerHome.css'

const SUPPORT_INFO: Record<SupportType, { name: string; icon: string; description: string }> = {
  escort: { name: 'Escort', icon: 'E', description: 'Hero +1 move when adjacent' },
  blocker: { name: 'Blocker', icon: 'B', description: 'Intercepts enemies passing through' },
  assassin: { name: 'Assassin', icon: 'A', description: '+2 movement, dies after capture' },
  pusher: { name: 'Pusher', icon: 'P', description: 'Push adjacent piece 1 space' }
}

export default function PlayerHome() {
  const {
    state,
    summonSupport,
    canSummon,
    activatePusher,
    cancelAbility,
    getCurrentRoster,
    getPushTargets
  } = useGame()

  const [showSummonChoice, setShowSummonChoice] = useState<SupportType | null>(null)

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const roster = getCurrentRoster()

  // Get hero status (hero is ALWAYS on board now)
  const hero = state.pieces.find(p => p.playerId === state.currentPlayerId && p.kind === 'hero')
  const heroStatus = hero?.isFinished ? 'won' : 'board'

  const hasPortal = !!state.claimedSummons[currentPlayer?.color ?? 'red']

  // Get pusher on field (for ability button)
  const pusherOnField = state.pieces.find(
    p => p.playerId === state.currentPlayerId &&
        p.kind === 'support' &&
        p.supportType === 'pusher' &&
        p.position !== null
  )

  // Check if pusher has valid targets (for showing ability button)
  const pusherHasTargets = pusherOnField ? getPushTargets(pusherOnField.id).length > 0 : false

  const handleSummonClick = (supportType: SupportType) => {
    if (!state.turnReady || state.phase !== 'select_action') return

    const { canSummon: canSum, canUsePortal } = canSummon(supportType)
    if (!canSum) return

    if (canUsePortal && hasPortal) {
      setShowSummonChoice(supportType)
    } else {
      summonSupport(supportType, false)
    }
  }

  const handleSummonChoice = (usePortal: boolean) => {
    if (showSummonChoice) {
      summonSupport(showSummonChoice, usePortal)
      setShowSummonChoice(null)
    }
  }

  const handlePusherAbility = () => {
    // Pusher ability can be used during select_card OR select_action (no card required)
    const canUse = pusherOnField && 
      (state.phase === 'select_card' || state.phase === 'select_action') && 
      !state.pusherUsedThisTurn &&
      pusherHasTargets
    if (canUse) {
      activatePusher(pusherOnField.id)
    }
  }

  const title = state.isHotseat ? `${currentPlayer?.name}'s Pieces` : 'Your Pieces'

  // Summon choice popup
  if (showSummonChoice) {
    const info = SUPPORT_INFO[showSummonChoice]
    return (
      <div className="player-home">
        <h3>Summon {info.name}</h3>
        <div className="entry-choice">
          <button
            className="entry-btn entry-start"
            onClick={() => handleSummonChoice(false)}
          >
            Start
          </button>
          <button
            className="entry-btn entry-portal"
            onClick={() => handleSummonChoice(true)}
          >
            Portal
          </button>
          <button
            className="entry-btn entry-cancel"
            onClick={() => setShowSummonChoice(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Push targeting mode
  if (state.phase === 'select_push_target') {
    return (
      <div className="player-home">
        <h3>Pusher Ability</h3>
        <p className="ability-hint">Select a piece on the board to push</p>
        <button className="cancel-btn" onClick={cancelAbility}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="player-home">
      <h3>{title}</h3>

      {/* Hero Section - Hero is ALWAYS on board */}
      <div className="home-section hero-section">
        <span className="label">Hero</span>
        <div className="hero-status">
          {heroStatus === 'board' && (
            <span className="status-text on-board">On Board</span>
          )}
          {heroStatus === 'won' && (
            <span className="status-text victory">Victory!</span>
          )}
        </div>
      </div>

      {/* Portal Status */}
      {hasPortal && (
        <div className="home-section portal-status">
          <span className="label">Portal</span>
          <span className={`portal-indicator portal-${currentPlayer?.color}`}>Claimed</span>
        </div>
      )}

      {/* Support Roster */}
      <div className="home-section support-section">
        <span className="label">Supports ({roster?.onField.length || 0}/{MAX_SUPPORTS_ON_FIELD})</span>
        <div className="support-roster">
          {ALL_SUPPORT_TYPES.map(type => {
            const info = SUPPORT_INFO[type]
            const isAvailable = roster?.available.includes(type) ?? false
            const isDeployed = state.pieces.some(
              p => p.playerId === state.currentPlayerId &&
                  p.kind === 'support' &&
                  p.supportType === type &&
                  p.position !== null
            )
            const { canSummon: canSum, canUsePortal } = canSummon(type)
            const canSummonNow = state.turnReady && state.phase === 'select_action' && canSum

            return (
              <div
                key={type}
                className={`support-slot support-${type} ${isDeployed ? 'deployed' : ''} ${!isAvailable && !isDeployed ? 'unavailable' : ''}`}
              >
                <div className="support-header">
                  <span className="support-icon">{info.icon}</span>
                  <span className="support-name">{info.name}</span>
                </div>
                <span className="support-status">
                  {isDeployed ? 'On Field' : isAvailable ? 'Ready' : 'Lost'}
                </span>
                {isAvailable && !isDeployed && (
                  <button
                    className={`summon-btn ${canSummonNow ? 'active' : ''}`}
                    disabled={!canSummonNow}
                    onClick={() => handleSummonClick(type)}
                  >
                    Summon
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pusher Ability Button - FREE action, once per turn, no card required */}
      {pusherOnField && 
       (state.phase === 'select_card' || state.phase === 'select_action') && 
       !state.pusherUsedThisTurn && 
       pusherHasTargets && (
        <div className="home-section ability-section">
          <button className="ability-btn pusher-ability" onClick={handlePusherAbility}>
            Use Pusher Ability (Free)
          </button>
        </div>
      )}
    </div>
  )
}

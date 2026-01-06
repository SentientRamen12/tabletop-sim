import { useGame } from '../game/GameContext'
import type { Card } from '../../shared/types'
import './CardHand.css'

export default function CardHand() {
  const { state, selectCard, unselectCard, startTurn, getCurrentPlayerHand } = useGame()

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const cards = getCurrentPlayerHand()

  const handleCardClick = (card: Card) => {
    if (!state.turnReady) return
    if (state.phase !== 'select_card' && state.phase !== 'select_action') return

    // If clicking the selected card, unselect it
    if (state.selectedCard?.id === card.id) {
      unselectCard()
      return
    }

    // Select the new card (works whether another card is selected or not)
    selectCard(card.id)
  }

  const isCardClickable = () => {
    if (!state.turnReady) return false
    return state.phase === 'select_card' || state.phase === 'select_action'
  }

  // Show "Start Turn" button in hotseat mode when turn isn't ready
  if (state.isHotseat && !state.turnReady && !currentPlayer?.isAI) {
    return (
      <div className="card-hand">
        <h3 className={`turn-header turn-${currentPlayer?.color}`}>
          {currentPlayer?.name}'s Turn
        </h3>
        <button className="start-turn-btn" onClick={startTurn}>
          Tap to Start Turn
        </button>
        <p className="hint">Pass the device to {currentPlayer?.name}</p>
      </div>
    )
  }

  return (
    <div className="card-hand">
      <h3>{state.isHotseat ? `${currentPlayer?.name}'s Cards` : 'Your Cards'}</h3>
      <div className="cards">
        {cards.map(card => (
          <div
            key={card.id}
            className={`card ${state.selectedCard?.id === card.id ? 'selected' : ''} ${
              isCardClickable() ? 'clickable' : ''
            }`}
            onClick={() => handleCardClick(card)}
          >
            <span className="card-value">{card.value}</span>
          </div>
        ))}
      </div>
      {state.phase === 'select_card' && state.turnReady && (
        <p className="hint">Select a card to play</p>
      )}
      {state.phase === 'select_action' && state.turnReady && (
        <p className="hint">
          Move {state.selectedCard?.value} spaces or enter a piece (click card to change)
        </p>
      )}
    </div>
  )
}

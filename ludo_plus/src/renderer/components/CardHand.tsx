import { useGame } from '../game/GameContext'
import type { Card } from '../../shared/types'
import './CardHand.css'

export default function CardHand() {
  const { state, selectCard, unselectCard, getHumanPlayerHand, humanPlayerId } = useGame()

  const isMyTurn = state.currentPlayerId === humanPlayerId
  const cards = getHumanPlayerHand()

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return
    if (state.phase !== 'select_card' && state.phase !== 'select_action') return

    // If clicking the selected card, unselect it
    if (state.selectedCard?.id === card.id) {
      unselectCard()
      return
    }

    // Select the new card (works whether another card is selected or not)
    selectCard(card.id)
  }

  const isCardClickable = (card: Card) => {
    if (!isMyTurn) return false
    return state.phase === 'select_card' || state.phase === 'select_action'
  }

  return (
    <div className="card-hand">
      <h3>Your Cards</h3>
      <div className="cards">
        {cards.map(card => (
          <div
            key={card.id}
            className={`card ${state.selectedCard?.id === card.id ? 'selected' : ''} ${
              isCardClickable(card) ? 'clickable' : ''
            }`}
            onClick={() => handleCardClick(card)}
          >
            <span className="card-value">{card.value}</span>
          </div>
        ))}
      </div>
      {state.phase === 'select_card' && isMyTurn && (
        <p className="hint">Select a card to play</p>
      )}
      {state.phase === 'select_action' && isMyTurn && (
        <p className="hint">
          Move {state.selectedCard?.value} spaces or enter a piece (click card to change)
        </p>
      )}
    </div>
  )
}

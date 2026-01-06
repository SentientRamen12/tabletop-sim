import { useGame } from '../game/GameContext'
import type { Card } from '../../shared/types'
import './CardHand.css'

export default function CardHand() {
  const { state, selectCard, getHumanPlayerHand, humanPlayerId } = useGame()

  const isMyTurn = state.currentPlayerId === humanPlayerId
  const cards = getHumanPlayerHand()

  const handleCardClick = (card: Card) => {
    if (!isMyTurn || state.phase !== 'select_card') return
    selectCard(card.id)
  }

  return (
    <div className="card-hand">
      <h3>Your Cards</h3>
      <div className="cards">
        {cards.map(card => (
          <div
            key={card.id}
            className={`card ${state.selectedCard?.id === card.id ? 'selected' : ''} ${
              isMyTurn && state.phase === 'select_card' ? 'clickable' : ''
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
          Move {state.selectedCard?.value} spaces or enter a piece
        </p>
      )}
    </div>
  )
}

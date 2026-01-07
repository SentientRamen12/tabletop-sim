import type { Card, PlayerHand } from '../../shared/types'

// Deck composition: 4×1, 4×2, 3×3, 3×4, 2×5, 2×6 = 18 cards
const DECK_COMPOSITION: Record<number, number> = {
  1: 4,
  2: 4,
  3: 3,
  4: 3,
  5: 2,
  6: 2
}

export const HAND_SIZE = 3

let cardIdCounter = 0

function generateCardId(): string {
  return `card-${++cardIdCounter}`
}

export function createDeck(): Card[] {
  const deck: Card[] = []

  for (const [value, count] of Object.entries(DECK_COMPOSITION)) {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: generateCardId(),
        value: parseInt(value)
      })
    }
  }

  return shuffle(deck)
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function createPlayerHand(playerId: string): PlayerHand {
  const deck = createDeck()
  const cards = deck.splice(0, HAND_SIZE)

  return {
    playerId,
    cards,
    deck,
    discard: []
  }
}

export function drawCard(hand: PlayerHand): PlayerHand {
  // If deck is empty, shuffle discard pile
  if (hand.deck.length === 0 && hand.discard.length > 0) {
    hand = {
      ...hand,
      deck: shuffle(hand.discard),
      discard: []
    }
  }

  if (hand.deck.length === 0) {
    return hand // No cards left anywhere
  }

  const [drawnCard, ...remainingDeck] = hand.deck

  return {
    ...hand,
    cards: [...hand.cards, drawnCard],
    deck: remainingDeck
  }
}

export function playCard(hand: PlayerHand, cardId: string): PlayerHand {
  const cardIndex = hand.cards.findIndex(c => c.id === cardId)
  if (cardIndex === -1) return hand

  const playedCard = hand.cards[cardIndex]
  const newCards = hand.cards.filter(c => c.id !== cardId)

  return {
    ...hand,
    cards: newCards,
    discard: [...hand.discard, playedCard]
  }
}

export function getCardById(hand: PlayerHand, cardId: string): Card | undefined {
  return hand.cards.find(c => c.id === cardId)
}

export function refreshHand(hand: PlayerHand): PlayerHand {
  // Discard all current cards
  let newHand: PlayerHand = {
    ...hand,
    cards: [],
    discard: [...hand.discard, ...hand.cards]
  }

  // Draw HAND_SIZE new cards
  for (let i = 0; i < HAND_SIZE; i++) {
    newHand = drawCard(newHand)
  }

  return newHand
}

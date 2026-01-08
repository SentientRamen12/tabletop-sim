import type { GameState, GameAction, Player, Piece, PlayerColor, LogEntry, SupportRoster, SupportType, Position } from '../../shared/types'
import { ALL_SUPPORT_TYPES, MAX_SUPPORTS_ON_FIELD } from '../../shared/types'
import { createPlayerHand, playCard, drawCard, getCardById, refreshHand } from './deck'
import {
  ENTRY_POSITIONS,
  TOTAL_PATH_LENGTH,
  isSafePosition,
  isSummonPosition,
  positionsEqual,
  getPositionForPlayer,
  PLAYER_PATHS,
  areAdjacent,
  getPushDestination,
  ALL_PATH_CELLS,
  isCenter
} from './board'

const ALL_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']
const MAX_PIECES_PER_CELL = 2

// V2: Move result with support for intercepts and capture outcomes
interface MoveResult {
  finalIndex: number
  capturedPieceId: string | null
  blocked: boolean
  intercepted: boolean           // true if moving piece was intercepted by Blocker
  interceptedBy: string | null   // Blocker piece ID
  assassinDies: boolean          // true if Assassin captures and dies
}

/**
 * V2: Calculate move result with support abilities.
 * - Escort: Hero gets +1 move when adjacent
 * - Assassin: +2 to all movement
 * - Blocker: Intercepts enemy pieces passing through
 * - Safe spots only protect heroes, not supports
 */
function calculateMove(
  pieces: Piece[],
  movingPiece: Piece,
  color: PlayerColor,
  baseSteps: number
): MoveResult {
  const centerIndex = TOTAL_PATH_LENGTH - 1
  const startIndex = movingPiece.pathIndex

  // Calculate movement modifiers
  let effectiveSteps = baseSteps

  // Escort bonus: Hero +1 when adjacent to own Escort
  if (movingPiece.kind === 'hero' && movingPiece.position) {
    const adjacentEscorts = pieces.filter(p =>
      p.playerId === movingPiece.playerId &&
      p.kind === 'support' &&
      p.supportType === 'escort' &&
      p.position &&
      areAdjacent(movingPiece.position!, p.position)
    )
    effectiveSteps += adjacentEscorts.length
  }

  // Assassin bonus: +2 to all movement
  if (movingPiece.kind === 'support' && movingPiece.supportType === 'assassin') {
    effectiveSteps += 2
  }

  const targetIndex = Math.min(startIndex + effectiveSteps, centerIndex)

  // Can't overshoot center
  if (startIndex + effectiveSteps > centerIndex) {
    return { finalIndex: startIndex, capturedPieceId: null, blocked: true, intercepted: false, interceptedBy: null, assassinDies: false }
  }

  // V2: Check for Blocker intercepts along the path (not at destination)
  for (let step = 1; step < effectiveSteps; step++) {
    const intermediateIndex = startIndex + step
    const intermediatePos = getPositionForPlayer(color, intermediateIndex)
    if (!intermediatePos) continue

    // Find enemy Blocker at this position
    const blocker = pieces.find(p =>
      p.playerId !== movingPiece.playerId &&
      p.kind === 'support' &&
      p.supportType === 'blocker' &&
      p.position &&
      positionsEqual(p.position, intermediatePos)
    )

    if (blocker) {
      // Intercepted! Moving piece is captured at Blocker's position
      return {
        finalIndex: intermediateIndex,
        capturedPieceId: movingPiece.id, // Moving piece gets captured
        blocked: false,
        intercepted: true,
        interceptedBy: blocker.id,
        assassinDies: false
      }
    }
  }

  const targetPos = getPositionForPlayer(color, targetIndex)
  if (!targetPos) {
    return { finalIndex: startIndex, capturedPieceId: null, blocked: true, intercepted: false, interceptedBy: null, assassinDies: false }
  }

  // Check pieces at target position
  const piecesAtTarget = pieces.filter(
    p => p.id !== movingPiece.id && p.position && positionsEqual(p.position, targetPos) && !p.isFinished
  )

  // Max pieces per cell check
  if (piecesAtTarget.length >= MAX_PIECES_PER_CELL) {
    return { finalIndex: startIndex, capturedPieceId: null, blocked: true, intercepted: false, interceptedBy: null, assassinDies: false }
  }

  if (piecesAtTarget.length > 0) {
    const pieceAtTarget = piecesAtTarget[0]
    const isOwnPiece = pieceAtTarget.playerId === movingPiece.playerId

    // V2: Safe spots only protect heroes, not supports
    const isProtectedBySafe = isSafePosition(targetPos) && pieceAtTarget.kind === 'hero'

    if (isOwnPiece || isProtectedBySafe) {
      // Blocked: can't land here
      return { finalIndex: startIndex, capturedPieceId: null, blocked: true, intercepted: false, interceptedBy: null, assassinDies: false }
    }

    // Capture opponent
    // Check if Assassin dies after capturing
    const assassinDies = movingPiece.kind === 'support' && movingPiece.supportType === 'assassin'

    return {
      finalIndex: targetIndex,
      capturedPieceId: pieceAtTarget.id,
      blocked: false,
      intercepted: false,
      interceptedBy: null,
      assassinDies
    }
  }

  // Target is empty
  return { finalIndex: targetIndex, capturedPieceId: null, blocked: false, intercepted: false, interceptedBy: null, assassinDies: false }
}

export function createInitialState(playerCount: number = 4, humanColor: PlayerColor = 'red', isHotseat: boolean = false): GameState {
  // Reorder colors so human's choice is first
  const otherColors = ALL_COLORS.filter(c => c !== humanColor)
  const colors = [humanColor, ...otherColors].slice(0, playerCount)

  const colorNames: Record<PlayerColor, string> = {
    red: 'Red',
    blue: 'Blue',
    green: 'Green',
    yellow: 'Yellow'
  }

  const players: Player[] = colors.map((color, idx) => ({
    id: `player-${idx}`,
    color,
    name: isHotseat ? colorNames[color] : (idx === 0 ? 'You' : `CPU ${idx}`),
    isAI: isHotseat ? false : idx > 0
  }))

  // V2: Create 1 hero per player (supports are summoned during game)
  const pieces: Piece[] = players.map(player => ({
    id: `${player.id}-hero`,
    playerId: player.id,
    color: player.color,
    position: null,
    pathIndex: -1,
    isFinished: false,
    kind: 'hero' as const
  }))

  // V2: Initialize support rosters - all 4 types available for each player
  const supportRosters: SupportRoster[] = players.map(player => ({
    playerId: player.id,
    available: [...ALL_SUPPORT_TYPES],
    onField: []
  }))

  const hands = players.map(p => createPlayerHand(p.id))

  return {
    players,
    pieces,
    hands,
    supportRosters,
    currentPlayerId: players[0].id,
    phase: 'select_card',
    selectedCard: null,
    winner: null,
    log: [],
    isHotseat,
    turnReady: !isHotseat, // In hotseat mode, first player must click to start
    claimedSummons: {},
    pendingPortal: null,
    selectedPieceForAbility: null,
    pusherUsedThisTurn: false
  }
}

let logIdCounter = 0
function createLogEntry(
  player: Player,
  action: LogEntry['action'],
  cardValue?: number,
  targetPlayer?: string,
  supportType?: SupportType
): LogEntry {
  return {
    id: `log-${++logIdCounter}`,
    playerName: player.name,
    playerColor: player.color,
    action,
    cardValue,
    targetPlayer,
    supportType
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_CARD': {
      const hand = state.hands.find(h => h.playerId === state.currentPlayerId)
      if (!hand) return state

      const card = getCardById(hand, action.cardId)
      if (!card) return state

      return {
        ...state,
        selectedCard: card,
        phase: 'select_action'
      }
    }

    case 'UNSELECT_CARD': {
      if (state.phase !== 'select_action') return state

      return {
        ...state,
        selectedCard: null,
        phase: 'select_card'
      }
    }

    case 'ENTER_PIECE': {
      if (!state.selectedCard) return state

      const piece = state.pieces.find(p => p.id === action.pieceId)
      if (!piece || piece.playerId !== state.currentPlayerId) return state
      if (piece.position !== null) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const defaultEntryPos = ENTRY_POSITIONS[player.color]
      const claimedSummonPos = state.claimedSummons[player.color]

      // Determine which entry to use based on usePortal flag
      let entryPos: typeof defaultEntryPos
      let pathIndex: number

      if (action.usePortal && claimedSummonPos) {
        // Use portal (claimed summon point) - blocked by ANY piece
        const piecesAtSummon = state.pieces.filter(
          p => p.position && positionsEqual(p.position, claimedSummonPos) && !p.isFinished
        )
        if (piecesAtSummon.length > 0) {
          return state // Portal blocked
        }
        const summonPathIndex = PLAYER_PATHS[player.color].findIndex(
          pos => positionsEqual(pos, claimedSummonPos)
        )
        if (summonPathIndex < 0) return state
        entryPos = claimedSummonPos
        pathIndex = summonPathIndex
      } else {
        // Use default start entry
        const piecesAtEntry = state.pieces.filter(
          p => p.position && positionsEqual(p.position, defaultEntryPos) && !p.isFinished
        )
        // Blocked if at max capacity OR opponent present
        if (piecesAtEntry.length >= MAX_PIECES_PER_CELL) {
          return state // Entry at max capacity
        }
        if (piecesAtEntry.some(p => p.playerId !== state.currentPlayerId)) {
          return state // Start blocked by opponent
        }
        entryPos = defaultEntryPos
        pathIndex = 0
      }

      const newPieces = state.pieces.map(p =>
        p.id === piece.id
          ? { ...p, position: entryPos, pathIndex }
          : p
      )

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      const logEntry = createLogEntry(player, 'entered', state.selectedCard.value)

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        selectedCard: null,
        log: [...state.log, logEntry]
      })
    }

    case 'MOVE_PIECE': {
      if (!state.selectedCard) return state

      const piece = state.pieces.find(p => p.id === action.pieceId)
      if (!piece || piece.playerId !== state.currentPlayerId) return state
      if (piece.position === null || piece.isFinished) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const steps = state.selectedCard.value
      const moveResult = calculateMove(state.pieces, piece, player.color, steps)

      // Blocked - can't move
      if (moveResult.blocked) {
        return state
      }

      const centerIndex = TOTAL_PATH_LENGTH - 1
      let newPieces = [...state.pieces]
      let newSupportRosters = [...state.supportRosters]
      const newLog = [...state.log]

      // V2: Handle Blocker intercept - moving piece is captured
      if (moveResult.intercepted) {
        const blockerOwner = state.players.find(p => {
          const blocker = state.pieces.find(bl => bl.id === moveResult.interceptedBy)
          return blocker && blocker.playerId === p.id
        })

        // Apply V2 capture matrix to the intercepted piece
        if (piece.kind === 'hero') {
          // Hero resets to start
          newPieces = newPieces.map(p =>
            p.id === piece.id
              ? { ...p, position: null, pathIndex: -1 }
              : p
          )
          newLog.push(createLogEntry(player, 'intercepted', steps, blockerOwner?.name))
          newLog.push(createLogEntry(player, 'hero_reset'))
        } else {
          // Support is removed - remove from pieces and update roster
          newPieces = newPieces.filter(p => p.id !== piece.id)
          newSupportRosters = newSupportRosters.map(roster =>
            roster.playerId === piece.playerId
              ? {
                  ...roster,
                  onField: roster.onField.filter(id => id !== piece.id),
                  available: [...roster.available, piece.supportType!]
                }
              : roster
          )
          newLog.push(createLogEntry(player, 'intercepted', steps, blockerOwner?.name, piece.supportType))
          newLog.push(createLogEntry(player, 'support_removed', undefined, undefined, piece.supportType))
        }

        let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
        hand = playCard(hand, state.selectedCard.id)
        hand = drawCard(hand)

        const newHands = state.hands.map(h =>
          h.playerId === state.currentPlayerId ? hand : h
        )

        return endTurn({
          ...state,
          pieces: newPieces,
          hands: newHands,
          supportRosters: newSupportRosters,
          selectedCard: null,
          log: newLog
        })
      }

      const newPos = getPositionForPlayer(player.color, moveResult.finalIndex)
      if (!newPos) return state

      // V2: Supports can't finish - they're removed if they reach center
      const isFinishing = moveResult.finalIndex === centerIndex && piece.kind === 'hero'
      const supportReachesCenter = moveResult.finalIndex === centerIndex && piece.kind === 'support'

      // V2: Handle capture with capture matrix
      let capturedPlayer: Player | undefined
      if (moveResult.capturedPieceId) {
        const capturedPiece = newPieces.find(p => p.id === moveResult.capturedPieceId)
        if (capturedPiece) {
          capturedPlayer = state.players.find(p => p.id === capturedPiece.playerId)

          // V2 Capture matrix:
          // - Hero captured → reset to start
          // - Support captured → removed (back to available pool)
          if (capturedPiece.kind === 'hero') {
            newPieces = newPieces.map(p =>
              p.id === moveResult.capturedPieceId
                ? { ...p, position: null, pathIndex: -1 }
                : p
            )
            newLog.push(createLogEntry(player, 'captured', undefined, capturedPlayer?.name))
            newLog.push(createLogEntry(capturedPlayer!, 'hero_reset'))
          } else {
            // Remove support from pieces and update roster
            newPieces = newPieces.filter(p => p.id !== moveResult.capturedPieceId)
            newSupportRosters = newSupportRosters.map(roster =>
              roster.playerId === capturedPiece.playerId
                ? {
                    ...roster,
                    onField: roster.onField.filter(id => id !== capturedPiece.id),
                    available: [...roster.available, capturedPiece.supportType!]
                  }
                : roster
            )
            newLog.push(createLogEntry(player, 'captured', undefined, capturedPlayer?.name, capturedPiece.supportType))
          }
        }
      }

      // V2: Assassin dies after capturing
      if (moveResult.assassinDies) {
        newPieces = newPieces.filter(p => p.id !== piece.id)
        newSupportRosters = newSupportRosters.map(roster =>
          roster.playerId === piece.playerId
            ? {
                ...roster,
                onField: roster.onField.filter(id => id !== piece.id),
                available: [...roster.available, 'assassin' as SupportType]
              }
            : roster
        )
        newLog.push(createLogEntry(player, 'support_removed', undefined, undefined, 'assassin'))
      } else if (supportReachesCenter) {
        // Support reaching center is removed (can't win)
        newPieces = newPieces.filter(p => p.id !== piece.id)
        newSupportRosters = newSupportRosters.map(roster =>
          roster.playerId === piece.playerId
            ? {
                ...roster,
                onField: roster.onField.filter(id => id !== piece.id),
                available: [...roster.available, piece.supportType!]
              }
            : roster
        )
        newLog.push(createLogEntry(player, 'support_removed', undefined, undefined, piece.supportType))
      } else {
        // Normal move - update piece position
        newPieces = newPieces.map(p =>
          p.id === piece.id
            ? { ...p, position: newPos, pathIndex: moveResult.finalIndex, isFinished: isFinishing }
            : p
        )

        if (isFinishing) {
          newLog.push(createLogEntry(player, 'finished', state.selectedCard.value))
        } else {
          newLog.push(createLogEntry(player, 'moved', state.selectedCard.value))
        }
      }

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      // Check if landing on unclaimed summon point (only if piece wasn't removed)
      let newClaimedSummons = state.claimedSummons
      let pendingPortal: typeof state.pendingPortal = null

      if (!isFinishing && !supportReachesCenter && !moveResult.assassinDies && isSummonPosition(newPos)) {
        const alreadyClaimed = Object.values(state.claimedSummons).some(
          pos => pos && positionsEqual(pos, newPos)
        )
        if (!alreadyClaimed) {
          if (!state.claimedSummons[player.color]) {
            // No existing portal - auto claim
            newClaimedSummons = { ...state.claimedSummons, [player.color]: newPos }
            newLog.push(createLogEntry(player, 'claimed'))
          } else {
            // Has existing portal - enter portal_choice phase
            pendingPortal = newPos
          }
        }
      }

      // V2: Win condition - hero reaches center
      const hero = newPieces.find(p => p.playerId === state.currentPlayerId && p.kind === 'hero')
      const heroWon = hero?.isFinished === true

      if (heroWon) {
        return {
          ...state,
          pieces: newPieces,
          hands: newHands,
          supportRosters: newSupportRosters,
          selectedCard: null,
          phase: 'game_over',
          winner: state.currentPlayerId,
          log: newLog,
          claimedSummons: newClaimedSummons,
          pendingPortal: null,
          selectedPieceForAbility: null
        }
      }

      // If there's a pending portal choice, go to portal_choice phase
      if (pendingPortal) {
        return {
          ...state,
          pieces: newPieces,
          hands: newHands,
          supportRosters: newSupportRosters,
          selectedCard: null,
          log: newLog,
          claimedSummons: newClaimedSummons,
          phase: 'portal_choice',
          pendingPortal
        }
      }

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        supportRosters: newSupportRosters,
        selectedCard: null,
        log: newLog,
        claimedSummons: newClaimedSummons,
        pendingPortal: null
      })
    }

    case 'END_TURN': {
      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (player && state.phase === 'select_action') {
        const logEntry = createLogEntry(player, 'skipped')
        return endTurn({
          ...state,
          log: [...state.log, logEntry]
        })
      }
      return endTurn(state)
    }

    case 'START_TURN': {
      if (state.turnReady) return state
      return {
        ...state,
        turnReady: true
      }
    }

    case 'REFRESH_HAND': {
      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)
      if (!hand) return state

      hand = refreshHand(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      const logEntry = createLogEntry(player, 'refreshed')

      return endTurn({
        ...state,
        hands: newHands,
        selectedCard: null,
        log: [...state.log, logEntry]
      })
    }

    case 'CLAIM_PORTAL': {
      if (state.phase !== 'portal_choice' || !state.pendingPortal) return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const newClaimedSummons = { ...state.claimedSummons, [player.color]: state.pendingPortal }
      const newLog = [...state.log, createLogEntry(player, 'claimed')]

      return endTurn({
        ...state,
        claimedSummons: newClaimedSummons,
        pendingPortal: null,
        log: newLog
      })
    }

    case 'SKIP_PORTAL': {
      if (state.phase !== 'portal_choice') return state

      return endTurn({
        ...state,
        pendingPortal: null
      })
    }

    case 'STEAL_PORTAL': {
      if (state.phase !== 'select_action') return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      // Find who owns this portal - must be a claimed portal
      let previousOwner: PlayerColor | null = null
      for (const [color, pos] of Object.entries(state.claimedSummons)) {
        if (pos && positionsEqual(pos, action.position)) {
          previousOwner = color as PlayerColor
          break
        }
      }
      if (!previousOwner || previousOwner === player.color) return state

      // Check if a piece is on the portal and piece color ≠ portal color
      const pieceAtPos = state.pieces.find(
        p => p.position && positionsEqual(p.position, action.position) && !p.isFinished
      )
      if (!pieceAtPos || pieceAtPos.color === previousOwner) return state

      // Update claimed summons: remove previous owner's claim, add current player's
      const newClaimedSummons = { ...state.claimedSummons }
      delete newClaimedSummons[previousOwner]
      newClaimedSummons[player.color] = action.position

      const targetPlayer = state.players.find(p => p.color === previousOwner)?.name
      const newLog = [...state.log, createLogEntry(player, 'stole', undefined, targetPlayer)]

      return endTurn({
        ...state,
        claimedSummons: newClaimedSummons,
        selectedCard: null,
        log: newLog,
        pendingPortal: null
      })
    }

    case 'RESET_GAME': {
      return createInitialState(action.playerCount, action.humanColor, action.isHotseat)
    }

    // V2: Support summoning
    // Portals and start spots are STACKABLE for summoning - no blocking checks
    // Newly summoned supports don't capture existing pieces
    case 'SUMMON_SUPPORT': {
      if (!state.selectedCard) return state
      if (state.phase !== 'select_action') return state

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      const roster = state.supportRosters.find(r => r.playerId === state.currentPlayerId)
      if (!roster) return state

      // Validation: type available and under max on field
      if (!roster.available.includes(action.supportType)) return state
      if (roster.onField.length >= MAX_SUPPORTS_ON_FIELD) return state

      // Determine entry position
      const defaultEntryPos = ENTRY_POSITIONS[player.color]
      const claimedSummonPos = state.claimedSummons[player.color]

      // Portal entry requires card value 3+
      const canUsePortal = action.usePortal && state.selectedCard.value >= 3 && claimedSummonPos

      let entryPos: typeof defaultEntryPos
      let pathIndex: number

      if (canUsePortal && claimedSummonPos) {
        // Portal summoning - stackable, no blocking check
        const summonPathIndex = PLAYER_PATHS[player.color].findIndex(
          pos => positionsEqual(pos, claimedSummonPos)
        )
        if (summonPathIndex < 0) return state

        entryPos = claimedSummonPos
        pathIndex = summonPathIndex
      } else {
        // Default start entry - stackable, no blocking check
        entryPos = defaultEntryPos
        pathIndex = 0
      }

      // Create new support piece
      const newSupportId = `${player.id}-support-${action.supportType}-${Date.now()}`
      const newPiece: Piece = {
        id: newSupportId,
        playerId: player.id,
        color: player.color,
        position: entryPos,
        pathIndex,
        isFinished: false,
        kind: 'support',
        supportType: action.supportType
      }

      const newPieces = [...state.pieces, newPiece]

      // Update roster
      const newSupportRosters = state.supportRosters.map(r =>
        r.playerId === state.currentPlayerId
          ? {
              ...r,
              available: r.available.filter(t => t !== action.supportType),
              onField: [...r.onField, newSupportId]
            }
          : r
      )

      let hand = state.hands.find(h => h.playerId === state.currentPlayerId)!
      hand = playCard(hand, state.selectedCard.id)
      hand = drawCard(hand)

      const newHands = state.hands.map(h =>
        h.playerId === state.currentPlayerId ? hand : h
      )

      const logEntry = createLogEntry(player, 'summoned', state.selectedCard.value, undefined, action.supportType)

      return endTurn({
        ...state,
        pieces: newPieces,
        hands: newHands,
        supportRosters: newSupportRosters,
        selectedCard: null,
        log: [...state.log, logEntry]
      })
    }

    // V2: Pusher ability - enter targeting mode
    // Pusher ability is FREE (doesn't consume card or end turn) but once per turn
    case 'ACTIVATE_PUSHER': {
      if (state.phase !== 'select_action') return state
      if (state.pusherUsedThisTurn) return state  // Already used this turn

      const piece = state.pieces.find(p => p.id === action.pieceId)
      if (!piece || piece.playerId !== state.currentPlayerId) return state
      if (piece.kind !== 'support' || piece.supportType !== 'pusher') return state
      if (!piece.position) return state

      return {
        ...state,
        phase: 'select_push_target',
        selectedPieceForAbility: piece.id
      }
    }

    // V2: Execute push on target
    // Pusher ability is FREE - doesn't consume card or end turn, but once per turn
    case 'EXECUTE_PUSH': {
      if (state.phase !== 'select_push_target') return state
      if (!state.selectedPieceForAbility) return state

      const pusher = state.pieces.find(p => p.id === state.selectedPieceForAbility)
      if (!pusher || !pusher.position) return state

      const target = state.pieces.find(p => p.id === action.targetPieceId)
      if (!target || !target.position) return state

      // Verify adjacency
      if (!areAdjacent(pusher.position, target.position)) return state

      // Calculate push destination
      const pushDest = getPushDestination(pusher.position, target.position)
      if (!pushDest) return state // Can't push off board

      const player = state.players.find(p => p.id === state.currentPlayerId)
      if (!player) return state

      let newPieces = [...state.pieces]
      let newSupportRosters = [...state.supportRosters]
      const newLog = [...state.log]

      // Check if push destination has another piece (causes capture)
      const pieceAtDest = newPieces.find(
        p => p.position && positionsEqual(p.position, pushDest) && !p.isFinished && p.id !== target.id
      )

      if (pieceAtDest) {
        // Pushed piece "captures" the piece at destination (pushed = attacker)
        const capturedPlayer = state.players.find(p => p.id === pieceAtDest.playerId)

        if (pieceAtDest.kind === 'hero') {
          // Hero resets
          newPieces = newPieces.map(p =>
            p.id === pieceAtDest.id ? { ...p, position: null, pathIndex: -1 } : p
          )
          newLog.push(createLogEntry(capturedPlayer!, 'hero_reset'))
        } else {
          // Support removed
          newPieces = newPieces.filter(p => p.id !== pieceAtDest.id)
          newSupportRosters = newSupportRosters.map(roster =>
            roster.playerId === pieceAtDest.playerId
              ? {
                  ...roster,
                  onField: roster.onField.filter(id => id !== pieceAtDest.id),
                  available: [...roster.available, pieceAtDest.supportType!]
                }
              : roster
          )
        }
      }

      // Check if push into center
      if (isCenter(pushDest)) {
        if (target.kind === 'hero') {
          // Hero wins! (game over, but pusher ability was still free)
          newPieces = newPieces.map(p =>
            p.id === target.id ? { ...p, position: pushDest, isFinished: true } : p
          )

          newLog.push(createLogEntry(player, 'ability_used', undefined, undefined, 'pusher'))

          return {
            ...state,
            pieces: newPieces,
            supportRosters: newSupportRosters,
            phase: 'game_over',
            winner: target.playerId,
            selectedPieceForAbility: null,
            pusherUsedThisTurn: true,
            log: newLog
          }
        } else {
          // Support pushed into center is removed
          newPieces = newPieces.filter(p => p.id !== target.id)
          newSupportRosters = newSupportRosters.map(roster =>
            roster.playerId === target.playerId
              ? {
                  ...roster,
                  onField: roster.onField.filter(id => id !== target.id),
                  available: [...roster.available, target.supportType!]
                }
              : roster
          )
        }
      } else {
        // Normal push - move target to destination
        // Find pathIndex for new position
        const targetPlayer = state.players.find(p => p.id === target.playerId)
        const newPathIndex = targetPlayer
          ? PLAYER_PATHS[targetPlayer.color].findIndex(pos => positionsEqual(pos, pushDest))
          : -1

        newPieces = newPieces.map(p =>
          p.id === target.id
            ? { ...p, position: pushDest, pathIndex: newPathIndex >= 0 ? newPathIndex : p.pathIndex }
            : p
        )
      }

      newLog.push(createLogEntry(player, 'ability_used', undefined, undefined, 'pusher'))

      // FREE action: return to select_action, don't consume card, don't end turn
      return {
        ...state,
        pieces: newPieces,
        supportRosters: newSupportRosters,
        phase: 'select_action',
        selectedPieceForAbility: null,
        pusherUsedThisTurn: true,
        log: newLog
      }
    }

    // V2: Cancel ability targeting
    case 'CANCEL_ABILITY': {
      if (state.phase !== 'select_push_target') return state

      return {
        ...state,
        phase: 'select_action',
        selectedPieceForAbility: null
      }
    }

    default:
      return state
  }
}

function endTurn(state: GameState): GameState {
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayerId)
  const nextIndex = (currentIndex + 1) % state.players.length
  const nextPlayer = state.players[nextIndex]

  // In hotseat mode, human players need to click to start their turn
  const turnReady = state.isHotseat ? nextPlayer.isAI : true

  return {
    ...state,
    currentPlayerId: nextPlayer.id,
    phase: 'select_card',
    selectedCard: null,
    turnReady,
    pendingPortal: null,
    selectedPieceForAbility: null,
    pusherUsedThisTurn: false
  }
}

export function getValidMoves(state: GameState, pieceId: string): { 
  canMove: boolean
  canEnterStart: boolean
  canEnterPortal: boolean 
} {
  if (!state.selectedCard) return { canMove: false, canEnterStart: false, canEnterPortal: false }

  const piece = state.pieces.find(p => p.id === pieceId)
  if (!piece || piece.playerId !== state.currentPlayerId || piece.isFinished) {
    return { canMove: false, canEnterStart: false, canEnterPortal: false }
  }

  const player = state.players.find(p => p.id === state.currentPlayerId)
  if (!player) return { canMove: false, canEnterStart: false, canEnterPortal: false }

  const steps = state.selectedCard.value

  if (piece.position === null) {
    // Check default entry
    const defaultEntryPos = ENTRY_POSITIONS[player.color]
    const piecesAtDefaultEntry = state.pieces.filter(
      p => p.position && positionsEqual(p.position, defaultEntryPos) && !p.isFinished
    )
    // Can enter if: not at max AND no opponent blocking
    const canEnterStart = piecesAtDefaultEntry.length < MAX_PIECES_PER_CELL && 
                          !piecesAtDefaultEntry.some(p => p.playerId !== state.currentPlayerId)

    // Check claimed summon point (portal) - blocked by ANY piece
    const claimedSummonPos = state.claimedSummons[player.color]
    let canEnterPortal = false
    if (claimedSummonPos) {
      const piecesAtSummon = state.pieces.filter(
        p => p.position && positionsEqual(p.position, claimedSummonPos) && !p.isFinished
      )
      canEnterPortal = piecesAtSummon.length === 0
    }

    return { canMove: false, canEnterStart, canEnterPortal }
  }

  // Check if piece can move (not blocked)
  const { blocked } = calculateMove(state.pieces, piece, player.color, steps)

  return { canMove: !blocked, canEnterStart: false, canEnterPortal: false }
}

/**
 * Get positions where player can claim a portal (piece on portal but piece color ≠ portal color)
 */
export function getStealablePortals(state: GameState): { position: Position; ownerColor: PlayerColor }[] {
  if (state.phase !== 'select_action') return []
  
  const player = state.players.find(p => p.id === state.currentPlayerId)
  if (!player) return []

  const stealable: { position: Position; ownerColor: PlayerColor }[] = []

  // Check each claimed portal
  for (const [ownerColor, portalPos] of Object.entries(state.claimedSummons)) {
    if (!portalPos) continue
    if (ownerColor === player.color) continue // Already our portal

    // Check if ANY piece is on this portal and piece color ≠ portal color
    const pieceOnPortal = state.pieces.find(
      p => p.position && 
           positionsEqual(p.position, portalPos) && 
           !p.isFinished &&
           p.color !== ownerColor  // Piece color different from portal color
    )

    if (pieceOnPortal) {
      stealable.push({ position: portalPos, ownerColor: ownerColor as PlayerColor })
    }
  }

  return stealable
}

// V2 Helper Functions

/**
 * Check if player can summon a specific support type
 * Portals and start spots are STACKABLE - no blocking checks needed
 */
export function canSummonSupport(state: GameState, supportType: SupportType): {
  canSummon: boolean
  canUsePortal: boolean
} {
  if (!state.selectedCard || state.phase !== 'select_action') {
    return { canSummon: false, canUsePortal: false }
  }

  const player = state.players.find(p => p.id === state.currentPlayerId)
  if (!player) return { canSummon: false, canUsePortal: false }

  const roster = state.supportRosters.find(r => r.playerId === state.currentPlayerId)
  if (!roster) return { canSummon: false, canUsePortal: false }

  // Check roster constraints
  if (!roster.available.includes(supportType)) return { canSummon: false, canUsePortal: false }
  if (roster.onField.length >= MAX_SUPPORTS_ON_FIELD) return { canSummon: false, canUsePortal: false }

  // Start is always available for summoning (stackable)
  const canEnterStart = true

  // Portal entry requires card 3+ and having claimed a portal (stackable)
  const canUsePortal = state.selectedCard.value >= 3 && !!state.claimedSummons[player.color]

  return {
    canSummon: canEnterStart || canUsePortal,
    canUsePortal
  }
}

/**
 * Get pieces that Pusher can push (adjacent pieces)
 */
export function getPushTargets(state: GameState, pusherId: string): Piece[] {
  const pusher = state.pieces.find(p => p.id === pusherId)
  if (!pusher || !pusher.position) return []
  if (pusher.kind !== 'support' || pusher.supportType !== 'pusher') return []

  return state.pieces.filter(p => {
    if (!p.position || p.isFinished) return false
    if (p.id === pusherId) return false
    if (!areAdjacent(pusher.position!, p.position)) return false
    // Check if push destination is valid
    const dest = getPushDestination(pusher.position!, p.position)
    return dest !== null
  })
}

/**
 * Get effective move distance for a piece (including bonuses)
 */
export function getEffectiveMoveDistance(state: GameState, pieceId: string): number {
  if (!state.selectedCard) return 0

  const piece = state.pieces.find(p => p.id === pieceId)
  if (!piece || !piece.position) return state.selectedCard.value

  let distance = state.selectedCard.value

  // Escort bonus for hero
  if (piece.kind === 'hero') {
    const adjacentEscorts = state.pieces.filter(p =>
      p.playerId === piece.playerId &&
      p.kind === 'support' &&
      p.supportType === 'escort' &&
      p.position &&
      areAdjacent(piece.position!, p.position)
    )
    distance += adjacentEscorts.length
  }

  // Assassin bonus
  if (piece.kind === 'support' && piece.supportType === 'assassin') {
    distance += 2
  }

  return distance
}

/**
 * Get current player's support roster info
 */
export function getCurrentRoster(state: GameState): SupportRoster | undefined {
  return state.supportRosters.find(r => r.playerId === state.currentPlayerId)
}

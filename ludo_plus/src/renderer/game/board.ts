import type { Position, PlayerColor } from '../../shared/types'

export const BOARD_SIZE = 7
export const CENTER: Position = { row: 3, col: 3 }

// Entry positions for each player
export const ENTRY_POSITIONS: Record<PlayerColor, Position> = {
  red: { row: 0, col: 3 },
  blue: { row: 3, col: 6 },
  green: { row: 6, col: 3 },
  yellow: { row: 3, col: 0 }
}

// Outer ring - 24 cells, counter-clockwise from (0,3)
const OUTER_RING: Position[] = [
  { row: 0, col: 3 }, { row: 0, col: 2 }, { row: 0, col: 1 }, { row: 0, col: 0 },
  { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 },
  { row: 4, col: 0 }, { row: 5, col: 0 }, { row: 6, col: 0 },
  { row: 6, col: 1 }, { row: 6, col: 2 }, { row: 6, col: 3 },
  { row: 6, col: 4 }, { row: 6, col: 5 }, { row: 6, col: 6 },
  { row: 5, col: 6 }, { row: 4, col: 6 }, { row: 3, col: 6 },
  { row: 2, col: 6 }, { row: 1, col: 6 }, { row: 0, col: 6 },
  { row: 0, col: 5 }, { row: 0, col: 4 }
]

// Ring 1 - 16 cells
const RING_1: Position[] = [
  { row: 1, col: 3 }, { row: 1, col: 2 }, { row: 1, col: 1 },
  { row: 2, col: 1 }, { row: 3, col: 1 },
  { row: 4, col: 1 }, { row: 5, col: 1 },
  { row: 5, col: 2 }, { row: 5, col: 3 },
  { row: 5, col: 4 }, { row: 5, col: 5 },
  { row: 4, col: 5 }, { row: 3, col: 5 },
  { row: 2, col: 5 }, { row: 1, col: 5 },
  { row: 1, col: 4 }
]

// Ring 2 - 8 cells
const RING_2: Position[] = [
  { row: 2, col: 3 }, { row: 2, col: 2 },
  { row: 3, col: 2 }, { row: 4, col: 2 },
  { row: 4, col: 3 }, { row: 4, col: 4 },
  { row: 3, col: 4 }, { row: 2, col: 4 }
]

// Entry index in outer ring for each player
const OUTER_ENTRY_INDEX: Record<PlayerColor, number> = {
  red: 0,
  yellow: 6,
  green: 12,
  blue: 18
}

// Build full path for each player (outer ring from their entry + rings + center)
function buildPlayerPath(color: PlayerColor): Position[] {
  const entryIdx = OUTER_ENTRY_INDEX[color]
  const path: Position[] = []

  // Full outer ring starting from entry point
  for (let i = 0; i < OUTER_RING.length; i++) {
    path.push(OUTER_RING[(entryIdx + i) % OUTER_RING.length])
  }

  // Ring 1 - find entry point closest to player's outer entry
  const ring1EntryMap: Record<PlayerColor, number> = {
    red: 0,    // (1,3)
    yellow: 4, // (3,1)
    green: 8,  // (5,3)
    blue: 12   // (3,5)
  }
  const ring1Entry = ring1EntryMap[color]
  for (let i = 0; i < RING_1.length; i++) {
    path.push(RING_1[(ring1Entry + i) % RING_1.length])
  }

  // Ring 2 - find entry point
  const ring2EntryMap: Record<PlayerColor, number> = {
    red: 0,   // (2,3)
    yellow: 2, // (3,2)
    green: 4,  // (4,3)
    blue: 6    // (3,4)
  }
  const ring2Entry = ring2EntryMap[color]
  for (let i = 0; i < RING_2.length; i++) {
    path.push(RING_2[(ring2Entry + i) % RING_2.length])
  }

  // Center
  path.push(CENTER)

  return path
}

// Pre-built paths for each player
export const PLAYER_PATHS: Record<PlayerColor, Position[]> = {
  red: buildPlayerPath('red'),
  blue: buildPlayerPath('blue'),
  green: buildPlayerPath('green'),
  yellow: buildPlayerPath('yellow')
}

// Path lengths
export const OUTER_RING_LENGTH = OUTER_RING.length  // 24
export const RING_1_LENGTH = RING_1.length          // 16
export const RING_2_LENGTH = RING_2.length          // 8
export const TOTAL_PATH_LENGTH = OUTER_RING_LENGTH + RING_1_LENGTH + RING_2_LENGTH + 1 // 49

// All path cells for rendering
export const ALL_PATH_CELLS: Position[] = [
  ...OUTER_RING,
  ...RING_1,
  ...RING_2,
  CENTER
]

// Safe spots: entry squares only
export const SAFE_POSITIONS: Position[] = [
  { row: 0, col: 3 }, { row: 3, col: 6 }, { row: 6, col: 3 }, { row: 3, col: 0 }
]

// Summon points: ring 1 corners (can be claimed for alternate entry)
export const SUMMON_POSITIONS: Position[] = [
  { row: 1, col: 1 }, { row: 1, col: 5 }, { row: 5, col: 1 }, { row: 5, col: 5 }
]

// Right-angled corner triangles marking spiral turn points
// Corner indicates which corner the triangle is in - hypotenuse POINTS toward spiral direction
// tl corner → points bottom-right | tr corner → points bottom-left
// bl corner → points top-right    | br corner → points top-left
type ArrowCorner = 'tl' | 'tr' | 'bl' | 'br'
type SpiralArrow = { position: Position; corner: ArrowCorner }

// Arrows in corner matching direction toward center
export const SPIRAL_ARROWS: Record<PlayerColor, SpiralArrow[]> = {
  // Red enters from top, moves toward bottom-left → bl corner
  red: [
    { position: { row: 0, col: 4 }, corner: 'bl' },
    { position: { row: 1, col: 4 }, corner: 'bl' },
    { position: { row: 2, col: 4 }, corner: 'bl' },
  ],
  // Blue enters from right, moves toward top-left → tl corner
  blue: [
    { position: { row: 4, col: 6 }, corner: 'tl' },  
    { position: { row: 4, col: 5 }, corner: 'tl' },  
    { position: { row: 4, col: 4 }, corner: 'tl' },  
  ],
  // Green enters from bottom, moves toward top-right → tr corner
  green: [
    { position: { row: 4, col: 2 }, corner: 'tr' }, 
    { position: { row: 5, col: 2 }, corner: 'tr' },  
    { position: { row: 6, col: 2 }, corner: 'tr' },  
  ],
  // Yellow enters from left, moves toward bottom-right → br corner
  yellow: [
    { position: { row: 2, col: 0 }, corner: 'br' },
    { position: { row: 2, col: 1 }, corner: 'br' },  
    { position: { row: 2, col: 2 }, corner: 'br' },  
  ]
}

export function isSafePosition(pos: Position): boolean {
  return SAFE_POSITIONS.some(s => s.row === pos.row && s.col === pos.col)
}

export function isSummonPosition(pos: Position): boolean {
  return SUMMON_POSITIONS.some(s => s.row === pos.row && s.col === pos.col)
}


export function isCenter(pos: Position): boolean {
  return pos.row === CENTER.row && pos.col === CENTER.col
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col
}

export function getPositionForPlayer(color: PlayerColor, pathIndex: number): Position | null {
  const path = PLAYER_PATHS[color]
  if (pathIndex < 0 || pathIndex >= path.length) return null
  return path[pathIndex]
}

export type CellType = 'empty' | 'path' | 'safe' | 'center' | 'entry' | 'summon'

export function getCellType(row: number, col: number): CellType {
  const pos = { row, col }
  if (isCenter(pos)) return 'center'

  const isOnPath = ALL_PATH_CELLS.some(p => p.row === row && p.col === col)
  if (!isOnPath) return 'empty'

  if (Object.values(ENTRY_POSITIONS).some(e => e.row === row && e.col === col)) {
    return 'entry'
  }

  if (isSafePosition(pos)) return 'safe'

  if (isSummonPosition(pos)) return 'summon'

  return 'path'
}


export function getEntryColor(row: number, col: number): PlayerColor | null {
  for (const [color, pos] of Object.entries(ENTRY_POSITIONS)) {
    if (pos.row === row && pos.col === col) return color as PlayerColor
  }
  return null
}

export function getSpiralArrows(row: number, col: number): { color: PlayerColor; corner: ArrowCorner }[] {
  const arrows: { color: PlayerColor; corner: ArrowCorner }[] = []
  for (const [color, entries] of Object.entries(SPIRAL_ARROWS)) {
    for (const entry of entries) {
      if (entry.position.row === row && entry.position.col === col) {
        arrows.push({ color: color as PlayerColor, corner: entry.corner })
      }
    }
  }
  return arrows
}

// V2: Adjacency helpers for Escort and Pusher abilities

/**
 * Get all valid adjacent positions on the board path (orthogonal + diagonal = 8 directions)
 */
export function getAdjacentPositions(pos: Position): Position[] {
  const deltas = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ]

  const adjacent: Position[] = []
  for (const [dr, dc] of deltas) {
    const newPos = { row: pos.row + dr, col: pos.col + dc }
    // Only include if it's a valid path cell
    if (ALL_PATH_CELLS.some(p => positionsEqual(p, newPos))) {
      adjacent.push(newPos)
    }
  }
  return adjacent
}

/**
 * Check if two positions are adjacent (including diagonals)
 */
export function areAdjacent(a: Position, b: Position): boolean {
  const rowDiff = Math.abs(a.row - b.row)
  const colDiff = Math.abs(a.col - b.col)
  // Adjacent if at most 1 step away in each direction (not same position)
  return rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0)
}

/**
 * Get the direction from one position to another (for push calculation)
 */
export function getDirection(from: Position, to: Position): { row: number; col: number } {
  return {
    row: Math.sign(to.row - from.row),
    col: Math.sign(to.col - from.col)
  }
}

/**
 * Get the position after pushing a piece away from the pusher
 */
export function getPushDestination(pusherPos: Position, targetPos: Position): Position | null {
  const direction = getDirection(pusherPos, targetPos)
  const destPos = {
    row: targetPos.row + direction.row,
    col: targetPos.col + direction.col
  }
  // Only valid if destination is on the path
  if (ALL_PATH_CELLS.some(p => positionsEqual(p, destPos))) {
    return destPos
  }
  return null // Can't push off the board
}

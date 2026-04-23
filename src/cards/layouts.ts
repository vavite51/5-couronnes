import { GRID_COLUMNS_X, GRID_ROWS_Y } from './constants';
import type { GridCellId, GridRowId } from './types';
import type {
  GridCoordinate,
  NumberCardLayout,
  NumberCardLayoutSlot,
  NumberLayoutRankId,
  SymbolOrientation,
  SymbolRotation,
} from './layout-types';

export const GRID_POSITIONS: Readonly<Record<GridCellId, GridCoordinate>> = {
  L1: { x: GRID_COLUMNS_X.L, y: GRID_ROWS_Y['1'] },
  C1: { x: GRID_COLUMNS_X.C, y: GRID_ROWS_Y['1'] },
  R1: { x: GRID_COLUMNS_X.R, y: GRID_ROWS_Y['1'] },
  L2: { x: GRID_COLUMNS_X.L, y: GRID_ROWS_Y['2'] },
  C2: { x: GRID_COLUMNS_X.C, y: GRID_ROWS_Y['2'] },
  R2: { x: GRID_COLUMNS_X.R, y: GRID_ROWS_Y['2'] },
  L3: { x: GRID_COLUMNS_X.L, y: GRID_ROWS_Y['3'] },
  C3: { x: GRID_COLUMNS_X.C, y: GRID_ROWS_Y['3'] },
  R3: { x: GRID_COLUMNS_X.R, y: GRID_ROWS_Y['3'] },
  L4: { x: GRID_COLUMNS_X.L, y: GRID_ROWS_Y['4'] },
  C4: { x: GRID_COLUMNS_X.C, y: GRID_ROWS_Y['4'] },
  R4: { x: GRID_COLUMNS_X.R, y: GRID_ROWS_Y['4'] },
  L5: { x: GRID_COLUMNS_X.L, y: GRID_ROWS_Y['5'] },
  C5: { x: GRID_COLUMNS_X.C, y: GRID_ROWS_Y['5'] },
  R5: { x: GRID_COLUMNS_X.R, y: GRID_ROWS_Y['5'] },
};

export const NUMBER_LAYOUT_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const satisfies readonly NumberLayoutRankId[];

const SYMBOL_SIZE_BY_RANK: Readonly<Record<NumberLayoutRankId, number>> = {
  A: 300,
  '2': 210,
  '3': 210,
  '4': 210,
  '5': 190,
  '6': 190,
  '7': 175,
  '8': 175,
  '9': 160,
  '10': 160,
};

const LAYOUT_SLOT_ORDER_BY_RANK: Readonly<Record<NumberLayoutRankId, readonly GridCellId[]>> = {
  A: ['C3'],
  '2': ['C1', 'C5'],
  '3': ['C1', 'C3', 'C5'],
  '4': ['L1', 'R1', 'L5', 'R5'],
  '5': ['L1', 'R1', 'C3', 'L5', 'R5'],
  '6': ['L1', 'R1', 'L3', 'R3', 'L5', 'R5'],
  '7': ['L1', 'R1', 'C2', 'L3', 'R3', 'L5', 'R5'],
  '8': ['L1', 'R1', 'L2', 'R2', 'L4', 'R4', 'L5', 'R5'],
  '9': ['L1', 'R1', 'L2', 'R2', 'C3', 'L4', 'R4', 'L5', 'R5'],
  '10': ['L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'L4', 'R4', 'L5', 'R5'],
};

function getRowFromSlot(slot: GridCellId): GridRowId {
  return slot[1] as GridRowId;
}

function getSlotOrientation(slot: GridCellId): SymbolOrientation {
  const row = getRowFromSlot(slot);
  if (row === '4' || row === '5') return 'rotated180';
  return 'normal';
}

function orientationToRotation(orientation: SymbolOrientation): SymbolRotation {
  return orientation === 'rotated180' ? 180 : 0;
}

function buildLayoutSlots(rank: NumberLayoutRankId): ReadonlyArray<NumberCardLayoutSlot> {
  return LAYOUT_SLOT_ORDER_BY_RANK[rank].map((slot) => {
    const orientation = getSlotOrientation(slot);
    return {
      slot,
      x: GRID_POSITIONS[slot].x,
      y: GRID_POSITIONS[slot].y,
      orientation,
      rotation: orientationToRotation(orientation),
    };
  });
}

export const NUMBER_CARD_LAYOUTS: Readonly<Record<NumberLayoutRankId, NumberCardLayout>> = {
  A: { rank: 'A', symbolSizePx: SYMBOL_SIZE_BY_RANK.A, slots: buildLayoutSlots('A') },
  '2': { rank: '2', symbolSizePx: SYMBOL_SIZE_BY_RANK['2'], slots: buildLayoutSlots('2') },
  '3': { rank: '3', symbolSizePx: SYMBOL_SIZE_BY_RANK['3'], slots: buildLayoutSlots('3') },
  '4': { rank: '4', symbolSizePx: SYMBOL_SIZE_BY_RANK['4'], slots: buildLayoutSlots('4') },
  '5': { rank: '5', symbolSizePx: SYMBOL_SIZE_BY_RANK['5'], slots: buildLayoutSlots('5') },
  '6': { rank: '6', symbolSizePx: SYMBOL_SIZE_BY_RANK['6'], slots: buildLayoutSlots('6') },
  '7': { rank: '7', symbolSizePx: SYMBOL_SIZE_BY_RANK['7'], slots: buildLayoutSlots('7') },
  '8': { rank: '8', symbolSizePx: SYMBOL_SIZE_BY_RANK['8'], slots: buildLayoutSlots('8') },
  '9': { rank: '9', symbolSizePx: SYMBOL_SIZE_BY_RANK['9'], slots: buildLayoutSlots('9') },
  '10': { rank: '10', symbolSizePx: SYMBOL_SIZE_BY_RANK['10'], slots: buildLayoutSlots('10') },
};

export function getNumberCardLayout(rank: NumberLayoutRankId): NumberCardLayout {
  return NUMBER_CARD_LAYOUTS[rank];
}

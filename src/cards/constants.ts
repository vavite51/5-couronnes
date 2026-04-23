import type {
  AceCardId,
  CardColor,
  CardPlacementPreset,
  GridCellId,
  GridColumnId,
  GridPositionDefinition,
  GridRowId,
  NumberCardId,
  NumberRankId,
  RankId,
  SuitId,
  SuitLabelFr,
  TwoCardId,
} from './types';

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades', 'stars'] as const satisfies readonly SuitId[];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const satisfies readonly RankId[];

export const NUMBER_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const satisfies readonly NumberRankId[];

export const SUIT_ORDER = SUITS;

export const RANK_ORDER = RANKS;

export const SUIT_LABELS_FR: Readonly<Record<SuitId, SuitLabelFr>> = {
  clubs: 'Trefle',
  diamonds: 'Carreau',
  hearts: 'Coeur',
  spades: 'Pique',
  stars: 'Etoile',
};

export const SUIT_COLORS: Readonly<Record<SuitId, CardColor>> = {
  clubs: '#1FA34A',
  diamonds: '#D9A300',
  hearts: '#D62828',
  spades: '#1A1A1A',
  stars: '#2F66E8',
};

export const FACE_RANKS = ['J', 'Q', 'K'] as const satisfies readonly RankId[];

export const GRID_COLUMN_ORDER = ['L', 'C', 'R'] as const satisfies readonly GridColumnId[];

export const GRID_ROW_ORDER = ['1', '2', '3', '4', '5'] as const satisfies readonly GridRowId[];

export const GRID_COLUMNS_X: Readonly<Record<GridColumnId, number>> = {
  L: 500,
  C: 750,
  R: 1000,
};

export const GRID_ROWS_Y: Readonly<Record<GridRowId, number>> = {
  '1': 520,
  '2': 780,
  '3': 1050,
  '4': 1320,
  '5': 1580,
};

export const GRID_POSITIONS: ReadonlyArray<GridPositionDefinition> = GRID_ROW_ORDER.flatMap((row, rowIndex) =>
  GRID_COLUMN_ORDER.map((column, columnIndex) => ({
    id: `${column}${row}` as const,
    column,
    row,
    x: GRID_COLUMNS_X[column],
    y: GRID_ROWS_Y[row],
    sortOrder: rowIndex * GRID_COLUMN_ORDER.length + columnIndex,
  }))
);

export const DEFAULT_CARD_SIZE_PX = 300;

export const DEFAULT_CARD_POSITION_CELL = 'C3' as const;

export const DEFAULT_CARD_PLACEMENT: Readonly<CardPlacementPreset> = {
  cellId: DEFAULT_CARD_POSITION_CELL,
  x: GRID_COLUMNS_X.C,
  y: GRID_ROWS_Y['3'],
  sizePx: DEFAULT_CARD_SIZE_PX,
};

export const ACE_CARD_IDS: ReadonlyArray<AceCardId> = SUITS.map((suit) => `${suit}_A` as AceCardId);

export const ACE_PLACEMENT: Readonly<CardPlacementPreset> = DEFAULT_CARD_PLACEMENT;

export const NUMBER_CARD_SIZES_PX: Readonly<Record<NumberRankId, number>> = {
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

export const NUMBER_CARD_POSITION_CELLS: Readonly<Record<NumberRankId, readonly GridCellId[]>> = {
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

function toGridPlacement(cellId: GridCellId, sizePx: number): CardPlacementPreset {
  const column = cellId[0] as GridColumnId;
  const row = cellId[1] as GridRowId;
  return {
    cellId,
    x: GRID_COLUMNS_X[column],
    y: GRID_ROWS_Y[row],
    sizePx,
  };
}

export const NUMBER_CARD_PLACEMENTS_BY_RANK: Readonly<Record<NumberRankId, ReadonlyArray<CardPlacementPreset>>> = {
  '2': NUMBER_CARD_POSITION_CELLS['2'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['2'])),
  '3': NUMBER_CARD_POSITION_CELLS['3'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['3'])),
  '4': NUMBER_CARD_POSITION_CELLS['4'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['4'])),
  '5': NUMBER_CARD_POSITION_CELLS['5'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['5'])),
  '6': NUMBER_CARD_POSITION_CELLS['6'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['6'])),
  '7': NUMBER_CARD_POSITION_CELLS['7'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['7'])),
  '8': NUMBER_CARD_POSITION_CELLS['8'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['8'])),
  '9': NUMBER_CARD_POSITION_CELLS['9'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['9'])),
  '10': NUMBER_CARD_POSITION_CELLS['10'].map((cellId) => toGridPlacement(cellId, NUMBER_CARD_SIZES_PX['10'])),
};

export const NUMBER_CARD_IDS_BY_RANK: Readonly<Record<NumberRankId, ReadonlyArray<NumberCardId>>> = {
  '2': SUITS.map((suit) => `${suit}_2` as NumberCardId),
  '3': SUITS.map((suit) => `${suit}_3` as NumberCardId),
  '4': SUITS.map((suit) => `${suit}_4` as NumberCardId),
  '5': SUITS.map((suit) => `${suit}_5` as NumberCardId),
  '6': SUITS.map((suit) => `${suit}_6` as NumberCardId),
  '7': SUITS.map((suit) => `${suit}_7` as NumberCardId),
  '8': SUITS.map((suit) => `${suit}_8` as NumberCardId),
  '9': SUITS.map((suit) => `${suit}_9` as NumberCardId),
  '10': SUITS.map((suit) => `${suit}_10` as NumberCardId),
};

export const TWO_CARD_IDS: ReadonlyArray<TwoCardId> = NUMBER_CARD_IDS_BY_RANK['2'] as ReadonlyArray<TwoCardId>;

export const TWO_CARD_SIZE_PX = NUMBER_CARD_SIZES_PX['2'];

export const TWO_CARD_POSITION_CELLS = NUMBER_CARD_POSITION_CELLS['2'];

export const TWO_CARD_PLACEMENTS: ReadonlyArray<CardPlacementPreset> = NUMBER_CARD_PLACEMENTS_BY_RANK['2'];

import {
  ACE_CARD_IDS,
  ACE_PLACEMENT,
  DEFAULT_CARD_PLACEMENT,
  FACE_RANKS,
  GRID_COLUMN_ORDER,
  GRID_COLUMNS_X,
  GRID_POSITIONS,
  GRID_ROW_ORDER,
  GRID_ROWS_Y,
  RANKS,
  NUMBER_CARD_IDS_BY_RANK,
  NUMBER_CARD_PLACEMENTS_BY_RANK,
  NUMBER_RANKS,
  SUIT_COLORS,
  SUIT_LABELS_FR,
  SUITS,
  TWO_CARD_IDS,
  TWO_CARD_PLACEMENTS,
} from './constants';
import type {
  AceCardId,
  CardDefinition,
  CardId,
  CardPlacementPreset,
  GridCellId,
  GridColumnId,
  GridPoint,
  GridPositionDefinition,
  GridRowId,
  NumberCardId,
  NumberRankId,
  RankId,
  SuitId,
  TwoCardId,
} from './types';

const FACE_RANK_SET = new Set<RankId>(FACE_RANKS);

function toAssetRank(rank: RankId): Lowercase<RankId> {
  return rank.toLowerCase() as Lowercase<RankId>;
}

export const FULL_DECK: ReadonlyArray<CardDefinition> = SUITS.flatMap((suit, suitIndex) =>
  RANKS.map((rank, rankIndex) => {
    const assetRank = toAssetRank(rank);
    const assetKey = `${suit}_${assetRank}` as const;

    return {
      id: `${suit}_${rank}` as CardId,
      suit,
      suitLabelFr: SUIT_LABELS_FR[suit],
      rank,
      color: SUIT_COLORS[suit],
      assetKey,
      assetFileName: `${assetKey}.png`,
      isFaceCard: FACE_RANK_SET.has(rank),
      sortOrder: suitIndex * RANKS.length + rankIndex,
    };
  })
);

const CARD_BY_ID = new Map<CardId, CardDefinition>(FULL_DECK.map((card) => [card.id, card]));
const GRID_POSITION_BY_ID = new Map<GridCellId, GridPositionDefinition>(
  GRID_POSITIONS.map((position) => [position.id, position])
);
const ACE_CARD_ID_SET = new Set<AceCardId>(ACE_CARD_IDS);
const TWO_CARD_ID_SET = new Set<TwoCardId>(TWO_CARD_IDS);
const NUMBER_CARD_ID_SET = new Set<NumberCardId>(NUMBER_RANKS.flatMap((rank) => NUMBER_CARD_IDS_BY_RANK[rank]));

export function getCardById(id: CardId): CardDefinition | undefined {
  return CARD_BY_ID.get(id);
}

export function getCardsBySuit(suit: SuitId): ReadonlyArray<CardDefinition> {
  return FULL_DECK.filter((card) => card.suit === suit);
}

export function getFaceCards(): ReadonlyArray<CardDefinition> {
  return FULL_DECK.filter((card) => card.isFaceCard);
}

export function getNumberCards(): ReadonlyArray<CardDefinition> {
  return FULL_DECK.filter((card) => !card.isFaceCard);
}

export function getAceCards(): ReadonlyArray<CardDefinition> {
  return FULL_DECK.filter((card) => card.rank === 'A');
}

export function getTwoCards(): ReadonlyArray<CardDefinition> {
  return FULL_DECK.filter((card) => card.rank === '2');
}

export function getNumberCardsByRank(rank: NumberRankId): ReadonlyArray<CardDefinition> {
  return FULL_DECK.filter((card) => card.rank === rank);
}

export function getGridPoint(column: GridColumnId, row: GridRowId): GridPoint {
  return {
    x: GRID_COLUMNS_X[column],
    y: GRID_ROWS_Y[row],
  };
}

export function getGridPositionById(id: GridCellId): GridPositionDefinition | undefined {
  return GRID_POSITION_BY_ID.get(id);
}

export function getAllGridPositions(): ReadonlyArray<GridPositionDefinition> {
  return GRID_POSITIONS;
}

export function getGridColumns(): ReadonlyArray<GridColumnId> {
  return GRID_COLUMN_ORDER;
}

export function getGridRows(): ReadonlyArray<GridRowId> {
  return GRID_ROW_ORDER;
}

export function getDefaultCardPlacement(): Readonly<CardPlacementPreset> {
  return DEFAULT_CARD_PLACEMENT;
}

export function isAceCardId(id: CardId): id is AceCardId {
  return ACE_CARD_ID_SET.has(id as AceCardId);
}

export function getAcePlacement(): Readonly<CardPlacementPreset> {
  return ACE_PLACEMENT;
}

export function isTwoCardId(id: CardId): id is TwoCardId {
  return TWO_CARD_ID_SET.has(id as TwoCardId);
}

export function getTwoCardPlacements(): ReadonlyArray<CardPlacementPreset> {
  return TWO_CARD_PLACEMENTS;
}

export function isNumberCardId(id: CardId): id is NumberCardId {
  return NUMBER_CARD_ID_SET.has(id as NumberCardId);
}

export function getNumberCardPlacements(rank: NumberRankId): ReadonlyArray<CardPlacementPreset> {
  return NUMBER_CARD_PLACEMENTS_BY_RANK[rank];
}

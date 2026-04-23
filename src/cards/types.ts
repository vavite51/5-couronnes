export type SuitId = 'clubs' | 'diamonds' | 'hearts' | 'spades' | 'stars';

export type RankId = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type CardId = `${SuitId}_${RankId}`;

export type AceCardId = `${SuitId}_A`;

export type TwoCardId = `${SuitId}_2`;

export type NumberRankId = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

export type NumberCardId = `${SuitId}_${NumberRankId}`;

export type CardColor = '#1FA34A' | '#D9A300' | '#D62828' | '#1A1A1A' | '#2F66E8';

export type SuitLabelFr = 'Trefle' | 'Carreau' | 'Coeur' | 'Pique' | 'Etoile';

export type AssetKey = `${SuitId}_${Lowercase<RankId>}`;

export type AssetFileName = `${AssetKey}.png`;

export type CardDefinition = {
  id: CardId;
  suit: SuitId;
  suitLabelFr: SuitLabelFr;
  rank: RankId;
  color: CardColor;
  assetKey: AssetKey;
  assetFileName: AssetFileName;
  isFaceCard: boolean;
  sortOrder: number;
};

export type GridColumnId = 'L' | 'C' | 'R';

export type GridRowId = '1' | '2' | '3' | '4' | '5';

export type GridCellId = `${GridColumnId}${GridRowId}`;

export type GridPoint = {
  x: number;
  y: number;
};

export type GridPositionDefinition = GridPoint & {
  id: GridCellId;
  column: GridColumnId;
  row: GridRowId;
  sortOrder: number;
};

export type CardPlacementPreset = {
  cellId: GridCellId;
  x: number;
  y: number;
  sizePx: number;
};

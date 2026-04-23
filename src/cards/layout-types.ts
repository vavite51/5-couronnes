import type { GridCellId } from './types';

export type NumberLayoutRankId = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

export type SymbolOrientation = 'normal' | 'rotated180';

export type SymbolRotation = 0 | 180;

export type GridCoordinate = {
  x: number;
  y: number;
};

export type NumberCardLayoutSlot = {
  slot: GridCellId;
  x: number;
  y: number;
  rotation: SymbolRotation;
  orientation: SymbolOrientation;
};

export type NumberCardLayout = {
  rank: NumberLayoutRankId;
  symbolSizePx: number;
  slots: ReadonlyArray<NumberCardLayoutSlot>;
};

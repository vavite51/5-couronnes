import type { CardColor, SuitId, SuitLabelFr } from './types';

export type FaceRankId = 'J' | 'Q' | 'K';

export type FaceCardId = `${SuitId}_${FaceRankId}`;

export type FaceAssetKey = `${SuitId}_${Lowercase<FaceRankId>}`;

export type FaceAssetFileName = `${FaceAssetKey}.png`;

export type BoundsRect = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type FaceSuitTheme =
  | 'nature royale, foret, croissance, lignee vegetale noble'
  | 'richesse, soleil, prestige, lignee doree'
  | 'noblesse, passion, guerre, cour royale flamboyante'
  | 'ombre, nuit, autorite, lignee severe et puissante'
  | 'celeste, magie, destin, lignee astrale';

export type FaceRankArchetype =
  | 'jeune champion / heritier / garde royal delite'
  | 'reine / souveraine / autorite elegante et puissante'
  | 'roi supreme / monarque / presence dominante';

export type OrnamentLevel = 'refined' | 'ornate' | 'majestic';

export type FrameAccent = 'emerald' | 'gold' | 'crimson' | 'obsidian' | 'azure';

export type FaceMobileReadabilitySpec = {
  centralCharacterScale: 'large';
  decorDensity: 'low';
  contrast: 'high';
  immediateReadability: 'required';
  cornerReadability: 'preserve';
  illustrationAvoidsCorners: true;
};

export type FaceCardSpec = {
  suit: SuitId;
  rank: FaceRankId;
  cardId: FaceCardId;
  suitLabelFr: SuitLabelFr;
  color: CardColor;
  titleFr: string;
  archetype: FaceRankArchetype;
  suitTheme: FaceSuitTheme;
  illustrationBounds: BoundsRect;
  illustrationSafeBounds: BoundsRect;
  ornamentLevel: OrnamentLevel;
  frameAccent: FrameAccent;
  mobileReadability: FaceMobileReadabilitySpec;
  characterPrompt: string;
  assetFileName: FaceAssetFileName;
};

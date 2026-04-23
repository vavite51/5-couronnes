import { SUIT_COLORS, SUIT_LABELS_FR, SUITS } from './constants';
import type { SuitId } from './types';
import type {
  BoundsRect,
  FaceAssetFileName,
  FaceCardId,
  FaceCardSpec,
  FaceMobileReadabilitySpec,
  FaceRankArchetype,
  FaceRankId,
  FaceSuitTheme,
  FrameAccent,
  OrnamentLevel,
} from './face-types';

export const FACE_RANKS = ['J', 'Q', 'K'] as const satisfies readonly FaceRankId[];

export const FACE_ILLUSTRATION_BOUNDS: Readonly<BoundsRect> = {
  xMin: 220,
  xMax: 1280,
  yMin: 260,
  yMax: 1840,
};

export const FACE_ILLUSTRATION_SAFE_BOUNDS: Readonly<BoundsRect> = {
  xMin: 280,
  xMax: 1220,
  yMin: 340,
  yMax: 1760,
};

export const FACE_SUIT_THEMES: Readonly<Record<SuitId, FaceSuitTheme>> = {
  clubs: 'nature royale, foret, croissance, lignee vegetale noble',
  diamonds: 'richesse, soleil, prestige, lignee doree',
  hearts: 'noblesse, passion, guerre, cour royale flamboyante',
  spades: 'ombre, nuit, autorite, lignee severe et puissante',
  stars: 'celeste, magie, destin, lignee astrale',
};

export const FACE_RANK_ARCHETYPES: Readonly<Record<FaceRankId, FaceRankArchetype>> = {
  J: 'jeune champion / heritier / garde royal delite',
  Q: 'reine / souveraine / autorite elegante et puissante',
  K: 'roi supreme / monarque / presence dominante',
};

const FACE_RANK_TITLE_FR: Readonly<Record<FaceRankId, string>> = {
  J: 'Valet',
  Q: 'Reine',
  K: 'Roi',
};

const FACE_RANK_PROMPT_EN: Readonly<Record<FaceRankId, string>> = {
  J: 'young royal champion heir, elite palace guard',
  Q: 'sovereign queen, elegant and powerful authority',
  K: 'supreme king, dominant monarch presence',
};

const FACE_SUIT_PROMPT_EN: Readonly<Record<SuitId, string>> = {
  clubs: 'clubs suit, green palette, royal nature, forest legacy, noble botanical lineage',
  diamonds: 'diamonds suit, gold palette, wealth, sunlight prestige, golden dynasty',
  hearts: 'hearts suit, red palette, nobility, passion, royal war court',
  spades: 'spades suit, black palette, shadow, night authority, severe powerful lineage',
  stars: 'stars suit, blue palette, celestial magic, fate, astral lineage',
};

const FACE_FRAME_ACCENTS: Readonly<Record<SuitId, FrameAccent>> = {
  clubs: 'emerald',
  diamonds: 'gold',
  hearts: 'crimson',
  spades: 'obsidian',
  stars: 'azure',
};

const FACE_ORNAMENT_LEVELS: Readonly<Record<FaceRankId, OrnamentLevel>> = {
  J: 'refined',
  Q: 'ornate',
  K: 'majestic',
};

export const FACE_MOBILE_STYLE_RULES: Readonly<FaceMobileReadabilitySpec> = {
  centralCharacterScale: 'large',
  decorDensity: 'low',
  contrast: 'high',
  immediateReadability: 'required',
  cornerReadability: 'preserve',
  illustrationAvoidsCorners: true,
};

const GLOBAL_FACE_PROMPT_STYLE =
  'premium fantasy playing card character, centered composition, front-facing card illustration, elegant royal design, high readability, mobile game asset, polished details, strong silhouette, clean background inside the card, no extra scene outside the card, no mockup, no hand, no table, no perspective distortion';

function buildFaceCharacterPrompt(suit: SuitId, rank: FaceRankId): string {
  return [
    `Playing card ${rank} of ${suit}.`,
    FACE_RANK_PROMPT_EN[rank] + '.',
    FACE_SUIT_PROMPT_EN[suit] + '.',
    `Primary color accent ${SUIT_COLORS[suit]}.`,
    GLOBAL_FACE_PROMPT_STYLE + '.',
  ].join(' ');
}

export const FACE_CARD_SPECS: ReadonlyArray<FaceCardSpec> = SUITS.flatMap((suit) =>
  FACE_RANKS.map((rank) => {
    const cardId = `${suit}_${rank}` as FaceCardId;
    const assetFileName = `${suit}_${rank.toLowerCase()}.png` as FaceAssetFileName;
    return {
      suit,
      rank,
      cardId,
      suitLabelFr: SUIT_LABELS_FR[suit],
      color: SUIT_COLORS[suit],
      titleFr: `${FACE_RANK_TITLE_FR[rank]} de ${SUIT_LABELS_FR[suit]}`,
      archetype: FACE_RANK_ARCHETYPES[rank],
      suitTheme: FACE_SUIT_THEMES[suit],
      illustrationBounds: FACE_ILLUSTRATION_BOUNDS,
      illustrationSafeBounds: FACE_ILLUSTRATION_SAFE_BOUNDS,
      ornamentLevel: FACE_ORNAMENT_LEVELS[rank],
      frameAccent: FACE_FRAME_ACCENTS[suit],
      mobileReadability: FACE_MOBILE_STYLE_RULES,
      characterPrompt: buildFaceCharacterPrompt(suit, rank),
      assetFileName,
    };
  })
);

const FACE_CARD_SPECS_BY_ID = new Map<FaceCardId, FaceCardSpec>(
  FACE_CARD_SPECS.map((spec) => [spec.cardId, spec])
);

export function getFaceCardSpec(cardId: FaceCardId): FaceCardSpec | undefined {
  return FACE_CARD_SPECS_BY_ID.get(cardId);
}

export function getFaceCardSpecsBySuit(suit: SuitId): ReadonlyArray<FaceCardSpec> {
  return FACE_CARD_SPECS.filter((spec) => spec.suit === suit);
}

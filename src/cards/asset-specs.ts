import { FULL_DECK } from './deck';
import { SUITS } from './constants';
import { getFaceCardSpec } from './face-specs';
import { getNumberCardLayout } from './layouts';
import type { NumberLayoutRankId } from './layout-types';
import type { CardId, RankId, SuitId } from './types';
import type {
  CardAssetChecklistItem,
  CardAssetSpec,
  CardPromptType,
  CardTemplateType,
} from './asset-types';

const CARD_IMAGE_WIDTH = 1500 as const;
const CARD_IMAGE_HEIGHT = 2100 as const;
const CARD_IMAGE_FORMAT = 'png' as const;
const CARD_IMAGE_RATIO = '5:7' as const;
const DEFAULT_PRODUCTION_STATUS = 'pending' as const;
const EXPECTED_CARD_ASSET_COUNT = 65;
const EXPECTED_CARDS_PER_SUIT = 13;

const NUMBER_LAYOUT_RANK_SET = new Set<RankId>(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

function isNumberLayoutRank(rank: RankId): rank is NumberLayoutRankId {
  return NUMBER_LAYOUT_RANK_SET.has(rank);
}

function buildNumberCardPrompt(card: (typeof FULL_DECK)[number]): string {
  if (!isNumberLayoutRank(card.rank)) {
    throw new Error(`Numeric layout missing for rank ${card.rank} on card ${card.id}`);
  }
  const layout = getNumberCardLayout(card.rank);
  const slotTokens = layout.slots.map((slot) => slot.slot).join(', ');

  return [
    'custom playing card, single front-facing card, premium clean design, strong readability for mobile.',
    `Card: ${card.rank} of ${card.suit}.`,
    `Suit color: ${card.color}.`,
    `Centered suit layout based on official numeric layout: size ${layout.symbolSizePx}px, slots [${slotTokens}].`,
    'No character illustration, no extra scene, no mockup, no hand, no table, no perspective distortion.',
    'Transparent background forbidden unless explicitly handled elsewhere.',
    'Final card asset ready for mobile game integration.',
  ].join(' ');
}

function buildFaceCardPrompt(card: (typeof FULL_DECK)[number]): string {
  const faceSpec = getFaceCardSpec(card.id as `${SuitId}_J` | `${SuitId}_Q` | `${SuitId}_K`);
  if (!faceSpec) {
    throw new Error(`Face specification missing for card ${card.id}`);
  }

  return [
    'custom fantasy playing card, single front-facing card, premium royal character illustration.',
    'Centered composition, strong readability for mobile.',
    `Card: ${card.rank} of ${card.suit}.`,
    `Family theme respected: ${faceSpec.suitTheme}.`,
    `Rank archetype respected: ${faceSpec.archetype}.`,
    'Elegant frame.',
    'No extra scene outside the card, no mockup, no hand, no table, no perspective distortion.',
    'Final card asset ready for mobile game integration.',
  ].join(' ');
}

function resolveTemplateType(isFaceCard: boolean): CardTemplateType {
  return isFaceCard ? 'face_card' : 'number_card';
}

function resolvePromptType(isFaceCard: boolean): CardPromptType {
  return isFaceCard ? 'face_prompt' : 'number_prompt';
}

function buildProductionPrompt(card: (typeof FULL_DECK)[number]): string {
  return card.isFaceCard ? buildFaceCardPrompt(card) : buildNumberCardPrompt(card);
}

export const CARD_ASSET_SPECS: ReadonlyArray<CardAssetSpec> = FULL_DECK.map((card) => ({
  cardId: card.id,
  suit: card.suit,
  rank: card.rank,
  suitLabelFr: card.suitLabelFr,
  color: card.color,
  assetKey: card.assetKey,
  assetFileName: card.assetFileName,
  templateType: resolveTemplateType(card.isFaceCard),
  isFaceCard: card.isFaceCard,
  promptType: resolvePromptType(card.isFaceCard),
  productionStatus: DEFAULT_PRODUCTION_STATUS,
  productionPrompt: buildProductionPrompt(card),
  width: CARD_IMAGE_WIDTH,
  height: CARD_IMAGE_HEIGHT,
  format: CARD_IMAGE_FORMAT,
  ratioLabel: CARD_IMAGE_RATIO,
}));

if (CARD_ASSET_SPECS.length !== EXPECTED_CARD_ASSET_COUNT) {
  throw new Error(`Invalid card asset specs count: expected ${EXPECTED_CARD_ASSET_COUNT}, got ${CARD_ASSET_SPECS.length}`);
}

export const CARD_ASSET_SUIT_COUNTS: Readonly<Record<SuitId, number>> = (() => {
  const counts = Object.fromEntries(SUITS.map((suit) => [suit, 0])) as Record<SuitId, number>;
  for (const spec of CARD_ASSET_SPECS) {
    counts[spec.suit] += 1;
  }
  for (const suit of SUITS) {
    if (counts[suit] !== EXPECTED_CARDS_PER_SUIT) {
      throw new Error(
        `Invalid asset count for suit ${suit}: expected ${EXPECTED_CARDS_PER_SUIT}, got ${counts[suit]}`
      );
    }
  }
  return counts;
})();

const CARD_ASSET_SPEC_BY_ID = new Map<CardId, CardAssetSpec>(
  CARD_ASSET_SPECS.map((spec) => [spec.cardId, spec])
);

export const CARD_ASSET_CHECKLIST: ReadonlyArray<CardAssetChecklistItem> = CARD_ASSET_SPECS.map((spec) => ({
  cardId: spec.cardId,
  assetFileName: spec.assetFileName,
  templateType: spec.templateType,
  productionStatus: spec.productionStatus,
}));

export const CARD_ASSET_CHECKLIST_JSON: string = JSON.stringify(CARD_ASSET_CHECKLIST, null, 2);

export function getCardAssetSpec(cardId: CardId): CardAssetSpec | undefined {
  return CARD_ASSET_SPEC_BY_ID.get(cardId);
}

export function getPendingCardAssets(): ReadonlyArray<CardAssetSpec> {
  return CARD_ASSET_SPECS.filter((spec) => spec.productionStatus === 'pending');
}

export function getCardAssetsByTemplateType(templateType: CardTemplateType): ReadonlyArray<CardAssetSpec> {
  return CARD_ASSET_SPECS.filter((spec) => spec.templateType === templateType);
}

export function getCardAssetsBySuit(suit: SuitId): ReadonlyArray<CardAssetSpec> {
  return CARD_ASSET_SPECS.filter((spec) => spec.suit === suit);
}

export function getCardAssetsChecklist(): ReadonlyArray<CardAssetChecklistItem> {
  return CARD_ASSET_CHECKLIST;
}

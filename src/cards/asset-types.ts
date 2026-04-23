import type { AssetFileName, AssetKey, CardColor, CardId, RankId, SuitId, SuitLabelFr } from './types';

export type CardTemplateType = 'number_card' | 'face_card';

export type CardPromptType = 'number_prompt' | 'face_prompt';

export type CardProductionStatus = 'pending' | 'in_progress' | 'done';

export type CardAssetFormat = 'png';

export type CardAssetRatioLabel = '5:7';

export type CardAssetSpec = {
  cardId: CardId;
  suit: SuitId;
  rank: RankId;
  suitLabelFr: SuitLabelFr;
  color: CardColor;
  assetKey: AssetKey;
  assetFileName: AssetFileName;
  templateType: CardTemplateType;
  isFaceCard: boolean;
  promptType: CardPromptType;
  productionStatus: CardProductionStatus;
  productionPrompt: string;
  width: 1500;
  height: 2100;
  format: CardAssetFormat;
  ratioLabel: CardAssetRatioLabel;
};

export type CardAssetChecklistItem = {
  cardId: CardId;
  assetFileName: AssetFileName;
  templateType: CardTemplateType;
  productionStatus: CardProductionStatus;
};

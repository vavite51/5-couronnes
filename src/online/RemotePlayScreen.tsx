import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type Card = {
  id: string;
  suit: 'stars' | 'hearts' | 'clubs' | 'diamonds' | 'spades' | null;
  rank: number | null;
  joker: boolean;
};

type PlayerSnapshot = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
  totalScore: number;
  handCount: number;
  visibleHand: Card[];
};

type RoundResult = {
  winnerId: string;
  penalties: { playerId: string; value: number }[];
};

type ExposedMeldEntry = {
  playerId: string;
  melds: Card[][];
  deadwood: Card[];
  penalty: number | null;
};

type RoundRevealEntry = {
  playerId: string;
  melds: Card[][];
  deadwood: Card[];
  penalty: number;
};

type RoomSnapshot = {
  roomCode: string;
  phase: 'lobby' | 'inRound' | 'roundEnded' | 'gameOver';
  roundNumber: number;
  wildRank: number;
  maxRounds: number;
  hostPlayerId: string;
  youPlayerId: string;
  players: PlayerSnapshot[];
  currentPlayerId: string | null;
  dealerPlayerId?: string | null;
  shufflerPlayerId?: string | null;
  turnStage: 'draw' | 'discard' | null;
  turnSecondsLeft: number;
  drawPileCount: number;
  discardTop: Card | null;
  myHand: Card[];
  lastRound: RoundResult | null;
  exposedByPlayerId?: string | null;
  validatedExposePlayerId?: string | null;
  canValidateMelds?: boolean;
  lastTurnsRemaining?: number;
  discardPickupPlayerId?: string | null;
  exposedMelds?: ExposedMeldEntry[];
  roundReveal?: RoundRevealEntry[];
  joinHints: string[];
  lastDebugEvent: string;
};

type ServerMessage =
  | { type: 'snapshot'; payload: RoomSnapshot }
  | { type: 'info'; message: string }
  | { type: 'error'; message: string };

type Percent = `${number}%`;
type SeatLayout = {
  top: number;
  left: number;
  offsetX: number;
  offsetY: number;
};
type DropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ThemeKey = 'noir-or' | 'ivoire-bordeaux' | 'emeraude' | 'rose-luxe';
type EntryPlayMode = 'solo' | 'multi_internet' | 'multi_local';
type UiPage = 'mode' | 'connect' | 'table';
type ThemePalette = {
  name: string;
  statusBar: 'light' | 'dark';
  screenBg: string;
  cardBg: string;
  cardBorder: string;
  title: string;
  text: string;
  sub: string;
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  danger: string;
  dangerText: string;
  inputBg: string;
  inputBorder: string;
  overlay: string;
  tableFelt: string;
  tableRimOuter: string;
  tableRimInner: string;
  tableFeltBorder: string;
};

const DEFAULT_SERVER_PORT = 8787;
const DEFAULT_SERVER_URL_FALLBACK = `ws://127.0.0.1:${DEFAULT_SERVER_PORT}`;
const CARD_BACK_IMAGE = require('../../assets/cards/rgamers_black_gold_transparent.png');
const TABLE_BACKGROUND_IMAGE = require('../../assets/cards/rgamers_table_violett.png');
const INTERNET_SERVER_URL_PLACEHOLDER = 'wss://ton-serveur.example/ws';
const SOLO_DEFAULT_NAME = 'Joueur';

const resolveDefaultServerUrl = (): string => {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return DEFAULT_SERVER_URL_FALLBACK;
  }
  return `ws://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
};

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();
const MAX_SEATS = 7;
const CARD_VISUAL_SCALE = 1.2;
const resolveAssetSourceMaybe = (Image as unknown as {
  resolveAssetSource?: (source: unknown) => { width?: number; height?: number } | null;
}).resolveAssetSource;
const TABLE_BG_SOURCE = resolveAssetSourceMaybe ? resolveAssetSourceMaybe(TABLE_BACKGROUND_IMAGE) : null;
const TABLE_BG_SOURCE_WIDTH = TABLE_BG_SOURCE?.width ?? 2048;
const TABLE_BG_SOURCE_HEIGHT = TABLE_BG_SOURCE?.height ?? 2048;
const TABLE_FELT_SOURCE_BOUNDS = {
  x: 220,
  y: 610,
  width: 1608,
  height: 852,
};
const TABLE_BG_VISIBLE_BOUNDS = {
  x: 47,
  y: 471,
  width: 1954,
  height: 1058,
};
// Limite d'affichage visuel des cartes adverses (la logique serveur reste inchangée).
const OPPONENT_BACKS_PREVIEW_MAX = 3;
const OPPONENT_BACKS_PREVIEW_ACTIVE_BONUS = 1;
const APP_VERSION = (require('../../app.json')?.expo?.version as string | undefined) ?? '1.0.0';
const BUILD_MARKER = 'BUILD-2026-04-22-A';
const DEBUG_UI_ENABLED = false;
const TABLE_RESPONSIVE_REF_WIDTH = 915;
const TABLE_RESPONSIVE_REF_HEIGHT = 515;
const THEMES: Record<ThemeKey, ThemePalette> = {
  'noir-or': {
    name: 'Noir / Or',
    statusBar: 'light',
    screenBg: '#050B19',
    cardBg: '#0F1B34',
    cardBorder: '#71572A',
    title: '#EACB8A',
    text: '#F3E6C6',
    sub: '#C9B17C',
    primary: '#C0891A',
    primaryText: '#111827',
    secondary: '#24385F',
    secondaryText: '#F3E6C6',
    danger: '#4A1C1C',
    dangerText: '#FECACA',
    inputBg: '#1A2A4A',
    inputBorder: '#7A5E2E',
    overlay: 'rgba(2,6,23,0.72)',
    tableFelt: '#0B5A35',
    tableRimOuter: '#9CA3AF',
    tableRimInner: '#3F4754',
    tableFeltBorder: '#14B867',
  },
  'ivoire-bordeaux': {
    name: 'Ivoire / Bordeaux',
    statusBar: 'dark',
    screenBg: '#EFE6DE',
    cardBg: '#FFFCF7',
    cardBorder: '#D8C3B8',
    title: '#6D2A2A',
    text: '#3A2724',
    sub: '#8B5A52',
    primary: '#7F1F2A',
    primaryText: '#FFF6EF',
    secondary: '#E9DDD2',
    secondaryText: '#4D2E2A',
    danger: '#FEE2E2',
    dangerText: '#991B1B',
    inputBg: '#FCF5ED',
    inputBorder: '#D8C3B8',
    overlay: 'rgba(51,23,20,0.38)',
    tableFelt: '#0C7A45',
    tableRimOuter: '#CEC3BA',
    tableRimInner: '#73655F',
    tableFeltBorder: '#29A566',
  },
  emeraude: {
    name: 'Emeraude',
    statusBar: 'dark',
    screenBg: '#0F4336',
    cardBg: '#F8FFFC',
    cardBorder: '#B8D9CB',
    title: '#153B31',
    text: '#163C32',
    sub: '#2B5C4D',
    primary: '#0E7490',
    primaryText: '#FFFFFF',
    secondary: '#DFEFE8',
    secondaryText: '#1F3B33',
    danger: '#FEE2E2',
    dangerText: '#991B1B',
    inputBg: '#FFFFFF',
    inputBorder: '#B8D9CB',
    overlay: 'rgba(12,30,25,0.45)',
    tableFelt: '#04673B',
    tableRimOuter: '#9CA3AF',
    tableRimInner: '#3F4754',
    tableFeltBorder: '#14B867',
  },
  'rose-luxe': {
    name: 'Rose Luxe',
    statusBar: 'dark',
    screenBg: '#FFE4EE',
    cardBg: '#FFF4FA',
    cardBorder: '#F9A8D4',
    title: '#9D174D',
    text: '#831843',
    sub: '#BE185D',
    primary: '#EC4899',
    primaryText: '#FFFFFF',
    secondary: '#FBCFE8',
    secondaryText: '#831843',
    danger: '#FEE2E2',
    dangerText: '#991B1B',
    inputBg: '#FFFFFF',
    inputBorder: '#F9A8D4',
    overlay: 'rgba(122,40,72,0.35)',
    tableFelt: '#147A4E',
    tableRimOuter: '#D4B6C8',
    tableRimInner: '#7A556A',
    tableFeltBorder: '#33C082',
  },
};
const THEME_KEYS: ThemeKey[] = ['noir-or', 'ivoire-bordeaux', 'emeraude', 'rose-luxe'];

function normalizeWebSocketUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  return `ws://${trimmed}`;
}

function isLikelyLocalWsUrl(url: string): boolean {
  return /^(ws:\/\/)(127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(url.trim());
}

function rankLabel(rank: number | null): string {
  if (rank === null) return '?';
  if (rank >= 3 && rank <= 10) return String(rank);
  if (rank === 11) return 'V';
  if (rank === 12) return 'D';
  if (rank === 13) return 'R';
  return String(rank);
}

function suitShort(suit: Card['suit']): string {
  if (suit === 'stars') return 'ETOILE';
  if (suit === 'hearts') return 'COEUR';
  if (suit === 'clubs') return 'TREFLE';
  if (suit === 'diamonds') return 'CARREAU';
  if (suit === 'spades') return 'PIQUE';
  return 'AUCUNE';
}

function suitGlyph(suit: Card['suit']): string {
  if (suit === 'stars') return '\u2605';
  if (suit === 'hearts') return '\u2665';
  if (suit === 'clubs') return '\u2663';
  if (suit === 'diamonds') return '\u2666';
  if (suit === 'spades') return '\u2660';
  return '?';
}

function playerInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0]?.toUpperCase() ?? '?';
}

function suitTone(suit: Card['suit']): string {
  if (suit === 'diamonds') return '#D9A300';
  if (suit === 'hearts') return '#D62828';
  if (suit === 'stars') return '#2F66E8';
  if (suit === 'spades') return '#1A1A1A';
  if (suit === 'clubs') return '#1FA34A';
  return '#334155';
}

function cardLabel(card: Card): string {
  if (card.joker) return 'Joker';
  return `${rankLabel(card.rank)} ${suitShort(card.suit)}`;
}

function roomCodeToInput(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
}

function orderedPlayersForSeats(snapshot: RoomSnapshot, seatCount: number): (PlayerSnapshot | null)[] {
  const players = snapshot.players.slice(0, MAX_SEATS).filter((p) => p.connected);
  const yourIndex = players.findIndex((p) => p.id === snapshot.youPlayerId);
  const rotated = yourIndex > 0 ? [...players.slice(yourIndex), ...players.slice(0, yourIndex)] : players;
  return Array.from({ length: seatCount }, (_, i) => rotated[i] ?? null);
}

function getSeatLayouts(seatCount: number): SeatLayout[] {
  const safeCount = Math.max(0, Math.min(MAX_SEATS, seatCount));
  if (safeCount === 0) return [];

  const p = (left: number, top: number): SeatLayout => ({ left, top, offsetX: 0, offsetY: 0 });

  // Layouts fixes calques sur ton schema: joueur local en bas-centre,
  // adversaires repartis autour du bord sans se toucher.
  const byTotalPlayers: Record<number, SeatLayout[]> = {
    1: [p(50, 94)],
    2: [p(50, 94), p(50, 6)],
    3: [p(50, 94), p(5, 45), p(95, 45)],
    4: [p(50, 94), p(5, 45), p(50, 6), p(95, 45)],
    5: [p(50, 94), p(95, 45), p(5, 45), p(30, 0), p(70, 0)],
    6: [p(50, 94), p(16, 90), p(5, 45), p(30, 0), p(70, 0), p(95, 45)],
    7: [p(50, 94), p(16, 90), p(5, 45), p(30, 0), p(70, 0), p(95, 45), p(84, 90)],
  };

  return byTotalPlayers[safeCount] ?? byTotalPlayers[7];
}

function buildOrderedHand(cards: Card[], orderedIds: string[]): Card[] {
  if (!cards.length) return [];
  if (!orderedIds.length) return cards.slice();

  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered: Card[] = [];

  for (const id of orderedIds) {
    const card = byId.get(id);
    if (card) {
      ordered.push(card);
      byId.delete(id);
    }
  }

  for (const card of cards) {
    if (byId.has(card.id)) {
      ordered.push(card);
    }
  }

  return ordered;
}

function computeReorderShift(dx: number, step: number): number {
  const deadZone = step * 0.22;
  if (Math.abs(dx) <= deadZone) return 0;
  const adjustedDx = dx - Math.sign(dx) * deadZone;
  return Math.round(adjustedDx / step);
}

function suitSortIndex(suit: Card['suit']): number {
  if (suit === 'clubs') return 0;
  if (suit === 'diamonds') return 1;
  if (suit === 'hearts') return 2;
  if (suit === 'spades') return 3;
  if (suit === 'stars') return 4;
  return 99;
}

function rankSortValueAscending(rank: Card['rank']): number {
  if (rank === null) return 99;
  if (rank === 1) return 1;
  if (rank === 2) return 2;
  return rank;
}

function rankSortValueDescending(rank: Card['rank']): number {
  const asc = rankSortValueAscending(rank);
  return asc >= 99 ? -1 : asc;
}

function sortCardsByFamily(cards: Card[]): Card[] {
  const sorted = cards.slice().sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? 1 : -1;
    const suitDiff = suitSortIndex(a.suit) - suitSortIndex(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankSortValueAscending(a.rank) - rankSortValueAscending(b.rank);
  });
  return sorted;
}

function sortCardsByTierces(cards: Card[]): Card[] {
  const naturalCards = cards.filter((card) => !card.joker);
  const jokers = cards.filter((card) => card.joker);

  const groups = new Map<number, Card[]>();
  for (const card of naturalCards) {
    if (card.rank === null) continue;
    const current = groups.get(card.rank) ?? [];
    current.push(card);
    groups.set(card.rank, current);
  }

  const groupedByAscendingRank = Array.from(groups.entries())
    .map(([rank, rankCards]) => ({
      rank,
      cards: rankCards.slice().sort((a, b) => suitSortIndex(a.suit) - suitSortIndex(b.suit)),
    }))
    .sort((a, b) => rankSortValueAscending(a.rank) - rankSortValueAscending(b.rank));

  const orderedNaturals = groupedByAscendingRank.flatMap((entry) => entry.cards);
  return [...orderedNaturals, ...jokers];
}

function sortCardsWithLockedSelection(
  cards: Card[],
  selectedCardIds: string[],
  sorter: (cards: Card[]) => Card[]
): Card[] {
  if (!cards.length) return cards;
  const selectedSet = new Set(selectedCardIds);
  const hasLockedCards = cards.some((card) => selectedSet.has(card.id));
  if (!hasLockedCards) return sorter(cards);

  const unlockedCards = cards.filter((card) => !selectedSet.has(card.id));
  const sortedUnlocked = sorter(unlockedCards);
  let unlockedIndex = 0;
  return cards.map((card) => {
    if (selectedSet.has(card.id)) return card;
    const next = sortedUnlocked[unlockedIndex];
    unlockedIndex += 1;
    return next ?? card;
  });
}

function computeReorderShiftWorklet(dx: number, step: number): number {
  'worklet';
  const deadZone = step * 0.22;
  if (Math.abs(dx) <= deadZone) return 0;
  const adjustedDx = dx - Math.sign(dx) * deadZone;
  return Math.round(adjustedDx / step);
}

function clampIndexWorklet(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

type HandDragFinalizePayload = {
  cardId: string;
  fromIndex: number;
  translationX: number;
  translationY: number;
  absoluteX: number;
  absoluteY: number;
  movedEnough: boolean;
};

type DraggableHandCardProps = {
  card: Card;
  stackIndex: number;
  cardCount: number;
  selected: boolean;
  cardWidth: number;
  cardHeight: number;
  dragStep: number;
  fanOffsetX: number;
  fanOffsetY: number;
  fanRotationDeg: number;
  fanZIndex: number;
  rankFontSize: number;
  suitFontSize: number;
  canDragToDiscard: boolean;
  canReorderInHand: boolean;
  dragFromIndex: SharedValue<number>;
  dragTargetIndex: SharedValue<number>;
  onDragFinalize: (payload: HandDragFinalizePayload) => void;
};

const DraggableHandCard = memo(function DraggableHandCard({
  card,
  stackIndex,
  cardCount,
  selected,
  cardWidth,
  cardHeight,
  dragStep,
  fanOffsetX,
  fanOffsetY,
  fanRotationDeg,
  fanZIndex,
  rankFontSize,
  suitFontSize,
  canDragToDiscard,
  canReorderInHand,
  dragFromIndex,
  dragTargetIndex,
  onDragFinalize,
}: DraggableHandCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canDragToDiscard || canReorderInHand)
        .onBegin(() => {
          translateX.value = 0;
          translateY.value = 0;
          dragFromIndex.value = stackIndex;
          dragTargetIndex.value = stackIndex;
        })
        .onUpdate((event) => {
          if (!canDragToDiscard && !canReorderInHand) return;
          translateX.value = event.translationX;
          translateY.value = event.translationY;
          if (canReorderInHand) {
            const step = Math.max(12, dragStep);
            const shift = computeReorderShiftWorklet(event.translationX, step);
            const previewIndex = clampIndexWorklet(stackIndex + shift, 0, cardCount - 1);
            dragTargetIndex.value = previewIndex;
          } else {
            dragTargetIndex.value = stackIndex;
          }
        })
        .onFinalize((event) => {
          const movedEnough = Math.abs(event.translationX) + Math.abs(event.translationY) > 10;
          translateX.value = withTiming(0, { duration: 90 });
          translateY.value = withTiming(0, { duration: 90 });
          dragFromIndex.value = -1;
          dragTargetIndex.value = -1;
          runOnJS(onDragFinalize)({
            cardId: card.id,
            fromIndex: stackIndex,
            translationX: event.translationX,
            translationY: event.translationY,
            absoluteX: event.absoluteX,
            absoluteY: event.absoluteY,
            movedEnough,
          });
        }),
    [
      canDragToDiscard,
      canReorderInHand,
      card.id,
      cardCount,
      dragFromIndex,
      dragStep,
      dragTargetIndex,
      onDragFinalize,
      stackIndex,
      translateX,
      translateY,
    ]
  );

  const animatedWrapStyle = useAnimatedStyle(
    () => {
      const fromIndex = dragFromIndex.value;
      const toIndex = dragTargetIndex.value;
      const isDraggingCard = fromIndex >= 0 && fromIndex === stackIndex;
      let neighborOffsetX = 0;
      let neighborOffsetY = 0;
      let neighborRotation = 0;

      if (!isDraggingCard && fromIndex >= 0 && toIndex >= 0) {
        const movingRight = fromIndex < toIndex;
        const inShiftCorridor = movingRight
          ? stackIndex > fromIndex && stackIndex <= toIndex
          : stackIndex >= toIndex && stackIndex < fromIndex;
        if (inShiftCorridor) {
          const distanceToInsertion = Math.abs(stackIndex - toIndex);
          const influence = Math.max(0, 1 - distanceToInsertion * 0.45);
          if (influence > 0) {
            const direction = movingRight ? -1 : 1;
            neighborOffsetX = direction * 10 * influence;
            neighborOffsetY = 2 * influence;
            neighborRotation = direction * 1.2 * influence;
          }
        }
      }

      const dragX = isDraggingCard ? translateX.value : 0;
      const dragY = isDraggingCard ? translateY.value : 0;
      return {
        zIndex: isDraggingCard ? 1000 : fanZIndex,
        transform: [
          { translateX: fanOffsetX + neighborOffsetX + dragX },
          { translateY: fanOffsetY + neighborOffsetY + dragY },
          { rotate: `${fanRotationDeg + neighborRotation}deg` },
        ],
      };
    },
    [fanOffsetX, fanOffsetY, fanRotationDeg, fanZIndex, stackIndex]
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.handCardWrap,
          {
            width: cardWidth,
            height: cardHeight,
            marginLeft: -Math.round(cardWidth / 2),
          },
          animatedWrapStyle,
        ]}
      >
        <View
          style={[
            styles.handCardCasino,
            { width: cardWidth, height: cardHeight },
            selected && styles.handCardSelected,
          ]}
        >
          <Text
            style={[
              styles.handCardRank,
              { fontSize: rankFontSize },
              !card.joker && { color: suitTone(card.suit) },
            ]}
          >
            {card.joker ? 'JOKER' : rankLabel(card.rank)}
          </Text>
          <Text
            style={[
              styles.handCardSuit,
              { fontSize: suitFontSize },
              !card.joker && { color: suitTone(card.suit) },
            ]}
          >
            {card.joker ? 'JOKER' : suitGlyph(card.suit)}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

type HandInsertPreviewProps = {
  handCount: number;
  cardWidth: number;
  cardHeight: number;
  fanHalfAngleDeg: number;
  fanStepAngleDeg: number;
  fanRadius: number;
  fanCenterLift: number;
  borderColor: string;
  dragFromIndex: SharedValue<number>;
  dragTargetIndex: SharedValue<number>;
};

const HandInsertPreview = memo(function HandInsertPreview({
  handCount,
  cardWidth,
  cardHeight,
  fanHalfAngleDeg,
  fanStepAngleDeg,
  fanRadius,
  fanCenterLift,
  borderColor,
  dragFromIndex,
  dragTargetIndex,
}: HandInsertPreviewProps) {
  const animatedStyle = useAnimatedStyle(
    () => {
      const fromIndex = dragFromIndex.value;
      const toIndex = dragTargetIndex.value;
      const isActive = fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex && toIndex < handCount;
      if (!isActive) {
        return {
          opacity: 0,
          transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }],
        };
      }
      const thetaDeg = handCount > 1 ? -fanHalfAngleDeg + toIndex * fanStepAngleDeg : 0;
      const thetaRad = (thetaDeg * Math.PI) / 180;
      const offsetX = Math.round(Math.sin(thetaRad) * fanRadius);
      const offsetY = Math.round(fanRadius * (1 - Math.cos(thetaRad)) - fanCenterLift);
      const rotationDeg = Number((thetaDeg * 0.98).toFixed(2));
      return {
        opacity: 1,
        transform: [{ translateX: offsetX }, { translateY: offsetY }, { rotate: `${rotationDeg}deg` }],
      };
    },
    [fanCenterLift, fanHalfAngleDeg, fanRadius, fanStepAngleDeg, handCount]
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.handInsertSlot,
        {
          width: cardWidth,
          height: cardHeight,
          marginLeft: -Math.round(cardWidth / 2),
          borderColor,
        },
        animatedStyle,
      ]}
    />
  );
});

export function RemotePlayScreen() {
  const wsRef = useRef<WebSocket | null>(null);
  const soloAutoSetupRef = useRef({
    active: false,
    botsRequested: false,
    gameStartRequested: false,
  });
  const discardDropZoneRef = useRef<View | null>(null);
  const { width, height } = useWindowDimensions();
  const isWide = width >= 1200;
  const isCompactMobile = width < 520;
  const isShortScreen = height < 520;
  const isPortraitLike = height >= width;
  const ui = useMemo(() => {
    const shortestSide = Math.min(width, height);
    const veryCompact = shortestSide < 390;
    const horizontalPadding = veryCompact ? 10 : isCompactMobile ? 14 : 24;
    const columnsGap = 12;
    const rightColumnWidth = isWide ? Math.max(300, Math.min(360, Math.round(width * 0.28))) : width - horizontalPadding;
    const leftColumnWidth = isWide
      ? Math.max(320, width - horizontalPadding - columnsGap - rightColumnWidth)
      : width - horizontalPadding;
    const tableWidth = Math.max(240, leftColumnWidth);
    const tableHeightLimit = isWide
      ? Math.min(560, Math.round(height * 0.72))
      : Math.max(220, Math.round(height * (isShortScreen ? 0.58 : isPortraitLike ? 0.68 : 0.74)));
    const tableMinHeight = veryCompact ? 180 : isCompactMobile || isShortScreen ? 200 : 240;
    const tableHeight = Math.round(Math.max(tableMinHeight, Math.min(tableWidth * 0.56, tableHeightLimit, 500)));
    const scale = Math.max(0.42, Math.min(Math.min(tableWidth / 980, tableHeight / 500), 1.15));

    const seatWidth = Math.round(Math.max(58, Math.min(112 * scale, 136)));
    const seatHeight = Math.round(Math.max(28, Math.min(46 * scale, 56)));
    const seatFont = Math.round(Math.max(8, Math.min(14 * scale, 16)));

    const centerWidth = Math.round(Math.max(170, Math.min(330 * scale, 390)));
    const centerTitleSize = Math.round(Math.max(12, Math.min(28 * scale, 34)));
    const centerSubSize = Math.round(Math.max(9, Math.min(14 * scale, 18)));
    const centerTopOffset = Math.round(Math.max(42, Math.min(85 * scale, 100)));

    const pileCardWidth = Math.round(Math.max(70, Math.min(150 * scale, 186)));
    const pileCardHeight = Math.round(Math.max(50, Math.min(88 * scale, 106)));
    const pileLabelSize = Math.round(Math.max(8, Math.min(12 * scale, 15)));
    const pileValueSize = Math.round(Math.max(9, Math.min(13 * scale, 16)));

    const handCardsPerRow = veryCompact ? 8 : isCompactMobile ? 7 : 7;
    const handGap = 8;
    const handAvailableWidth = Math.max(180, tableWidth - 10);
    const fittedHandWidth = Math.floor((handAvailableWidth - handGap * (handCardsPerRow - 1)) / handCardsPerRow);
    const handCardWidth = Math.round(Math.max(28, Math.min(fittedHandWidth, Math.min(86 * scale, 98))));
    const handCardHeight = Math.round(Math.max(40, Math.min(handCardWidth * 1.35, 130)));
    const handCardScale = 0.48;
    const handRankSize = Math.round(Math.max(6, Math.min(21 * scale * handCardScale, 12)));
    const handSuitSize = Math.round(Math.max(4, Math.min(11 * scale * handCardScale, 7)));
    const baseCasinoHandCardWidth = Math.round(Math.max(32, Math.min(handCardWidth + 8, 86)));
    const baseCasinoHandCardHeight = Math.round(Math.max(48, Math.min(baseCasinoHandCardWidth * 1.45, 126)));
    const casinoHandCardWidth = Math.round(baseCasinoHandCardWidth * handCardScale);
    const casinoHandCardHeight = Math.round(baseCasinoHandCardHeight * handCardScale);
    const casinoHandOverlap = Math.round(Math.max(6, Math.min(casinoHandCardWidth * 0.44, 24)));

    const rimOuterPadding = Math.round(Math.max(4, Math.min(10 * scale, 14)));
    const rimInnerPadding = Math.round(Math.max(3, Math.min(8 * scale, 12)));
    const tableOuterRadius = Math.round(tableHeight / 2);
    const tableInnerRadius = Math.round((tableHeight - rimOuterPadding * 2) / 2);
    const tableFeltRadius = Math.round((tableHeight - rimOuterPadding * 2 - rimInnerPadding * 2) / 2);
    const waitingTextMargin = Math.round(Math.max(62, tableHeight * 0.4));
    const seatPanelWidth = Math.round(Math.max(88, Math.min(122 * scale, 148)));
    const seatPanelHeight = Math.round(Math.max(36, Math.min(48 * scale, 60)));
    const actionCardWidth = Math.round(Math.max(52, Math.min(94 * scale, 112)));
    const actionCardHeight = Math.round(Math.max(70, Math.min(actionCardWidth * 1.35, 144)));
    const headerActionFontSize = Math.round(Math.max(8, Math.min(10 * scale, 11)));
    const headerActionHeight = Math.round(Math.max(20, Math.min(24 * scale, 28)));
    const handPanelTranslateY = Math.round(Math.max(8, Math.min(22 * scale, 24)));
    const handSortTranslateY = Math.round(Math.max(8, Math.min(20 * scale, 24)));
    const handFanTranslateY = Math.round(Math.max(6, Math.min(16 * scale, 18)));

    return {
      scale,
      veryCompact,
      rightColumnWidth,
      leftColumnWidth,
      tableWidth,
      tableHeight,
      seatWidth,
      seatHeight,
      seatFont,
      centerWidth,
      centerTitleSize,
      centerSubSize,
      centerTopOffset,
      pileCardWidth,
      pileCardHeight,
      pileLabelSize,
      pileValueSize,
      handCardWidth,
      handCardHeight,
      handRankSize,
      handSuitSize,
      casinoHandCardWidth,
      casinoHandCardHeight,
      casinoHandOverlap,
      rimOuterPadding,
      rimInnerPadding,
      tableOuterRadius,
      tableInnerRadius,
      tableFeltRadius,
      waitingTextMargin,
      seatPanelWidth,
      seatPanelHeight,
      actionCardWidth,
      actionCardHeight,
      headerActionFontSize,
      headerActionHeight,
      handPanelTranslateY,
      handSortTranslateY,
      handFanTranslateY,
    };
  }, [width, height, isWide, isCompactMobile, isShortScreen, isPortraitLike]);
  const tableResponsiveScale = useMemo(() => {
    const fitScale = Math.min(width / TABLE_RESPONSIVE_REF_WIDTH, height / TABLE_RESPONSIVE_REF_HEIGHT);
    return Math.max(1, Math.min(fitScale, 1.45));
  }, [width, height]);

  const [connectionState, setConnectionState] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [currentPage, setCurrentPage] = useState<UiPage>('mode');
  const [entryPlayMode, setEntryPlayMode] = useState<EntryPlayMode>('solo');
  const [connectionMode, setConnectionMode] = useState<'local' | 'internet'>('local');
  const [themeKey, setThemeKey] = useState<ThemeKey>('noir-or');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [name, setName] = useState(SOLO_DEFAULT_NAME);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [roomCode, setRoomCode] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [tableHeaderHeight, setTableHeaderHeight] = useState(0);
  const [tableAreaWidth, setTableAreaWidth] = useState(0);
  const [tableAreaHeight, setTableAreaHeight] = useState(0);
  const [tableFeltSize, setTableFeltSize] = useState({ width: 0, height: 0 });
  const [leftColumnHeight, setLeftColumnHeight] = useState(0);
  const [discardDropRect, setDiscardDropRect] = useState<DropRect | null>(null);
  const [statusText, setStatusText] = useState('Non connecte');
  const [handOrderIds, setHandOrderIds] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const dragFromIndex = useSharedValue(-1);
  const dragTargetIndex = useSharedValue(-1);
  const theme = THEMES[themeKey];

  const you = useMemo(
    () => snapshot?.players.find((p) => p.id === snapshot.youPlayerId) ?? null,
    [snapshot]
  );
  const isHost = Boolean(you?.isHost);
  const isYourTurn = Boolean(snapshot && snapshot.currentPlayerId === snapshot.youPlayerId);
  const roundHandSize = snapshot ? Math.min(13, snapshot.roundNumber + 2) : 0;
  const hasDrawnThisTurn = Boolean(snapshot && snapshot.myHand.length > roundHandSize);
  const canDraw = Boolean(
    snapshot &&
      snapshot.phase === 'inRound' &&
      isYourTurn &&
      (snapshot.turnStage === 'draw' || (snapshot.turnStage === 'discard' && !hasDrawnThisTurn))
  );
  const canDiscardTurn = Boolean(
    snapshot && snapshot.phase === 'inRound' && isYourTurn && snapshot.turnStage === 'discard' && hasDrawnThisTurn
  );
  const canReorderHand = Boolean(snapshot && snapshot.phase === 'inRound' && snapshot.myHand.length > 1);
  const canSortHand = Boolean(snapshot && snapshot.phase === 'inRound' && snapshot.myHand.length > 1);
  const canValidateMelds = Boolean(
    snapshot &&
      snapshot.phase === 'inRound' &&
      isYourTurn &&
      snapshot.turnStage === 'discard' &&
      hasDrawnThisTurn &&
      !snapshot.exposedByPlayerId &&
      snapshot.canValidateMelds
  );
  const connectedSeatCount = Math.max(
    2,
    Math.min(MAX_SEATS, snapshot ? snapshot.players.filter((p) => p.connected).length : MAX_SEATS)
  );

  const reservedHeader = tableHeaderHeight > 0 ? tableHeaderHeight : isCompactMobile ? 112 : 132;
  const availableTableHeight = Math.max(180, Math.round(height - reservedHeader - (isCompactMobile ? 24 : 30)));
  const measuredTableSpace = leftColumnHeight > 0 ? leftColumnHeight : availableTableHeight;
  const adaptiveTableHeight = Math.max(180, Math.round(measuredTableSpace));

  const tableSeatPlayers = useMemo(() => {
    if (!snapshot) return [] as PlayerSnapshot[];
    return orderedPlayersForSeats(snapshot, connectedSeatCount).filter(
      (seatPlayer): seatPlayer is PlayerSnapshot => Boolean(seatPlayer)
    );
  }, [snapshot, connectedSeatCount]);
  const seatLayouts = useMemo(() => getSeatLayouts(tableSeatPlayers.length), [tableSeatPlayers.length]);
  const statsRanking = useMemo(() => {
    if (!snapshot) return [] as PlayerSnapshot[];
    return snapshot.players
      .filter((player) => player.connected)
      .slice()
      .sort((a, b) => a.totalScore - b.totalScore || a.name.localeCompare(b.name));
  }, [snapshot]);
  const orderedMyHand = useMemo(() => {
    if (!snapshot) return [] as Card[];
    return buildOrderedHand(snapshot.myHand, handOrderIds);
  }, [snapshot, handOrderIds]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const lockOrientation = async () => {
      try {
        if (currentPage !== 'table') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          return;
        }
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {
        // fallback handled by UI if lock is unavailable on device
      }
    };
    void lockOrientation();
  }, [currentPage]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') {
        void ScreenOrientation.unlockAsync();
      }
    };
  }, []);

  const measureDiscardDropZone = useCallback(() => {
    const zone = discardDropZoneRef.current;
    if (!zone || typeof zone.measureInWindow !== 'function') return;
    requestAnimationFrame(() => {
      zone.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        if (measuredWidth <= 0 || measuredHeight <= 0) return;
        setDiscardDropRect({
          x,
          y,
          width: measuredWidth,
          height: measuredHeight,
        });
      });
    });
  }, []);

  useEffect(() => {
    measureDiscardDropZone();
  }, [measureDiscardDropZone, width, height, currentPage, snapshot?.phase, snapshot?.turnStage, snapshot?.roomCode]);

  const send = (payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  };

  const applyConnectionPreset = useCallback(
    (mode: 'local' | 'internet') => {
      setConnectionMode(mode);
      if (mode === 'local') {
        setServerUrl(resolveDefaultServerUrl());
        setStatusText('Mode local active (meme Wi-Fi).');
        return;
      }
      setServerUrl((prev) => {
        const current = prev.trim();
        if (!current || isLikelyLocalWsUrl(current)) return INTERNET_SERVER_URL_PLACEHOLDER;
        return current;
      });
      setStatusText('Mode internet actif (utilise une URL wss:// en ligne).');
    },
    []
  );

  const toggleSelectedCard = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }, []);

  const reorderMyHand = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!snapshot || fromIndex === toIndex) return;
      setHandOrderIds((prev) => {
        const orderedIds = buildOrderedHand(snapshot.myHand, prev).map((card) => card.id);
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= orderedIds.length ||
          toIndex >= orderedIds.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }
        const next = orderedIds.slice();
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return prev;
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [snapshot]
  );

  const resetHandDragState = useCallback(() => {
    dragFromIndex.value = -1;
    dragTargetIndex.value = -1;
  }, [dragFromIndex, dragTargetIndex]);

  const tryDiscardByDrop = useCallback(
    (cardId: string, x: number, y: number): boolean => {
      if (!canDiscardTurn) {
        setStatusText('Tu dois piocher avant de jeter.');
        return false;
      }
      if (!discardDropRect) {
        setStatusText('Zone de defausse indisponible.');
        return false;
      }
      const inDropZone =
        x >= discardDropRect.x &&
        x <= discardDropRect.x + discardDropRect.width &&
        y >= discardDropRect.y &&
        y <= discardDropRect.y + discardDropRect.height;
      if (!inDropZone) return false;
      send({ type: 'action', action: 'discard', cardId });
      setSelectedCardIds((prev) => prev.filter((id) => id !== cardId));
      return true;
    },
    [canDiscardTurn, discardDropRect]
  );

  const finalizeHandDrag = useCallback(
    (payload: HandDragFinalizePayload) => {
      const { cardId, fromIndex, translationX, translationY, absoluteX, absoluteY, movedEnough } = payload;
      if (!movedEnough) {
        toggleSelectedCard(cardId);
        return;
      }

      let droppedToDiscard = false;
      if (canDiscardTurn) {
        droppedToDiscard = tryDiscardByDrop(cardId, absoluteX, absoluteY);
      }
      if (droppedToDiscard) return;

      const mostlyHorizontalDrag = Math.abs(translationX) >= Math.abs(translationY);
      if (canReorderHand && mostlyHorizontalDrag) {
        const step = Math.max(12, ui.casinoHandCardWidth - ui.casinoHandOverlap);
        const shift = computeReorderShift(translationX, step);
        if (shift !== 0) {
          const nextIndex = Math.max(0, Math.min(orderedMyHand.length - 1, fromIndex + shift));
          if (nextIndex !== fromIndex) {
            reorderMyHand(fromIndex, nextIndex);
            return;
          }
        }
      }

      toggleSelectedCard(cardId);
    },
    [
      canDiscardTurn,
      canReorderHand,
      orderedMyHand.length,
      reorderMyHand,
      toggleSelectedCard,
      tryDiscardByDrop,
      ui.casinoHandCardWidth,
      ui.casinoHandOverlap,
    ]
  );

  const sortMyHandByFamily = useCallback(() => {
    if (!snapshot || snapshot.phase !== 'inRound') return;
    const sorted = sortCardsWithLockedSelection(orderedMyHand, selectedCardIds, sortCardsByFamily);
    setHandOrderIds(sorted.map((card) => card.id));
    resetHandDragState();
    if (selectedCardIds.length > 0) {
      setStatusText('Tri famille applique (cartes selectionnees verrouillees).');
    } else {
      setStatusText('Main triee par famille.');
    }
  }, [orderedMyHand, selectedCardIds, snapshot, resetHandDragState]);

  const sortMyHandByTierces = useCallback(() => {
    if (!snapshot || snapshot.phase !== 'inRound') return;
    const sorted = sortCardsWithLockedSelection(orderedMyHand, selectedCardIds, sortCardsByTierces);
    setHandOrderIds(sorted.map((card) => card.id));
    resetHandDragState();
    if (selectedCardIds.length > 0) {
      setStatusText('Tri tierces applique (cartes selectionnees verrouillees).');
    } else {
      setStatusText('Main triee par tierces.');
    }
  }, [orderedMyHand, selectedCardIds, snapshot, resetHandDragState]);

  const addLobbyBot = () => {
    if (!snapshot || snapshot.phase !== 'lobby') return;
    if (!isHost) {
      setStatusText('Seul lhote peut ajouter un bot.');
      return;
    }
    send({ type: 'add_debug_bots', count: 1 });
    setStatusText('Ajout bot en cours...');
  };

  const connect = (
    mode: 'create_room' | 'join_room',
    options?: { soloAutoSetup?: boolean; connectionModeOverride?: 'local' | 'internet' }
  ) => {
    const trimmedUrl = normalizeWebSocketUrl(serverUrl);
    const trimmedName = name.trim() || 'Joueur';
    const trimmedCode = roomCodeToInput(roomCode);
    const enableSoloAutoSetup = Boolean(options?.soloAutoSetup);
    const effectiveConnectionMode = options?.connectionModeOverride ?? connectionMode;
    if (!trimmedUrl) {
      setStatusText('URL serveur manquante');
      return;
    }
    if (effectiveConnectionMode === 'internet' && !trimmedUrl.startsWith('wss://')) {
      setStatusText('Mode internet: utilise une URL securisee en wss://');
      return;
    }
    if (mode === 'join_room' && trimmedCode.length !== 6) {
      setStatusText('Code salle invalide (6 caracteres)');
      return;
    }

    wsRef.current?.close();
    wsRef.current = null;
    soloAutoSetupRef.current = {
      active: enableSoloAutoSetup,
      botsRequested: false,
      gameStartRequested: false,
    };
    setSnapshot(null);
    setHandOrderIds([]);
    resetHandDragState();
    setSelectedCardIds([]);
    setConnectionState('connecting');
    setStatusText('Connexion en cours...');
    setServerUrl(trimmedUrl);

    try {
      const ws = new WebSocket(trimmedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        setStatusText(enableSoloAutoSetup ? 'Connecte (solo) - creation de salle...' : 'Connecte');
        if (mode === 'create_room') {
          ws.send(JSON.stringify({ type: 'create_room', name: trimmedName }));
        } else {
          ws.send(JSON.stringify({ type: 'join_room', name: trimmedName, roomCode: trimmedCode }));
        }
      };

      ws.onmessage = (event) => {
        let data: ServerMessage | null = null;
        try {
          data = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          setStatusText('Message serveur invalide');
          return;
        }
        if (!data) return;
        if (data.type === 'snapshot') {
          setSnapshot(data.payload);
          if (data.payload.roomCode) setRoomCode(data.payload.roomCode);
          const handIds = new Set(data.payload.myHand.map((card) => card.id));
          setHandOrderIds((prev) => {
            const kept = prev.filter((id) => handIds.has(id));
            const keptSet = new Set(kept);
            const appended = data.payload.myHand.map((card) => card.id).filter((id) => !keptSet.has(id));
            return [...kept, ...appended];
          });
          resetHandDragState();
          setSelectedCardIds((prev) => prev.filter((id) => handIds.has(id)));
          setCurrentPage('table');

          if (soloAutoSetupRef.current.active) {
            const connectedPlayersCount = data.payload.players.filter((player) => player.connected).length;
            if (data.payload.phase === 'lobby') {
              if (!soloAutoSetupRef.current.botsRequested) {
                const missingBots = Math.max(0, MAX_SEATS - connectedPlayersCount);
                if (missingBots > 0) {
                  ws.send(JSON.stringify({ type: 'add_debug_bots', count: missingBots }));
                  setStatusText(`Mode solo: ajout de ${missingBots} bots...`);
                } else {
                  setStatusText('Mode solo: bots deja en place.');
                }
                soloAutoSetupRef.current.botsRequested = true;
              } else if (!soloAutoSetupRef.current.gameStartRequested && connectedPlayersCount >= 2) {
                ws.send(JSON.stringify({ type: 'start_game' }));
                soloAutoSetupRef.current.gameStartRequested = true;
                setStatusText('Mode solo: demarrage de la manche...');
              }
            } else {
              soloAutoSetupRef.current.active = false;
            }
          }
          return;
        }
        if (data.type === 'info') {
          setStatusText(data.message);
          return;
        }
        if (data.type === 'error') {
          setStatusText(`Erreur: ${data.message}`);
        }
      };

      ws.onerror = () => {
        setStatusText('Erreur reseau');
      };

      ws.onclose = () => {
        setConnectionState('offline');
        setStatusText('Deconnecte');
        setCurrentPage('mode');
        setSettingsVisible(false);
        setHandOrderIds([]);
        resetHandDragState();
        setSelectedCardIds([]);
        soloAutoSetupRef.current = {
          active: false,
          botsRequested: false,
          gameStartRequested: false,
        };
        wsRef.current = null;
      };
    } catch {
      setConnectionState('offline');
      setStatusText('Impossible de creer la connexion');
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    soloAutoSetupRef.current = {
      active: false,
      botsRequested: false,
      gameStartRequested: false,
    };
    setSnapshot(null);
    setStatsVisible(false);
    setHandOrderIds([]);
    resetHandDragState();
    setConnectionState('offline');
    setStatusText('Deconnecte');
    setSelectedCardIds([]);
    setCurrentPage('mode');
    setSettingsVisible(false);
  };

  const selectEntryMode = useCallback(
    (mode: EntryPlayMode) => {
      setEntryPlayMode(mode);
      if (mode === 'multi_local') {
        setStatusText('Mode multi local (hote telephone) arrive a letape 2.');
        return;
      }
      if (mode === 'solo') {
        setName((prev) => prev.trim() || SOLO_DEFAULT_NAME);
        setConnectionMode('internet');
        setStatusText('Mode solo: connexion automatique...');
        connect('create_room', { soloAutoSetup: true, connectionModeOverride: 'internet' });
        return;
      }
      setCurrentPage('connect');
      setConnectionMode('internet');
      setServerUrl((prev) => {
        const current = prev.trim();
        if (!current || isLikelyLocalWsUrl(current)) return INTERNET_SERVER_URL_PLACEHOLDER;
        return current;
      });
      setStatusText('Mode multi internet: cree ou rejoins une salle.');
    },
    [connect]
  );

  const renderHexBackground = () => (
    <View pointerEvents="none" style={styles.hexLayer}>
      {Array.from({ length: 13 }, (_, row) => (
        <View
          key={`hex-row-${row}`}
          style={[styles.hexRow, row % 2 === 1 ? { marginLeft: 14 } : null]}
        >
          {Array.from({ length: 28 }, (_, col) => (
            <View key={`hex-${row}-${col}`} style={styles.hexCell} />
          ))}
        </View>
      ))}
    </View>
  );

  const renderSeat = (seatPlayer: PlayerSnapshot | null, layout: SeatLayout, seatIndex: number) => {
    const isMine = Boolean(snapshot && seatPlayer && snapshot.youPlayerId === seatPlayer.id);
    const opponentCardCount = Math.max(0, seatPlayer?.handCount ?? 0);
    const hasVisibleCards = opponentCardCount > 0;
    if (!seatPlayer || isMine) return null;

    const isActive = Boolean(snapshot && snapshot.currentPlayerId === seatPlayer.id);
    const previewCap =
      OPPONENT_BACKS_PREVIEW_MAX + (isActive ? OPPONENT_BACKS_PREVIEW_ACTIVE_BONUS : 0);
    const visibleOpponentBacks = hasVisibleCards ? Math.min(opponentCardCount, previewCap) : 0;
    const miniCardWidth = Math.max(10, Math.round(ui.casinoHandCardWidth * CARD_VISUAL_SCALE));
    const miniCardHeight = Math.max(14, Math.round(miniCardWidth * (7 / 5)));
    const opponentFanTotalAngleDeg =
      visibleOpponentBacks <= 4
        ? 34
        : visibleOpponentBacks <= 7
          ? 40
          : visibleOpponentBacks <= 8
            ? 44
            : visibleOpponentBacks <= 10
              ? 46
              : 54;
    const opponentFanHalfAngleDeg = opponentFanTotalAngleDeg / 2;
    const opponentFanStepAngleDeg =
      visibleOpponentBacks > 1 ? opponentFanTotalAngleDeg / (visibleOpponentBacks - 1) : 0;
    const opponentFanStepAngleRad =
      visibleOpponentBacks > 1 ? (opponentFanStepAngleDeg * Math.PI) / 180 : 0;
    const opponentFanCompactFactor = 0.68;
    const opponentHandOverlap = Math.round(Math.max(8, Math.min(miniCardWidth * 0.44, 24)));
    const opponentTargetStepX = Math.max(
      4,
      Math.round((miniCardWidth - opponentHandOverlap) * opponentFanCompactFactor)
    );
    const opponentFanRadius = Math.max(
      22,
      Math.round(opponentTargetStepX / Math.max(0.06, opponentFanStepAngleRad))
    );
    const opponentFanCenterLift = Math.max(8, Math.round(miniCardHeight * 0.22));
    const opponentFanSlots = Array.from({ length: visibleOpponentBacks }, (_, index) => {
      const thetaDeg = visibleOpponentBacks > 1 ? -opponentFanHalfAngleDeg + index * opponentFanStepAngleDeg : 0;
      const thetaRad = (thetaDeg * Math.PI) / 180;
      return {
        index,
        x: Math.round(Math.sin(thetaRad) * opponentFanRadius),
        y: Math.round(opponentFanRadius * (1 - Math.cos(thetaRad)) - opponentFanCenterLift),
        rotationDeg: Number((thetaDeg * 0.98).toFixed(2)),
      };
    });
    const opponentMinX = opponentFanSlots.length ? Math.min(...opponentFanSlots.map((slot) => slot.x)) : 0;
    const opponentMaxX = opponentFanSlots.length ? Math.max(...opponentFanSlots.map((slot) => slot.x)) : 0;
    const opponentMinY = opponentFanSlots.length ? Math.min(...opponentFanSlots.map((slot) => slot.y)) : 0;
    const opponentMaxY = opponentFanSlots.length ? Math.max(...opponentFanSlots.map((slot) => slot.y)) : 0;
    const miniFanWidth = opponentFanSlots.length ? opponentMaxX - opponentMinX + miniCardWidth + 4 : 0;
    const miniFanHeight = opponentFanSlots.length ? opponentMaxY - opponentMinY + miniCardHeight + 4 : 0;
    let opponentFanRotateDeg = 0;
    let opponentFanShiftY = 0;

    if (connectedSeatCount === 2 && seatIndex === 1) {
      opponentFanRotateDeg = 180;
    } else if (connectedSeatCount === 3) {
      if (seatIndex === 1) opponentFanRotateDeg = 90;
      if (seatIndex === 2) opponentFanRotateDeg = -90;
    } else if (connectedSeatCount === 4) {
      if (seatIndex === 1) opponentFanRotateDeg = 90;
      if (seatIndex === 2) opponentFanRotateDeg = 180;
      if (seatIndex === 3) opponentFanRotateDeg = -90;
    } else if (connectedSeatCount === 5) {
      if (seatIndex === 1) opponentFanRotateDeg = -90;
      if (seatIndex === 2) opponentFanRotateDeg = 90;
      if (seatIndex === 3 || seatIndex === 4) opponentFanRotateDeg = 180;
    } else if (connectedSeatCount === 6) {
      if (seatIndex === 2) opponentFanRotateDeg = 90;
      if (seatIndex === 5) opponentFanRotateDeg = -90;
      if (seatIndex === 3 || seatIndex === 4) opponentFanRotateDeg = 180;
    } else if (connectedSeatCount === 7) {
      if (seatIndex === 2) opponentFanRotateDeg = 90;
      if (seatIndex === 5) opponentFanRotateDeg = -90;
      if (seatIndex === 3 || seatIndex === 4) opponentFanRotateDeg = 180;
    } else {
      if (seatIndex === 2) opponentFanRotateDeg = 90;
      if (seatIndex === 5) opponentFanRotateDeg = -90;
      if (seatIndex === 3 || seatIndex === 4) opponentFanRotateDeg = 180;
    }

    if (connectedSeatCount === 3) {
      if (seatIndex === 1 || seatIndex === 2) opponentFanShiftY = 6;
    } else if (connectedSeatCount === 4) {
      if (seatIndex === 1 || seatIndex === 3) opponentFanShiftY = 6;
    } else if (connectedSeatCount === 5) {
      if (seatIndex === 1 || seatIndex === 2) opponentFanShiftY = 6;
    } else if (connectedSeatCount === 6) {
      if (seatIndex === 2 || seatIndex === 5) opponentFanShiftY = 6;
      if (seatIndex === 1 || seatIndex === 6) opponentFanShiftY = -14;
    } else if (connectedSeatCount === 7) {
      if (seatIndex === 2 || seatIndex === 5) opponentFanShiftY = 6;
      if (seatIndex === 3 || seatIndex === 4) opponentFanShiftY = 24;
    } else if (seatIndex === 1 || seatIndex === 6) {
      opponentFanShiftY = -14;
    }
    const isLateralFan = Math.abs(opponentFanRotateDeg) === 90;
    const orientedFanWidth = isLateralFan ? miniFanHeight : miniFanWidth;
    const orientedFanHeight = isLateralFan ? miniFanWidth : miniFanHeight;
    const isBottomLineSeat = layout.top >= 85;
    const isTopSeat = layout.top <= 20;
    const isLeftSeat = layout.left <= 20;
    const isRightSeat = layout.left >= 80;
    const isSideSeat = !isBottomLineSeat && (isLeftSeat || isRightSeat);
    const isBottomExtremitySeat = isBottomLineSeat && (isLeftSeat || isRightSeat);
    const debugOuterInset = Math.round(tableFeltSize.width * 0.09);
    const seatAnchorXPx = Math.round((layout.left / 100) * tableFeltSize.width);
    const leftZoneOuterBorderX = debugOuterInset;
    const rightZoneOuterBorderX = Math.max(0, tableFeltSize.width - debugOuterInset);
    let fanTranslateX = 0;
    if (isSideSeat && tableFeltSize.width > 0) {
      if (isLeftSeat) {
        // Bord droit de l'eventail colle a la ligne 4.
        fanTranslateX = leftZoneOuterBorderX - (seatAnchorXPx + Math.round(miniFanWidth / 2)) - 18;
      } else if (isRightSeat) {
        // Bord gauche de l'eventail colle a la ligne 6.
        fanTranslateX = rightZoneOuterBorderX - (seatAnchorXPx - Math.round(miniFanWidth / 2)) - -18;
      }
    }
    const fanTranslateY = opponentFanShiftY;
    let opponentNameTop = opponentFanShiftY + Math.round(orientedFanHeight / 2) + 6;
    const opponentNameWidth = Math.max(80, ui.seatPanelWidth);
    let opponentNameLeft = -Math.round(opponentNameWidth / 2);
    const extremityNameTwoLinesOffset = Math.round(24 * ui.scale);
    const extremityNameOneLineNudge = Math.round(12 * ui.scale);
    const extremityNameThreeLinesNudge = Math.round(36 * ui.scale);
    const sideExteriorNudge = 60; // ~3 lignes cumulées vers l'exterieur
    if (!isBottomLineSeat) {
      if (isTopSeat) {
        // Haut: le dessous de l'eventail est vers l'exterieur -> nom au-dessus.
        opponentNameTop = opponentFanShiftY - Math.round(orientedFanHeight / 2) - 20;
        opponentNameLeft = -Math.round(opponentNameWidth / 2);
      } else if (isSideSeat) {
        // Cotes: nom sur une ligne derriere la main (sous l'eventail, centre).
        opponentNameTop = opponentFanShiftY - 6;
        opponentNameLeft = -Math.round(opponentNameWidth / 2) + (isLeftSeat ? -sideExteriorNudge : sideExteriorNudge);
      }
    }
    if (isBottomExtremitySeat) {
      // Bas extremites: gauche -> nom a droite, droite -> nom a gauche.
      opponentNameTop = opponentFanShiftY - Math.round(orientedFanHeight * 0.12);
      opponentNameLeft = isLeftSeat
        ? Math.round(orientedFanWidth / 2) + 8 - extremityNameTwoLinesOffset - extremityNameOneLineNudge - extremityNameThreeLinesNudge
        : -Math.round(orientedFanWidth / 2) - opponentNameWidth - 8 + extremityNameTwoLinesOffset + extremityNameOneLineNudge + extremityNameThreeLinesNudge;
    }
    if (!hasVisibleCards) {
      if (isTopSeat) {
        opponentNameTop = -4;
      } else if (isBottomExtremitySeat) {
        // Conserver le meme placement lateral meme avant distribution.
        opponentNameTop = opponentFanShiftY - Math.round(orientedFanHeight * 0.12);
        opponentNameLeft = isLeftSeat
          ? Math.round(orientedFanWidth / 2) + 8 - extremityNameTwoLinesOffset - extremityNameOneLineNudge - extremityNameThreeLinesNudge
          : -Math.round(orientedFanWidth / 2) - opponentNameWidth - 8 + extremityNameTwoLinesOffset + extremityNameOneLineNudge + extremityNameThreeLinesNudge;
      } else if (isSideSeat) {
        opponentNameTop = -2;
      } else {
        opponentNameTop = 8;
      }
    }
    const roleLabels: ('Distribue' | 'Melangeur')[] = [];
    if (snapshot?.dealerPlayerId === seatPlayer.id) roleLabels.push('Distribue');
    if (snapshot?.shufflerPlayerId === seatPlayer.id) roleLabels.push('Melangeur');
    const sideNameRotateStyle =
      isSideSeat && isLeftSeat
        ? styles.sideSeatNameLeftRotate
        : isSideSeat && isRightSeat
          ? styles.sideSeatNameRightRotate
          : null;
    const hasExtremityInlineRoles = isBottomExtremitySeat && roleLabels.length > 0;
    const extremityNamePillStyle =
      isBottomExtremitySeat && isLeftSeat
        ? styles.extremityNamePillLeft
        : isBottomExtremitySeat && isRightSeat
          ? styles.extremityNamePillRight
          : null;
    const extremityNameTextStyle =
      isBottomExtremitySeat && isLeftSeat
        ? styles.extremityNameTextLeft
        : isBottomExtremitySeat && isRightSeat
          ? styles.extremityNameTextRight
          : null;

    return (
      <View
        key={`seat-${seatIndex}`}
        pointerEvents="none"
        style={[
          styles.seatAnchor,
          {
            top: `${layout.top}%` as Percent,
            left: `${layout.left}%` as Percent,
          },
        ]}
      >
        {hasVisibleCards ? (
          <View
            style={[
              styles.seatBackFanWrap,
              {
                width: miniFanWidth,
                height: miniFanHeight,
                marginLeft: -Math.round(miniFanWidth / 2),
                marginTop: -Math.round(miniFanHeight / 2),
                transform: [{ translateX: fanTranslateX }, { translateY: fanTranslateY }],
              },
            ]}
          >
            <View
              style={[
                styles.seatBackFanRotateWrap,
                {
                  width: miniFanWidth,
                  height: miniFanHeight,
                  transform: [{ rotate: `${opponentFanRotateDeg}deg` }],
                },
              ]}
            >
              {opponentFanSlots.map((slot) => {
                return (
                  <View
                    key={`seat-back-${seatPlayer.id}-${slot.index}`}
                    style={[
                      styles.seatBackCard,
                      {
                        width: miniCardWidth,
                        height: miniCardHeight,
                        left: slot.x - opponentMinX + 2,
                        top: slot.y - opponentMinY + 2,
                        transform: [{ rotate: `${slot.rotationDeg}deg` }],
                        zIndex: slot.index + 1,
                      },
                    ]}
                  >
                    <Image source={CARD_BACK_IMAGE} style={styles.seatBackImage} resizeMode="contain" />
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.seatIdentityUnderCards,
            {
              width: opponentNameWidth,
              left: opponentNameLeft,
              top: opponentNameTop,
            },
          ]}
        >
          <View style={styles.seatIdentityInline}>
            {hasExtremityInlineRoles && isRightSeat ? (
              <View style={styles.seatRoleBadgesLeft}>
                {roleLabels.map((roleLabel) => (
                  <View
                    key={`role-${seatPlayer.id}-${roleLabel}`}
                    style={[
                      styles.playerRoleBadge,
                      roleLabel === 'Distribue' ? styles.playerRoleBadgeDeal : styles.playerRoleBadgeShuffle,
                    ]}
                  >
                    <Text style={styles.playerRoleBadgeText}>{roleLabel}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={[styles.namePill, extremityNamePillStyle, isActive && styles.namePillActive]}>
              <Text
                numberOfLines={1}
                style={[
                  styles.seatNameUnderCards,
                  { fontSize: Math.max(10, ui.seatFont) },
                  isSideSeat && styles.sideSeatNameSingleLine,
                  extremityNameTextStyle,
                  sideNameRotateStyle,
                  isActive && styles.seatNameUnderCardsActive,
                ]}
              >
                {seatPlayer.name}
              </Text>
            </View>
            {isSideSeat && roleLabels.length > 0 ? (
              <View style={styles.sideSeatRoleBelowName}>
                {roleLabels.map((roleLabel) => (
                  <View
                    key={`role-${seatPlayer.id}-${roleLabel}`}
                    style={[
                      styles.playerRoleBadge,
                      roleLabel === 'Distribue' ? styles.playerRoleBadgeDeal : styles.playerRoleBadgeShuffle,
                    ]}
                  >
                    <Text style={styles.playerRoleBadgeText}>{roleLabel}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {!isSideSeat && !hasExtremityInlineRoles && roleLabels.length > 0 ? (
              <View style={styles.seatRoleBadgesRight}>
                {roleLabels.map((roleLabel) => (
                  <View
                    key={`role-${seatPlayer.id}-${roleLabel}`}
                    style={[
                      styles.playerRoleBadge,
                      roleLabel === 'Distribue' ? styles.playerRoleBadgeDeal : styles.playerRoleBadgeShuffle,
                    ]}
                  >
                    <Text style={styles.playerRoleBadgeText}>{roleLabel}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {hasExtremityInlineRoles && isLeftSeat ? (
              <View style={styles.seatRoleBadgesRight}>
                {roleLabels.map((roleLabel) => (
                  <View
                    key={`role-${seatPlayer.id}-${roleLabel}`}
                    style={[
                      styles.playerRoleBadge,
                      roleLabel === 'Distribue' ? styles.playerRoleBadgeDeal : styles.playerRoleBadgeShuffle,
                    ]}
                  >
                    <Text style={styles.playerRoleBadgeText}>{roleLabel}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const renderTable = () => {
    const effectiveTableHeight = Math.max(180, tableAreaHeight || adaptiveTableHeight);
    const effectiveTableWidth = Math.max(240, tableAreaWidth || ui.tableWidth);
    const effectiveOuterRadius = Math.round(effectiveTableHeight / 2);
    const tableBgScale = Math.max(
      effectiveTableWidth / TABLE_BG_VISIBLE_BOUNDS.width,
      effectiveTableHeight / TABLE_BG_VISIBLE_BOUNDS.height
    );
    const renderedBgWidth = TABLE_BG_SOURCE_WIDTH * tableBgScale;
    const renderedBgHeight = TABLE_BG_SOURCE_HEIGHT * tableBgScale;
    const renderedBgLeft =
      (effectiveTableWidth - TABLE_BG_VISIBLE_BOUNDS.width * tableBgScale) / 2 -
      TABLE_BG_VISIBLE_BOUNDS.x * tableBgScale;
    const renderedBgTop =
      (effectiveTableHeight - TABLE_BG_VISIBLE_BOUNDS.height * tableBgScale) / 2 -
      TABLE_BG_VISIBLE_BOUNDS.y * tableBgScale;
    const feltLeft = Math.round(renderedBgLeft + TABLE_FELT_SOURCE_BOUNDS.x * tableBgScale);
    const feltTop = Math.round(renderedBgTop + TABLE_FELT_SOURCE_BOUNDS.y * tableBgScale);
    const feltWidth = Math.round(TABLE_FELT_SOURCE_BOUNDS.width * tableBgScale);
    const feltHeight = Math.round(TABLE_FELT_SOURCE_BOUNDS.height * tableBgScale);
    const effectiveFeltHeight = Math.max(80, feltHeight);
    const effectiveFeltRadius = Math.max(20, Math.round(effectiveFeltHeight / 2));
    const effectiveWaitingMargin = Math.round(Math.max(46, effectiveFeltHeight * 0.4));

    if (!snapshot) {
      return (
        <View
          style={styles.tableShell}
          onLayout={(event) => {
            setTableAreaWidth(Math.round(event.nativeEvent.layout.width));
            setTableAreaHeight(Math.round(event.nativeEvent.layout.height));
          }}
        >
          <View
            style={[
              styles.tableImageFrame,
              {
                borderRadius: effectiveOuterRadius,
              },
            ]}
          >
            <Image
              source={TABLE_BACKGROUND_IMAGE}
              style={[
                styles.tableBgImage,
                {
                  left: renderedBgLeft,
                  top: renderedBgTop,
                  width: renderedBgWidth,
                  height: renderedBgHeight,
                },
              ]}
              resizeMode="cover"
            />
            <View
              style={[
                styles.tableFeltLayer,
                {
                  borderRadius: effectiveFeltRadius,
                  left: feltLeft,
                  top: feltTop,
                  width: feltWidth,
                  height: feltHeight,
                },
              ]}
              onLayout={(event) => {
                const nextWidth = Math.round(event.nativeEvent.layout.width);
                const nextHeight = Math.round(event.nativeEvent.layout.height);
                setTableFeltSize((prev) =>
                  prev.width === nextWidth && prev.height === nextHeight
                    ? prev
                    : { width: nextWidth, height: nextHeight }
                );
              }}
            >
              <View style={[styles.tableFelt, { borderRadius: effectiveFeltRadius - 1 }]}>
              <Text style={[styles.waitingText, { marginTop: effectiveWaitingMargin, color: theme.text }]}>
                Connecte-toi puis cree/rejoins une salle.
              </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    const turnName = snapshot.players.find((p) => p.id === snapshot.currentPlayerId)?.name ?? 'En attente';
    const actionCardCompactWidth = Math.max(40, Math.round(ui.actionCardWidth * 0.5 * CARD_VISUAL_SCALE));
    const actionCardCompactHeight = Math.max(56, Math.round(actionCardCompactWidth * (7 / 5)));
    const pileAndDiscardCardWidth = Math.max(24, actionCardCompactWidth - 8);
    const pileAndDiscardCardHeight = Math.max(34, actionCardCompactHeight - 8);
    const pileBackVisualScale = 1.08;
    const pileBackVisualWidth = Math.round(pileAndDiscardCardWidth * pileBackVisualScale);
    const pileBackVisualHeight = Math.round(pileAndDiscardCardHeight * pileBackVisualScale);
    const feltContentWidth = tableFeltSize.width || ui.tableWidth;
    const feltContentHeight = tableFeltSize.height || ui.tableHeight;
    const playZoneMaxWidth = Math.max(160, feltContentWidth - Math.round(feltContentWidth * 0.16));
    const playZoneWidth = Math.min(
      playZoneMaxWidth,
      Math.max(ui.centerWidth, actionCardCompactWidth * 2 + Math.round(120 * ui.scale))
    );
    const boardPlayTop = Math.max(10, Math.round(feltContentHeight * 0.16));
    const boardPlayBottom = Math.max(66, Math.round(feltContentHeight * (isCompactMobile ? 0.3 : 0.24)));
    const debugZoneLift = Math.max(8, Math.round(12 * ui.scale));
    const debugZoneTop = Math.max(2, Math.round(feltContentHeight * 0.14) - debugZoneLift);
    const debugZoneBottom = Math.max(2, Math.round(feltContentHeight * 0.08) + debugZoneLift);
    const debugZoneOuterInset = Math.round(feltContentWidth * 0.04);
    const leftTierceZoneShiftToCenter = Math.max(8, Math.round(12 * ui.scale));
    const debugInnerLeftEdge = Math.round(feltContentWidth / 2 - (actionCardCompactWidth + 2));
    const debugInnerRightEdge = Math.round(feltContentWidth / 2 + (actionCardCompactWidth + 2));
    const debugLeftBoxWidth = Math.max(24, debugInnerLeftEdge - debugZoneOuterInset);
    const debugLeftBoxLeft = debugZoneOuterInset + leftTierceZoneShiftToCenter;
    const debugRightBoxWidth = Math.max(
      24,
      feltContentWidth - debugZoneOuterInset - debugInnerRightEdge
    );
    const debugRightBoxLeft = Math.max(0, feltContentWidth - debugZoneOuterInset - debugRightBoxWidth);
    const debugZoneTitleTop = Math.max(2, debugZoneTop - 34);
    const debugLeftTitleCenterX = debugLeftBoxLeft + Math.round(debugLeftBoxWidth / 2);
    const debugRightTitleCenterX = debugRightBoxLeft + Math.round(debugRightBoxWidth / 2);
    const debugZoneBorderWidth = DEBUG_UI_ENABLED ? Math.max(2, Math.round(5 * ui.scale)) : 0;
    const tableSeats = tableSeatPlayers
      .map((seatPlayer, idx) => ({
        seatPlayer,
        seatLayout: seatLayouts[idx] ?? { top: 50, left: 50, offsetX: -64, offsetY: -26 },
        seatIndex: idx,
      }));
    const zoneByPlayerId = new Map<string, 0 | 1 | 2>();
    for (const seat of tableSeats) {
      if (!seat.seatPlayer) continue;
      const x = seat.seatLayout.left;
      if (x <= 48) {
        zoneByPlayerId.set(seat.seatPlayer.id, 1);
      } else if (x >= 52) {
        zoneByPlayerId.set(seat.seatPlayer.id, 2);
      } else {
        zoneByPlayerId.set(seat.seatPlayer.id, 0);
      }
    }
    const roundRevealEntries = (snapshot.roundReveal ?? [])
      .filter((entry) => Array.isArray(entry.melds) && Array.isArray(entry.deadwood))
      .map((entry) => ({
        playerId: entry.playerId,
        playerName: snapshot.players.find((player) => player.id === entry.playerId)?.name ?? 'Joueur',
        melds: entry.melds,
        deadwood: entry.deadwood,
        penalty: entry.penalty,
      }));
    const liveExposeEntries = (snapshot.exposedMelds ?? [])
      .filter(
        (entry) =>
          (Array.isArray(entry.melds) && entry.melds.length > 0) ||
          (Array.isArray(entry.deadwood) && entry.deadwood.length > 0)
      )
      .map((entry) => ({
        playerId: entry.playerId,
        playerName: snapshot.players.find((player) => player.id === entry.playerId)?.name ?? 'Joueur',
        melds: entry.melds,
        deadwood: Array.isArray(entry.deadwood) ? entry.deadwood : ([] as Card[]),
        penalty: typeof entry.penalty === 'number' ? entry.penalty : (null as number | null),
      }));
    const exposeSourceEntries =
      snapshot.phase === 'roundEnded' || snapshot.phase === 'gameOver' ? roundRevealEntries : liveExposeEntries;
    const exposedLeftEntries: typeof exposeSourceEntries = [];
    const exposedRightEntries: typeof exposeSourceEntries = [];
    for (const entry of exposeSourceEntries) {
      const preferredZone = zoneByPlayerId.get(entry.playerId) ?? 0;
      if (preferredZone === 1) {
        exposedLeftEntries.push(entry);
      } else if (preferredZone === 2) {
        exposedRightEntries.push(entry);
      } else if (exposedLeftEntries.length <= exposedRightEntries.length) {
        exposedLeftEntries.push(entry);
      } else {
        exposedRightEntries.push(entry);
      }
    }
    const countZoneCards = (entries: typeof exposeSourceEntries) =>
      entries.reduce(
        (sum, entry) => sum + entry.melds.reduce((meldSum, meld) => meldSum + meld.length, 0) + entry.deadwood.length,
        0
      );
    const isLeftZoneDense = exposedLeftEntries.length >= 2 || countZoneCards(exposedLeftEntries) >= 20;
    const isRightZoneDense = exposedRightEntries.length >= 2 || countZoneCards(exposedRightEntries) >= 20;
    const renderExposeCardChips = (cards: Card[], keyPrefix: string, overlap = false) =>
      cards.map((card, cardIndex) => (
        <View
          key={`${keyPrefix}-${card.id}-${cardIndex}`}
          style={[
            styles.debugExposeCardChip,
            overlap && styles.debugExposeMeldCardChip,
            overlap && cardIndex > 0 && styles.debugExposeMeldCardChipOverlap,
            { borderColor: theme.cardBorder, zIndex: overlap ? cardIndex + 1 : 1 },
          ]}
        >
          <Text style={[styles.debugExposeCardRank, !card.joker && { color: suitTone(card.suit) }]}>
            {card.joker ? 'J' : rankLabel(card.rank)}
          </Text>
          <Text style={[styles.debugExposeCardSuit, !card.joker && { color: suitTone(card.suit) }]}>
            {card.joker ? '*' : suitGlyph(card.suit)}
          </Text>
        </View>
      ));
    const splitCardsIntoRows = (cards: Card[], rowCount: number): Card[][] => {
      const safeCount = Math.max(1, rowCount);
      const rows = Array.from({ length: safeCount }, () => [] as Card[]);
      if (cards.length === 0) return rows;
      const baseSize = Math.floor(cards.length / safeCount);
      const remainder = cards.length % safeCount;
      let cursor = 0;
      for (let rowIndex = 0; rowIndex < safeCount; rowIndex += 1) {
        const take = baseSize + (rowIndex < remainder ? 1 : 0);
        rows[rowIndex] = cards.slice(cursor, cursor + take);
        cursor += take;
      }
      return rows;
    };
    const renderExposeEntry = (
      entry: (typeof exposeSourceEntries)[number],
      sideKey: 'left' | 'right',
      isDense: boolean
    ) => {
      const meldRows = entry.melds.filter((meld) => Array.isArray(meld) && meld.length > 0);
      const targetRows = 3;
      const deadwoodRowsTarget = Math.max(1, targetRows - meldRows.length);
      const deadwoodRows = entry.deadwood.length > 0 ? splitCardsIntoRows(entry.deadwood, deadwoodRowsTarget) : [];
      return (
        <View
          key={`exposed-${sideKey}-${entry.playerId}`}
          style={[
            styles.debugExposeEntry,
            styles.debugExposeEntryColumn,
            isDense && styles.debugExposeEntryDense,
          ]}
        >
          <Text style={[styles.debugExposeEntryTitle, isDense && styles.debugExposeEntryTitleDense, { color: theme.sub }]}>
            {entry.playerName}
            {entry.penalty !== null ? ` - ${entry.penalty} pts` : ' expose'}
          </Text>
          <View style={[styles.debugExposeRowsStack, isDense && styles.debugExposeRowsStackDense]}>
            {meldRows.map((meld, meldIndex) => (
              <View
                key={`exposed-${sideKey}-${entry.playerId}-meld-${meldIndex}`}
                style={[
                  styles.debugExposeCardsRow,
                  styles.debugExposeMeldRow,
                  styles.debugExposeFixedRow,
                  isDense && styles.debugExposeCardsRowDense,
                ]}
              >
                {renderExposeCardChips(meld, `meld-${sideKey}-${entry.playerId}-${meldIndex}`, true)}
              </View>
            ))}
            {deadwoodRows.map((rowCards, rowIndex) => (
              <View
                key={`exposed-${sideKey}-${entry.playerId}-dead-${rowIndex}`}
                style={[
                  styles.debugExposeCardsRow,
                  styles.debugExposeMeldRow,
                  styles.debugExposeFixedRow,
                  styles.debugExposeDeadwoodRow,
                  isDense && styles.debugExposeCardsRowDense,
                ]}
              >
                {rowIndex === 0 ? (
                  <Text
                    style={[
                      styles.debugExposeDeadwoodLabelInline,
                      isDense && styles.debugExposeDeadwoodLabelInlineDense,
                      { color: theme.sub },
                    ]}
                  >
                    R:
                  </Text>
                ) : null}
                {renderExposeCardChips(rowCards, `dead-${sideKey}-${entry.playerId}-${rowIndex}`, true)}
              </View>
            ))}
          </View>
        </View>
      );
    };

    return (
      <View
        style={styles.tableShell}
        onLayout={(event) => {
          setTableAreaWidth(Math.round(event.nativeEvent.layout.width));
          setTableAreaHeight(Math.round(event.nativeEvent.layout.height));
        }}
      >
        <View
          style={[
            styles.tableImageFrame,
            {
              borderRadius: effectiveOuterRadius,
            },
          ]}
        >
          <Image
            source={TABLE_BACKGROUND_IMAGE}
            style={[
              styles.tableBgImage,
              {
                left: renderedBgLeft,
                top: renderedBgTop,
                width: renderedBgWidth,
                height: renderedBgHeight,
              },
            ]}
            resizeMode="cover"
          />
          <View
            style={[
              styles.tableFeltLayer,
              {
                borderRadius: effectiveFeltRadius,
                left: feltLeft,
                top: feltTop,
                width: feltWidth,
                height: feltHeight,
              },
            ]}
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              const nextHeight = Math.round(event.nativeEvent.layout.height);
              setTableFeltSize((prev) =>
                prev.width === nextWidth && prev.height === nextHeight
                  ? prev
                  : { width: nextWidth, height: nextHeight }
              );
            }}
          >
            <View style={[styles.tableFelt, { borderRadius: effectiveFeltRadius - 1 }]}>
              <View pointerEvents="box-none" style={styles.debugExposeZonesOverlay}>
                  {DEBUG_UI_ENABLED ? (
                    <Text
                      style={[
                        styles.debugExposeZoneTitle,
                        styles.debugExposeZoneTitleOutside,
                        { top: debugZoneTitleTop, left: debugLeftTitleCenterX },
                      ]}
                    >
                      Zone tierce 1
                    </Text>
                  ) : null}
                  {DEBUG_UI_ENABLED ? (
                    <Text
                      style={[
                        styles.debugExposeZoneTitle,
                        styles.debugExposeZoneTitleOutside,
                        { top: debugZoneTitleTop, left: debugRightTitleCenterX },
                      ]}
                    >
                      Zone tierce 2
                    </Text>
                  ) : null}
                  <View
                    style={[
                      styles.debugExposeZoneBox,
                      {
                        borderWidth: debugZoneBorderWidth,
                        left: debugLeftBoxLeft,
                        top: debugZoneTop,
                        bottom: debugZoneBottom,
                        width: debugLeftBoxWidth,
                      },
                    ]}
                  >
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelTop]}>1</Text> : null}
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelRight]}>2</Text> : null}
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelBottom]}>3</Text> : null}
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelLeft]}>4</Text> : null}
                    <View
                      style={[styles.debugExposeContent, isLeftZoneDense && styles.debugExposeContentDense]}
                    >
                      <View
                        style={[styles.debugExposeContentInner, isLeftZoneDense && styles.debugExposeContentInnerDense]}
                      >
                        <View
                          style={[
                            styles.debugExposeEntriesGrid,
                            isLeftZoneDense && styles.debugExposeEntriesGridDense,
                          ]}
                        >
                          {exposedLeftEntries.map((entry) => renderExposeEntry(entry, 'left', isLeftZoneDense))}
                        </View>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.debugExposeZoneBox,
                      {
                        borderWidth: debugZoneBorderWidth,
                        right: debugZoneOuterInset,
                        top: debugZoneTop,
                        bottom: debugZoneBottom,
                        width: debugRightBoxWidth,
                      },
                    ]}
                  >
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelTop]}>5</Text> : null}
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelRight]}>6</Text> : null}
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelBottom]}>7</Text> : null}
                    {DEBUG_UI_ENABLED ? <Text style={[styles.debugExposeZoneLabel, styles.debugExposeZoneLabelLeft]}>8</Text> : null}
                    <View
                      style={[styles.debugExposeContent, isRightZoneDense && styles.debugExposeContentDense]}
                    >
                      <View
                        style={[styles.debugExposeContentInner, isRightZoneDense && styles.debugExposeContentInnerDense]}
                      >
                        <View
                          style={[
                            styles.debugExposeEntriesGrid,
                            isRightZoneDense && styles.debugExposeEntriesGridDense,
                          ]}
                        >
                          {exposedRightEntries.map((entry) => renderExposeEntry(entry, 'right', isRightZoneDense))}
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                <View
                  pointerEvents={snapshot.phase === 'lobby' ? 'none' : 'box-none'}
                  style={[
                    styles.boardPlayZone,
                    {
                      width: playZoneWidth,
                      marginLeft: -Math.round(playZoneWidth / 2),
                      top: boardPlayTop,
                      bottom: boardPlayBottom,
                    },
                  ]}
                >
                  <View style={styles.boardCenterRow}>
                    <View style={styles.boardRightColumn}>
                      <View style={styles.boardRightRail}>
                        <View
                          ref={discardDropZoneRef}
                          collapsable={false}
                          onLayout={measureDiscardDropZone}
                          style={styles.discardDropZone}
                        >
                          <Pressable
                            style={[
                              styles.actionCard,
                              styles.actionCardDiscardFaceWrap,
                              {
                                width: actionCardCompactWidth,
                                height: actionCardCompactHeight,
                                borderColor: theme.cardBorder,
                                backgroundColor: 'transparent',
                              },
                            ]}
                            onPress={() => send({ type: 'action', action: 'draw_discard' })}
                            disabled={!canDraw}
                          >
                            {snapshot.discardTop ? (
                              <View
                                style={[
                                  styles.discardFaceCard,
                                  {
                                    width: pileAndDiscardCardWidth,
                                    height: pileAndDiscardCardHeight,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.discardFaceRank,
                                    { fontSize: Math.max(12, Math.round(actionCardCompactWidth * 0.32)) },
                                    !snapshot.discardTop.joker && { color: suitTone(snapshot.discardTop.suit) },
                                  ]}
                                >
                                  {snapshot.discardTop.joker ? 'JOKER' : rankLabel(snapshot.discardTop.rank)}
                                </Text>
                                <Text
                                  style={[
                                    styles.discardFaceSuit,
                                    { fontSize: Math.max(10, Math.round(actionCardCompactWidth * 0.24)) },
                                    !snapshot.discardTop.joker && { color: suitTone(snapshot.discardTop.suit) },
                                  ]}
                                >
                                  {snapshot.discardTop.joker ? 'JOKER' : suitGlyph(snapshot.discardTop.suit)}
                                </Text>
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.discardFaceCard,
                                  {
                                    width: pileAndDiscardCardWidth,
                                    height: pileAndDiscardCardHeight,
                                  },
                                ]}
                              >
                                <Text style={[styles.discardFaceRank, { color: theme.sub }]}>-</Text>
                                <Text style={[styles.discardFaceSuit, { color: theme.sub }]}>?</Text>
                              </View>
                            )}
                          </Pressable>
                        </View>
                        <Pressable
                          style={[
                            styles.actionCard,
                            styles.actionCardPileFull,
                            {
                              width: actionCardCompactWidth,
                              height: actionCardCompactHeight,
                              borderColor: theme.cardBorder,
                              borderWidth: 1,
                              backgroundColor: 'transparent',
                            },
                          ]}
                          onPress={() => send({ type: 'action', action: 'draw_pile' })}
                          disabled={!canDraw}
                        >
                          <Image
                            source={CARD_BACK_IMAGE}
                            style={[
                              styles.actionCardBackThumb,
                              {
                                width: pileBackVisualWidth,
                                height: pileBackVisualHeight,
                              },
                            ]}
                            resizeMode="contain"
                          />
                        </Pressable>
                      </View>
                      <Pressable
                        style={[
                          styles.boardValidateButton,
                          { backgroundColor: theme.primary, borderColor: theme.cardBorder },
                          !canValidateMelds && styles.btnDisabled,
                        ]}
                        onPress={() => send({ type: 'action', action: 'validate_melds' })}
                        disabled={!canValidateMelds}
                      >
                        <Text style={[styles.boardValidateButtonText, { color: theme.primaryText }]}>Valider tierces</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {tableSeats.map((entry) => renderSeat(entry.seatPlayer, entry.seatLayout, entry.seatIndex))}
                {renderMyHand()}

                {snapshot.phase === 'lobby' ? (
                  <View style={styles.boardLobbyStart}>
                    {isHost ? (
                      <Pressable
                        style={[
                          styles.lobbyStartButton,
                          { backgroundColor: theme.primary, borderColor: theme.cardBorder },
                          snapshot.players.length < 2 && styles.btnDisabled,
                        ]}
                        onPress={() => send({ type: 'start_game' })}
                        disabled={snapshot.players.length < 2}
                      >
                        <Text style={[styles.lobbyStartButtonText, { color: theme.primaryText }]}>Demarrer</Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.lobbyWaitingText, { color: theme.sub }]}>En attente que l'hote lance la partie</Text>
                    )}
                  </View>
                ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderMyHand = () => {
    if (!snapshot || snapshot.phase !== 'inRound') return null;
    const handCount = orderedMyHand.length;
    const myHandCardWidth = Math.max(10, Math.round(ui.casinoHandCardWidth * CARD_VISUAL_SCALE));
    const myHandCardHeight = Math.max(14, Math.round(ui.casinoHandCardHeight * CARD_VISUAL_SCALE));
    const myHandOverlap = Math.round(Math.max(8, ui.casinoHandOverlap * CARD_VISUAL_SCALE));
    const myRankFontSize = Math.max(8, Math.round(ui.handRankSize * CARD_VISUAL_SCALE));
    const mySuitFontSize = Math.max(5, Math.round(ui.handSuitSize * CARD_VISUAL_SCALE));
    const myPlayerName = snapshot.players.find((player) => player.id === snapshot.youPlayerId)?.name ?? 'Joueur';
    const myRoleLabels: ('Distribue' | 'Melangeur')[] = [];
    if (snapshot.dealerPlayerId === snapshot.youPlayerId) myRoleLabels.push('Distribue');
    if (snapshot.shufflerPlayerId === snapshot.youPlayerId) myRoleLabels.push('Melangeur');
    const isMyTurn = snapshot.currentPlayerId === snapshot.youPlayerId;
    const fanTotalAngleDeg = handCount <= 4 ? 34 : handCount <= 7 ? 40 : handCount <= 8 ? 44 : handCount <= 10 ? 46 : 54;
    const fanHalfAngleDeg = fanTotalAngleDeg / 2;
    const fanStepAngleDeg = handCount > 1 ? fanTotalAngleDeg / (handCount - 1) : 0;
    const fanStepAngleRad = handCount > 1 ? (fanStepAngleDeg * Math.PI) / 180 : 0;
    const fanCompactFactor = 0.68;
    const targetStepX = Math.max(4, Math.round((myHandCardWidth - myHandOverlap) * fanCompactFactor));
    const fanRadius = Math.max(22, Math.round(targetStepX / Math.max(0.06, fanStepAngleRad)));
    const fanCenterLift = Math.max(8, Math.round(myHandCardHeight * 0.22));
    const baseLayoutHandCount = 3;
    const baseLayoutFanTotalAngleDeg = 34;
    const baseLayoutFanHalfAngleDeg = baseLayoutFanTotalAngleDeg / 2;
    const baseLayoutFanStepAngleDeg = baseLayoutFanTotalAngleDeg / (baseLayoutHandCount - 1);
    const baseLayoutFanStepAngleRad = (baseLayoutFanStepAngleDeg * Math.PI) / 180;
    const baseLayoutFanRadius = Math.max(
      22,
      Math.round(targetStepX / Math.max(0.06, baseLayoutFanStepAngleRad))
    );
    const baseLayoutArcDrop = Math.round(
      baseLayoutFanRadius * (1 - Math.cos((baseLayoutFanHalfAngleDeg * Math.PI) / 180))
    );
    const fixedHandFanWrapHeight = myHandCardHeight + baseLayoutArcDrop + 18;
    const handPanelOffsetY = ui.handPanelTranslateY;
    const handSortOffsetY = ui.handSortTranslateY;
    const handFanOffsetY = ui.handFanTranslateY;
    const handNameFontSize = Math.max(11, Math.round(15 * ui.scale));
    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.handPanelOnTable,
          {
            left: Math.max(4, Math.round(8 * ui.scale)),
            right: Math.max(4, Math.round(8 * ui.scale)),
            bottom: Math.max(6, Math.round(14 * ui.scale)),
            transform: [{ translateY: handPanelOffsetY }],
          },
        ]}
      >
        {snapshot.validatedExposePlayerId === snapshot.youPlayerId ? (
          <Text style={[styles.handValidatedHint, { color: theme.title }]}>
            Tierces valides: glisse/choisis puis jette la carte finale.
          </Text>
        ) : null}
        <View style={[styles.handSortButtonsRow, { transform: [{ translateY: handSortOffsetY }] }]}>
          <Pressable
            style={[
              styles.handSortButton,
              {
                minWidth: Math.max(42, Math.round(50 * ui.scale)),
                paddingVertical: Math.max(2, Math.round(3 * ui.scale)),
              },
              { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
              !canSortHand && styles.btnDisabled,
            ]}
            onPress={sortMyHandByFamily}
            disabled={!canSortHand}
            hitSlop={6}
          >
            <Text style={[styles.handSortButtonText, { color: theme.secondaryText, fontSize: Math.max(6, Math.round(8 * ui.scale)) }]}>Tri famille</Text>
          </Pressable>
          <Pressable
            style={[
              styles.handSortButton,
              {
                minWidth: Math.max(42, Math.round(50 * ui.scale)),
                paddingVertical: Math.max(2, Math.round(3 * ui.scale)),
              },
              { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
              !canSortHand && styles.btnDisabled,
            ]}
            onPress={sortMyHandByTierces}
            disabled={!canSortHand}
            hitSlop={6}
          >
            <Text style={[styles.handSortButtonText, { color: theme.secondaryText, fontSize: Math.max(6, Math.round(8 * ui.scale)) }]}>Tri tierces</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.handFanWrap,
            {
              height: fixedHandFanWrapHeight,
              minHeight: fixedHandFanWrapHeight,
              transform: [{ translateY: handFanOffsetY }],
            },
          ]}
        >
          <HandInsertPreview
            handCount={handCount}
            cardWidth={myHandCardWidth}
            cardHeight={myHandCardHeight}
            fanHalfAngleDeg={fanHalfAngleDeg}
            fanStepAngleDeg={fanStepAngleDeg}
            fanRadius={fanRadius}
            fanCenterLift={fanCenterLift}
            borderColor={theme.primary}
            dragFromIndex={dragFromIndex}
            dragTargetIndex={dragTargetIndex}
          />
          {orderedMyHand.map((card, index) => {
            const selected = selectedCardIds.includes(card.id);
            const thetaDeg = handCount > 1 ? -fanHalfAngleDeg + index * fanStepAngleDeg : 0;
            const thetaRad = (thetaDeg * Math.PI) / 180;
            const fanOffsetX = Math.round(Math.sin(thetaRad) * fanRadius);
            const fanOffsetY = Math.round(fanRadius * (1 - Math.cos(thetaRad)) - fanCenterLift);
            const fanRotationDeg = Number((thetaDeg * 0.98).toFixed(2));
            const fanZIndex = index + 1;
            return (
              <DraggableHandCard
                key={card.id}
                card={card}
                stackIndex={index}
                cardCount={orderedMyHand.length}
                selected={selected}
                cardWidth={myHandCardWidth}
                cardHeight={myHandCardHeight}
                dragStep={Math.max(10, myHandCardWidth - myHandOverlap)}
                fanOffsetX={fanOffsetX}
                fanOffsetY={fanOffsetY}
                fanRotationDeg={fanRotationDeg}
                fanZIndex={fanZIndex}
                rankFontSize={myRankFontSize}
                suitFontSize={mySuitFontSize}
                canDragToDiscard={canDiscardTurn}
                canReorderInHand={canReorderHand}
                dragFromIndex={dragFromIndex}
                dragTargetIndex={dragTargetIndex}
                onDragFinalize={finalizeHandDrag}
              />
            );
          })}
        </View>
        <View style={styles.handIdentityUnderCards}>
          <View style={[styles.namePill, styles.handNamePill, isMyTurn && styles.namePillActive]}>
            <Text style={[styles.handNameUnderCards, { fontSize: handNameFontSize }, isMyTurn && styles.handNameUnderCardsActive]}>
              {myPlayerName}
            </Text>
          </View>
          {myRoleLabels.map((roleLabel) => (
            <View
              key={`role-self-${roleLabel}`}
              style={[
                styles.playerRoleBadge,
                styles.handRoleBadge,
                roleLabel === 'Distribue' ? styles.playerRoleBadgeDeal : styles.playerRoleBadgeShuffle,
              ]}
            >
              <Text style={styles.playerRoleBadgeText}>{roleLabel}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderConnectionPanel = () => (
    <View style={[styles.connectPanelWrap, { width: isCompactMobile ? '100%' : 460 }]}>
      <View style={[styles.panelDark, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>Connexion</Text>
        <Text style={[styles.statusText, { color: theme.sub }]}>Etat: {statusText}</Text>
        <View style={styles.connectModeRow}>
          <Pressable
            style={[
              styles.connectModeChip,
              connectionMode === 'local' ? styles.connectModeChipActive : styles.connectModeChipInactive,
              { borderColor: theme.cardBorder },
            ]}
            onPress={() => applyConnectionPreset('local')}
          >
            <Text style={[styles.connectModeChipText, { color: theme.text }]}>Local (Wi-Fi)</Text>
          </Pressable>
          <Pressable
            style={[
              styles.connectModeChip,
              connectionMode === 'internet' ? styles.connectModeChipActive : styles.connectModeChipInactive,
              { borderColor: theme.cardBorder },
            ]}
            onPress={() => applyConnectionPreset('internet')}
          >
            <Text style={[styles.connectModeChipText, { color: theme.text }]}>Internet</Text>
          </Pressable>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[
            styles.darkInput,
            { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
          ]}
          placeholder="Pseudo"
          placeholderTextColor={theme.sub}
        />
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrl}
          style={[
            styles.darkInput,
            { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
          ]}
          placeholder="ws://ip:8787"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={theme.sub}
        />
        <Text style={[styles.connectModeHint, { color: theme.sub }]}>
          {connectionMode === 'local'
            ? 'Local: meme reseau Wi-Fi, URL du type ws://192.168.x.x:8787'
            : 'Internet: utilise un serveur en ligne avec URL wss://...'}
        </Text>
        {entryPlayMode === 'solo' ? (
          <Text style={[styles.connectModeHint, { color: theme.sub }]}>
            Solo: creation de salle + ajout bots + demarrage auto.
          </Text>
        ) : null}
        {entryPlayMode !== 'solo' ? (
          <TextInput
            value={roomCode}
            onChangeText={(value) => setRoomCode(roomCodeToInput(value))}
            style={[
              styles.darkInput,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
            ]}
            placeholder="Code salle"
            autoCapitalize="characters"
            maxLength={6}
            placeholderTextColor={theme.sub}
          />
        ) : null}
        <View style={styles.btnRow}>
          {entryPlayMode === 'solo' ? (
            <Pressable
              style={[
                styles.btnPrimary,
                { backgroundColor: theme.primary },
                connectionState === 'connecting' && styles.btnDisabled,
              ]}
              onPress={() => connect('create_room', { soloAutoSetup: true })}
              disabled={connectionState === 'connecting'}
            >
              <Text style={[styles.btnPrimaryText, { color: theme.primaryText }]}>Lancer solo</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[
                  styles.btnPrimary,
                  { backgroundColor: theme.primary },
                  connectionState === 'connecting' && styles.btnDisabled,
                ]}
                onPress={() => connect('create_room')}
                disabled={connectionState === 'connecting'}
              >
                <Text style={[styles.btnPrimaryText, { color: theme.primaryText }]}>Creer salle</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btnSecondary,
                  { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                  connectionState === 'connecting' && styles.btnDisabled,
                ]}
                onPress={() => connect('join_room')}
                disabled={connectionState === 'connecting'}
              >
                <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Rejoindre</Text>
              </Pressable>
            </>
          )}
        </View>
        <Text style={[styles.connectHint, { color: theme.sub }]}>Page 1 forcee en portrait (mobile natif).</Text>
      </View>
    </View>
  );

  const renderGameSidePanel = () => (
    <View style={[styles.rightColumn, { width: isWide ? ui.rightColumnWidth : '100%' }]}>
      {snapshot && snapshot.phase === 'inRound' && (
        <View style={[styles.panelDark, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Showdown Dev</Text>
          <View style={styles.devStaticWrap}>
            {snapshot.players
              .filter((p) => p.id !== snapshot.youPlayerId)
              .map((player) => (
                <View key={`dev-${player.id}`} style={styles.devPlayerBlock}>
                  <Text style={[styles.panelText, { color: theme.sub }]}>{player.name}</Text>
                  <View style={styles.devCardsRow}>
                    {(player.visibleHand ?? []).map((card) => (
                      <View key={card.id} style={[styles.devCardChip, { borderColor: theme.cardBorder, backgroundColor: theme.secondary }]}>
                        <Text style={[styles.devCardText, { color: theme.secondaryText }, !card.joker && { color: suitTone(card.suit) }]}>
                          {cardLabel(card)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
          </View>
        </View>
      )}

      {snapshot?.lastRound && (
        <View style={[styles.panelDark, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Resultat Manche</Text>
          <Text style={[styles.panelText, { color: theme.sub }]}>
            Gagnant: {snapshot.players.find((p) => p.id === snapshot.lastRound?.winnerId)?.name ?? 'Inconnu'}
          </Text>
          {snapshot.lastRound.penalties.map((entry) => (
            <Text key={`pen-${entry.playerId}`} style={[styles.panelText, { color: theme.sub }]}>
              - {snapshot.players.find((p) => p.id === entry.playerId)?.name ?? entry.playerId}: {entry.value}
            </Text>
          ))}
          {snapshot.phase !== 'gameOver' && isHost && (
            <Pressable style={[styles.btnPrimary, { backgroundColor: theme.primary }]} onPress={() => send({ type: 'start_next_round' })}>
              <Text style={[styles.btnPrimaryText, { color: theme.primaryText }]}>Manche suivante</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  const renderModePage = () => (
    <View style={[styles.rootScroll, styles.connectPageScroll, isCompactMobile && styles.rootScrollCompact]}>
      <View
        style={[
          styles.topTitleRow,
          isCompactMobile && styles.topTitleRowCompact,
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
        ]}
      >
        <Text style={[styles.gameTitle, isCompactMobile && styles.gameTitleCompact, { color: theme.title }]}>5 COURONNES - MODES</Text>
        <Text style={[styles.gameSubTitle, isCompactMobile && styles.gameSubTitleCompact, { color: theme.sub }]}>
          Choisis ton experience de jeu
        </Text>
      </View>
      <View style={[styles.modePanelWrap, { width: isCompactMobile ? '100%' : 460 }]}>
        <View style={[styles.panelDark, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Pressable style={[styles.modeChoiceButton, { borderColor: theme.cardBorder }]} onPress={() => selectEntryMode('solo')}>
            <Text style={[styles.modeChoiceTitle, { color: theme.text }]}>Solo (bots)</Text>
            <Text style={[styles.modeChoiceText, { color: theme.sub }]}>Une salle se cree, bots ajoutes auto, partie lancee auto.</Text>
          </Pressable>
          <Pressable
            style={[styles.modeChoiceButton, { borderColor: theme.cardBorder }]}
            onPress={() => selectEntryMode('multi_internet')}
          >
            <Text style={[styles.modeChoiceTitle, { color: theme.text }]}>Multi internet</Text>
            <Text style={[styles.modeChoiceText, { color: theme.sub }]}>Creation/rejoin de salle via URL Render en wss://</Text>
          </Pressable>
          <View style={[styles.modeChoiceButton, styles.modeChoiceButtonDisabled, { borderColor: theme.cardBorder }]}>
            <Text style={[styles.modeChoiceTitle, { color: theme.sub }]}>Multi local (hote telephone)</Text>
            <Text style={[styles.modeChoiceText, { color: theme.sub }]}>Etape 2: a venir (hote sur telephone).</Text>
          </View>
          <Text style={[styles.statusText, { color: theme.sub }]}>{statusText}</Text>
        </View>
      </View>
    </View>
  );

  const renderConnectPage = () => (
    <View style={[styles.rootScroll, styles.connectPageScroll, isCompactMobile && styles.rootScrollCompact]}>
      <View
        style={[
          styles.topTitleRow,
          isCompactMobile && styles.topTitleRowCompact,
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
        ]}
      >
        <Text style={[styles.gameTitle, isCompactMobile && styles.gameTitleCompact, { color: theme.title }]}>
          {entryPlayMode === 'solo' ? '5 COURONNES - SOLO' : '5 COURONNES - CONNEXION'}
        </Text>
        <Text style={[styles.gameSubTitle, isCompactMobile && styles.gameSubTitleCompact, { color: theme.sub }]}>
          {entryPlayMode === 'solo'
            ? 'Connecte-toi puis lance la partie solo'
            : 'Entre ton pseudo puis cree/rejoins une table'}
        </Text>
      </View>
      <View style={[styles.connectPanelWrap, { width: isCompactMobile ? '100%' : 460 }]}>
        <Pressable
          style={[styles.modeBackButton, { borderColor: theme.cardBorder, backgroundColor: theme.secondary }]}
          onPress={() => setCurrentPage('mode')}
        >
          <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Retour aux modes</Text>
        </Pressable>
      </View>
      {renderConnectionPanel()}
    </View>
  );

  const renderTablePage = () => {
    const roomCodeDisplay = snapshot?.roomCode || roomCode || '------';
    const connectedPlayers = snapshot ? snapshot.players.filter((p) => p.connected).length : 0;
    const timeLabel = `${snapshot?.turnSecondsLeft ?? 0}s`;
    const canAddBot = Boolean(isHost && snapshot?.phase === 'lobby');
    const canForceValidateRound = Boolean(isHost && snapshot?.phase === 'inRound');
    const canResumeRound = Boolean(isHost && snapshot?.phase === 'roundEnded');
    const showSidePanel = false;
    return (
      <View style={styles.tableScaleViewport}>
        <View
          style={[
            styles.tableScaleSurface,
            {
              width: `${100 / tableResponsiveScale}%`,
              height: `${100 / tableResponsiveScale}%`,
              transform: [{ scale: tableResponsiveScale }],
            },
          ]}
        >
          <View style={[styles.tablePageRoot, isCompactMobile && styles.tablePageRootCompact]}>
            <View
              style={[styles.tableHeaderBar, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onLayout={(event) => setTableHeaderHeight(Math.round(event.nativeEvent.layout.height))}
            >
              <Text
                numberOfLines={1}
                style={[styles.tableHeaderInlineText, { color: theme.secondaryText, fontSize: Math.max(10, Math.round(12 * ui.scale)) }]}
              >
                {BUILD_MARKER} | Salle {roomCodeDisplay} | Manche {snapshot?.roundNumber ?? '-'} / {snapshot?.maxRounds ?? 11} | Joueurs {connectedPlayers}/7 | {timeLabel}
              </Text>
              <View style={styles.tableHeaderActions}>
                <Pressable
                  style={[
                    styles.headerBotButton,
                    { minHeight: ui.headerActionHeight, paddingHorizontal: Math.max(6, Math.round(8 * ui.scale)) },
                    { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                    !canAddBot && styles.btnDisabled,
                  ]}
                  onPress={addLobbyBot}
                  disabled={!canAddBot}
                >
                  <Text style={[styles.headerBotButtonText, { color: theme.secondaryText, fontSize: ui.headerActionFontSize }]}>Bot +1</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.headerBotButton,
                    { minHeight: ui.headerActionHeight, paddingHorizontal: Math.max(6, Math.round(8 * ui.scale)) },
                    { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                    !snapshot && styles.btnDisabled,
                  ]}
                  onPress={() => setStatsVisible(true)}
                  disabled={!snapshot}
                >
                  <Text style={[styles.headerBotButtonText, { color: theme.secondaryText, fontSize: ui.headerActionFontSize }]}>Stats</Text>
                </Pressable>
                {DEBUG_UI_ENABLED ? (
                  <Pressable
                    style={[
                      styles.headerDebugButton,
                      { minHeight: ui.headerActionHeight, paddingHorizontal: Math.max(6, Math.round(8 * ui.scale)) },
                      { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                      !canForceValidateRound && styles.btnDisabled,
                    ]}
                    onPress={() => {
                      send({ type: 'debug_force_validate_round' });
                      setStatusText('Validation debug demandee...');
                    }}
                    disabled={!canForceValidateRound}
                  >
                    <Text style={[styles.headerBotButtonText, { color: theme.secondaryText, fontSize: ui.headerActionFontSize }]}>Debug</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    styles.headerDebugButton,
                    { minHeight: ui.headerActionHeight, paddingHorizontal: Math.max(6, Math.round(8 * ui.scale)) },
                    { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                    !canResumeRound && styles.btnDisabled,
                  ]}
                  onPress={() => {
                    send({ type: 'start_next_round' });
                    setStatusText('Reprise de la manche suivante...');
                  }}
                  disabled={!canResumeRound}
                >
                  <Text style={[styles.headerBotButtonText, { color: theme.secondaryText, fontSize: ui.headerActionFontSize }]}>Reprises</Text>
                </Pressable>
                <Pressable
                  style={[styles.themeIconButton, { backgroundColor: theme.secondary, borderColor: theme.cardBorder }]}
                  onPress={() => setSettingsVisible(true)}
                >
                  <Text style={[styles.themeIconText, { color: theme.secondaryText }]}>{'\u2699'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.mainLayout, styles.tablePageContent, isWide && styles.mainLayoutWide]}>
              <View
                style={[styles.leftColumn, { width: isWide && showSidePanel ? ui.leftColumnWidth : '100%' }]}
                onLayout={(event) => setLeftColumnHeight(Math.round(event.nativeEvent.layout.height))}
              >
                {renderTable()}
              </View>
              {showSidePanel ? renderGameSidePanel() : null}
              {isPortraitLike ? (
                <Text style={[styles.orientationTextInline, { color: theme.sub }]}>
                  Mode portrait detecte: interface adaptee automatiquement.
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.screenBg }]}>
      <StatusBar style={theme.statusBar} />
      {renderHexBackground()}
      <View style={styles.topFade} pointerEvents="none" />
      {currentPage === 'mode' ? renderModePage() : currentPage === 'connect' ? renderConnectPage() : renderTablePage()}
      <Modal transparent visible={statsVisible} animationType="fade" onRequestClose={() => setStatsVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Stats</Text>
            <View style={styles.statsList}>
              {statsRanking.length > 0 ? (
                statsRanking.map((player, index) => (
                  <Text key={`stats-${player.id}`} style={[styles.statsItem, { color: theme.sub }]}>
                    {index + 1}. {player.name} - {player.totalScore} pts
                  </Text>
                ))
              ) : (
                <Text style={[styles.statsItem, { color: theme.sub }]}>Aucune statistique disponible.</Text>
              )}
            </View>
            <Pressable
              style={[styles.btnSecondary, { backgroundColor: theme.secondary, borderColor: theme.cardBorder }]}
              onPress={() => setStatsVisible(false)}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={settingsVisible} animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Parametres</Text>
            {THEME_KEYS.map((key) => {
              const isActive = key === themeKey;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: isActive ? theme.primary : theme.secondary,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => setThemeKey(key)}
                >
                  <Text style={[styles.themeOptionText, { color: isActive ? theme.primaryText : theme.secondaryText }]}>
                    {THEMES[key].name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable style={[styles.btnDanger, { backgroundColor: theme.danger }]} onPress={disconnect}>
              <Text style={[styles.btnDangerText, { color: theme.dangerText }]}>Se deconnecter</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, { backgroundColor: theme.secondary, borderColor: theme.cardBorder }]}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Fermer</Text>
            </Pressable>
            <Text style={[styles.optionVersionText, { color: theme.sub }]}>Version {APP_VERSION}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05070B', overflow: 'hidden' },
  rootScroll: { padding: 14, gap: 12, paddingBottom: 24 },
  rootScrollCompact: { padding: 10, gap: 10, paddingBottom: 18 },
  tablePageRoot: { flex: 1, padding: 14, gap: 10, paddingBottom: 12, minHeight: 0 },
  tablePageRootCompact: { padding: 10, gap: 8, paddingBottom: 8 },
  tableScaleViewport: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tableScaleSurface: {
    minHeight: 0,
    minWidth: 0,
  },
  tablePageContent: { flex: 1, minHeight: 0 },
  connectPageScroll: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainLayout: { gap: 12, flexDirection: 'column' },
  mainLayoutWide: { flexDirection: 'row', alignItems: 'stretch' },
  leftColumn: { flex: 1, gap: 10, minHeight: 0 },
  rightColumn: { gap: 10, minHeight: 0, flexShrink: 1 },
  connectPanelWrap: { alignSelf: 'center' },
  modePanelWrap: { alignSelf: 'center' },
  modeChoiceButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  modeChoiceButtonDisabled: {
    opacity: 0.62,
  },
  modeChoiceTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  modeChoiceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modeBackButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },

  hexLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
    paddingTop: 8,
  },
  hexRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 2,
  },
  hexCell: {
    width: 24,
    height: 22,
    backgroundColor: '#0F1219',
    borderWidth: 1,
    borderColor: '#1D2530',
    transform: [{ skewX: '-20deg' }],
  },
  topFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  topTitleRow: {
    borderWidth: 1,
    borderColor: '#303845',
    backgroundColor: 'rgba(8,12,18,0.92)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
  },
  topTitleRowCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  gameTitle: { color: '#E2E8F0', fontWeight: '900', letterSpacing: 0.7, fontSize: 16 },
  gameTitleCompact: { fontSize: 14, letterSpacing: 0.3 },
  gameSubTitle: { color: '#9AA7BA', fontSize: 12, fontWeight: '700' },
  gameSubTitleCompact: { fontSize: 11 },
  connectHint: { color: '#93C5FD', fontSize: 12, fontWeight: '600' },

  tableHeaderBar: {
    borderWidth: 1,
    borderColor: '#2D3644',
    backgroundColor: 'rgba(11,16,24,0.94)',
    borderRadius: 6,
    padding: 5,
    gap: 5,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
  },
  tableHeaderInlineText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 0,
    marginRight: 8,
  },
  tableHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBotButton: {
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDebugButton: {
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBotButtonText: {
    fontSize: 10,
    fontWeight: '900',
  },
  tableHeaderLeft: { gap: 3, minWidth: 70, flex: 1 },
  tableHeaderTitle: { color: '#F8FAFC', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  tableCodeBadge: {
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  tableCodeLabel: { color: '#A7F3D0', fontSize: 9, fontWeight: '700' },
  tableCodeValue: { color: '#ECFEFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  headerStatsWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  headerStatChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerStatChipAction: { borderStyle: 'dashed' },
  headerStatText: { fontSize: 10, fontWeight: '700' },
  themeIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIconText: { fontSize: 12, fontWeight: '700' },
  orientationGate: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(11,16,24,0.94)',
    borderRadius: 12,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  orientationTitle: { color: '#E2E8F0', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  orientationText: { color: '#9AA7BA', fontSize: 13, fontWeight: '600', textAlign: 'center', maxWidth: 700 },
  orientationTextInline: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  statsList: {
    gap: 4,
    maxHeight: 260,
  },
  statsItem: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  themeOptionText: { fontSize: 14, fontWeight: '800' },
  optionVersionText: { fontSize: 12, textAlign: 'center', marginTop: 2 },

  tableShell: {
    width: '100%',
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableImageFrame: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  tableBgImage: {
    position: 'absolute',
  },
  tableFeltLayer: {
    position: 'absolute',
    overflow: 'visible',
  },
  tableFelt: {
    width: '100%',
    height: '100%',
    borderRadius: 208,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'visible',
    position: 'relative',
  },
  feltGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  waitingText: {
    marginTop: 190,
    textAlign: 'center',
    color: '#D1FAE5',
    fontSize: 16,
    fontWeight: '700',
  },
  boardPlayZone: {
    position: 'absolute',
    left: '50%',
    top: '20%',
    bottom: '24%',
    borderRadius: 18,
    borderWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    zIndex: 30,
  },
  debugExposeZonesOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  debugExposeZoneBox: {
    position: 'absolute',
    borderWidth: 5,
    borderColor: '#FF1F1F',
    backgroundColor: 'transparent',
  },
  debugExposeZoneLabel: {
    position: 'absolute',
    minWidth: 16,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    color: '#FF1F1F',
    backgroundColor: 'rgba(2,6,23,0.75)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  debugExposeZoneTitle: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '900',
    color: '#FF1F1F',
    backgroundColor: 'rgba(2,6,23,0.75)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 3,
  },
  debugExposeZoneTitleOutside: {
    transform: [{ translateX: -58 }],
  },
  debugExposeZoneLabelTop: {
    top: -12,
    left: '50%',
    marginLeft: -8,
  },
  debugExposeZoneLabelRight: {
    right: -12,
    top: '50%',
    marginTop: -9,
  },
  debugExposeZoneLabelBottom: {
    bottom: -12,
    left: '50%',
    marginLeft: -8,
  },
  debugExposeZoneLabelLeft: {
    left: -12,
    top: '50%',
    marginTop: -9,
  },
  debugExposeContent: {
    position: 'absolute',
    top: 4,
    left: 3,
    right: 3,
    bottom: 3,
  },
  debugExposeContentDense: {
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
  },
  debugExposeContentInner: {
    gap: 2,
    paddingBottom: 2,
    width: '100%',
  },
  debugExposeContentInnerDense: {
    gap: 1,
    paddingBottom: 1,
  },
  debugExposeEntriesGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  debugExposeEntriesGridDense: {
    justifyContent: 'space-between',
  },
  debugExposeEntry: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 1,
    paddingVertical: 1,
    gap: 1,
    backgroundColor: 'transparent',
  },
  debugExposeEntryColumn: {
    width: '50%',
    maxWidth: '50%',
    minWidth: 0,
    marginBottom: 1,
  },
  debugExposeEntryDense: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 1,
  },
  debugExposeEntryTitle: {
    fontSize: 7,
    fontWeight: '800',
  },
  debugExposeEntryTitleDense: {
    fontSize: 6,
  },
  debugExposeRowsStack: {
    gap: 1,
  },
  debugExposeRowsStackDense: {
    gap: 0,
  },
  debugExposeCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  debugExposeMeldRow: {
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
  },
  debugExposeFixedRow: {
    minHeight: 29,
  },
  debugExposeMeldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 1,
    rowGap: 1,
    alignItems: 'flex-start',
  },
  debugExposeMeldsGridDense: {
    columnGap: 1,
    rowGap: 1,
  },
  debugExposeMeldCell: {
    width: '50%',
    minWidth: 30,
  },
  debugExposeMeldCellDense: {
    minWidth: 26,
  },
  debugExposeCardsRowDense: {
    gap: 1,
  },
  debugExposeCardChip: {
    minWidth: 23,
    height: 27.3,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  debugExposeCardRank: {
    fontSize: 12.6,
    fontWeight: '900',
    color: '#0F172A',
    includeFontPadding: false,
    lineHeight: 12.6,
    textAlign: 'left',
  },
  debugExposeCardSuit: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#334155',
    includeFontPadding: false,
    lineHeight: 9.5,
    textAlign: 'left',
  },
  debugExposeMeldCardChip: {
    marginLeft: 0,
  },
  debugExposeMeldCardChipOverlap: {
    marginLeft: -11.5,
  },
  debugExposeDeadwoodWrap: {
    gap: 1,
  },
  debugExposeDeadwoodRow: {
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
  },
  debugExposeDeadwoodWrapDense: {
    gap: 0,
  },
  debugExposeDeadwoodLabel: {
    fontSize: 6,
    fontWeight: '700',
  },
  debugExposeDeadwoodLabelDense: {
    fontSize: 5,
  },
  debugExposeDeadwoodLabelInline: {
    fontSize: 6,
    fontWeight: '700',
    marginRight: 2,
    lineHeight: 9,
    includeFontPadding: false,
  },
  debugExposeDeadwoodLabelInlineDense: {
    fontSize: 5,
    marginRight: 1,
    lineHeight: 8,
  },
  boardCenterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 10,
  },
  exposedColumn: {
    width: 128,
    minHeight: 8,
    gap: 6,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  exposedPlayerBlock: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 4,
    gap: 4,
  },
  exposedPlayerName: {
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'left',
  },
  exposedMeldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  exposedMiniCard: {
    width: 18,
    height: 25,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  exposedMiniRank: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0F172A',
    includeFontPadding: false,
    textAlign: 'center',
  },
  exposedMiniSuit: {
    fontSize: 8,
    fontWeight: '900',
    color: '#334155',
    includeFontPadding: false,
    textAlign: 'center',
  },
  boardCenterTextCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    transform: [{ translateY: -10 }],
  },
  boardRankTopItem: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
  },
  boardRankGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -1,
    rowGap: 1,
  },
  boardRankGridItem: {
    width: '50%',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
    textAlign: 'left',
  },
  boardRightColumn: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  boardRightRail: {
    position: 'relative',
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 28,
  },
  boardValidateButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  boardValidateButtonText: {
    fontSize: 6,
    fontWeight: '900',
  },
  boardSortButtonsCol: {
    width: '100%',
    gap: 4,
    alignItems: 'stretch',
  },
  boardSortButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardSortButtonText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  discardDropZone: {
    borderRadius: 12,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  actionCardPileFull: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  actionCardDropReady: {
    borderColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  actionCardDiscardFaceWrap: {
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  discardFaceCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8DA3B8',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  discardFaceRank: {
    fontWeight: '900',
    color: '#0F172A',
    includeFontPadding: false,
    textAlign: 'center',
  },
  discardFaceSuit: {
    fontWeight: '900',
    color: '#334155',
    includeFontPadding: false,
    textAlign: 'center',
  },
  actionCardRank: { fontSize: 13, fontWeight: '900' },
  actionCardSuit: { fontSize: 10, fontWeight: '900' },
  actionCardLabel: { fontSize: 7, fontWeight: '800', textTransform: 'uppercase' },
  actionCardBackThumb: {
    width: '100%',
    height: '100%',
  },
  actionCardCount: { fontSize: 8, fontWeight: '800' },
  boardLobbyStart: {
    position: 'absolute',
    top: '66%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  seatAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  seatIdentityUnderCards: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
    zIndex: 20,
  },
  seatIdentityInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  seatRoleBadgesRight: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
  },
  seatRoleBadgesLeft: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  sideSeatRoleBelowName: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: [{ translateX: -20 }],
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  namePill: {
    alignSelf: 'center',
    maxWidth: 126,
    minHeight: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(15,23,42,0.74)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extremityNamePillLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: 6,
    paddingRight: 8,
  },
  extremityNamePillRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    paddingLeft: 8,
    paddingRight: 6,
  },
  namePillActive: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(120,80,0,0.28)',
  },
  handNamePill: {
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  seatNameUnderCards: {
    textAlign: 'center',
    color: '#E5E7EB',
    fontWeight: '900',
    includeFontPadding: false,
    maxWidth: 72,
  },
  sideSeatNameSingleLine: {
    maxWidth: 110,
    lineHeight: 14,
  },
  extremityNameTextLeft: {
    textAlign: 'left',
  },
  extremityNameTextRight: {
    textAlign: 'right',
  },
  sideSeatNameLeftRotate: {
    transform: [{ rotate: '360deg' }],
  },
  sideSeatNameRightRotate: {
    transform: [{ rotate: '360deg' }],
  },
  seatNameUnderCardsActive: { color: '#FACC15', letterSpacing: 0.4 },
  playerRoleBadge: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  playerRoleBadgeDeal: {
    backgroundColor: '#047857',
  },
  playerRoleBadgeShuffle: {
    backgroundColor: '#A16207',
  },
  playerRoleBadgeText: {
    color: '#F8FAFC',
    fontSize: 5,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 6,
  },

  seatTag: {
    position: 'absolute',
    width: 132,
    minHeight: 54,
    borderRadius: 9,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: '#4B5563',
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatTagAnchor: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
  },
  seatPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 9,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatTagMine: {
    borderColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  seatTagActive: {
    borderColor: '#FACC15',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  seatTagEmpty: {
    borderStyle: 'dashed',
    backgroundColor: 'rgba(40,48,62,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatPlayerWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  seatAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    backgroundColor: 'rgba(34,211,238,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatAvatarText: { color: '#E0F2FE', fontWeight: '900', fontSize: 10 },
  seatIdentityBlock: { flex: 1, minWidth: 0 },
  seatNameText: {
    color: '#E5E7EB',
    fontWeight: '900',
    fontSize: 12,
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
    width: '100%',
  },
  seatNameTextActive: { color: '#FACC15', letterSpacing: 0.4 },
  seatBackFanWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    pointerEvents: 'none',
  },
  seatBackFanRotateWrap: {
    position: 'relative',
  },
  seatBackCard: {
    position: 'absolute',
    borderRadius: 5,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  seatBackImage: {
    width: '100%',
    height: '100%',
  },
  seatScoreText: { color: '#93C5FD', fontWeight: '700', fontSize: 9 },
  seatScoreTextActive: { color: '#FDE68A' },
  seatCountBadge: {
    minWidth: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FDE047',
    backgroundColor: 'rgba(254,240,138,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  seatCountText: { color: '#FDE68A', fontWeight: '900', fontSize: 10 },
  seatEmptyText: { color: '#93A0B2', fontSize: 10, fontStyle: 'italic' },

  tableCenterInfo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 330,
    marginLeft: -165,
    marginTop: -85,
    alignItems: 'center',
    gap: 6,
  },
  centerTitle: {
    color: '#6EE7B7',
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 1.6,
  },
  centerSub: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  centerDragHint: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 260,
  },
  pilesRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  pileCard: {
    width: 150,
    minHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  pileDraw: {
    backgroundColor: 'rgba(2,44,34,0.95)',
    borderColor: '#6EE7B7',
  },
  pileDiscard: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderColor: '#94A3B8',
  },
  pileDisabled: { opacity: 0.5 },
  pileLabel: { color: '#E5E7EB', fontWeight: '900', fontSize: 12, letterSpacing: 0.6 },
  pileValue: { color: '#F8FAFC', fontWeight: '800', fontSize: 13 },
  lobbyStartWrap: { marginTop: 8, alignItems: 'center' },
  lobbyStartButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  lobbyStartButtonText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  lobbyWaitingText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  panelDark: {
    borderWidth: 1,
    borderColor: '#2D3644',
    backgroundColor: 'rgba(11,16,24,0.94)',
    borderRadius: 12,
    padding: 11,
    gap: 8,
  },
  panelTitle: { color: '#F3F4F6', fontWeight: '900', fontSize: 15, letterSpacing: 0.4 },
  panelText: { color: '#C8D2E1', fontSize: 13, fontWeight: '600' },
  panelHint: { color: '#93C5FD', fontSize: 12, fontWeight: '700' },
  panelEvent: {
    color: '#FCD34D',
    fontSize: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 6,
    fontStyle: 'italic',
  },
  statusText: { color: '#9AA7BA', fontSize: 12 },
  connectModeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  connectModeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  connectModeChipActive: {
    backgroundColor: 'rgba(14,116,144,0.35)',
  },
  connectModeChipInactive: {
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  connectModeChipText: { fontSize: 12, fontWeight: '800' },
  connectModeHint: { fontSize: 11, fontWeight: '600' },
  darkInput: {
    borderWidth: 1,
    borderColor: '#364254',
    borderRadius: 9,
    backgroundColor: '#0B1220',
    color: '#E5E7EB',
    paddingHorizontal: 9,
    paddingVertical: 8,
    fontSize: 13,
  },
  btnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnPrimary: {
    backgroundColor: '#0F766E',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  btnPrimaryText: { color: '#ECFEFF', fontWeight: '800', fontSize: 13 },
  btnSecondary: {
    backgroundColor: '#1E293B',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#475569',
  },
  btnSecondaryText: { color: '#E2E8F0', fontWeight: '800', fontSize: 13 },
  btnDanger: {
    backgroundColor: '#7F1D1D',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  btnDangerText: { color: '#FEE2E2', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.45 },
  debugWrap: {
    borderWidth: 1,
    borderColor: '#3F4B60',
    backgroundColor: 'rgba(23,32,49,0.85)',
    borderRadius: 9,
    padding: 8,
    gap: 6,
  },
  debugCountInput: {
    width: 54,
    borderWidth: 1,
    borderColor: '#3F4B60',
    borderRadius: 8,
    backgroundColor: '#0B1220',
    color: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
    fontWeight: '800',
  },

  handPanelCasino: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  handPanelOnTable: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 14,
    transform: [{ translateY: 24 }],
    zIndex: 16,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  handPlayerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  handPlayerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  handHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handPlayerName: { fontSize: 15, fontWeight: '900' },
  handPlayerNameActive: { color: '#FACC15', letterSpacing: 0.5 },
  handPlayerScore: { fontSize: 11, fontWeight: '700' },
  handValidateButtonMini: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  handValidateButtonMiniText: { fontSize: 11, fontWeight: '900' },
  handDiscardHint: { fontSize: 11, fontWeight: '700' },
  handDiscardButtonMini: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  handDiscardButtonMiniText: { fontSize: 11, fontWeight: '900' },
  handValidatedHint: { fontSize: 11, fontWeight: '700' },
  handSortButtonsRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transform: [{ translateY: 24 }],
    marginBottom: 1,
  },
  handSortButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 1,
    paddingVertical: 3,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handSortButtonText: {
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.15,
  },
  handFanWrap: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    paddingBottom: 2,
  },
  handNameUnderCards: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
    color: '#E5E7EB',
    includeFontPadding: false,
    alignSelf: 'center',
  },
  handNameUnderCardsActive: { color: '#FACC15', letterSpacing: 0.4 },
  handIdentityUnderCards: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  handRoleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  handInsertSlot: {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    zIndex: 900,
  },
  handCardWrap: {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  handRow: { gap: 6, paddingVertical: 4, flexDirection: 'row', flexWrap: 'wrap' },
  handCardCasino: {
    width: 86,
    height: 116,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#8DA3B8',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'space-between',
  },
  handCard: {
    width: 86,
    height: 116,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8DA3B8',
    backgroundColor: '#0F172A',
    padding: 8,
    justifyContent: 'space-between',
  },
  handCardSelected: {
    transform: [{ translateY: -12 }],
  },
  handCardRank: { fontSize: 21, fontWeight: '900', color: '#0F172A' },
  handCardSuit: { fontSize: 16, fontWeight: '900', color: '#1E293B' },

  devPlayerBlock: {
    borderTopWidth: 1,
    borderTopColor: '#2A3341',
    paddingTop: 7,
    gap: 6,
  },
  devCardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  devStaticWrap: { gap: 6, maxHeight: 170, overflow: 'hidden' },
  devCardChip: {
    borderWidth: 1,
    borderColor: '#425069',
    backgroundColor: '#0F172A',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  devCardText: { color: '#E2E8F0', fontSize: 11, fontWeight: '800' },
});

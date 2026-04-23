import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
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
type HandDragPreview = {
  cardId: string;
  fromIndex: number;
  toIndex: number;
};

type ThemeKey = 'noir-or' | 'ivoire-bordeaux' | 'emeraude' | 'rose-luxe';
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

const resolveDefaultServerUrl = (): string => {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return DEFAULT_SERVER_URL_FALLBACK;
  }
  return `ws://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
};

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();
const MAX_SEATS = 7;
const APP_VERSION = (require('../../app.json')?.expo?.version as string | undefined) ?? '1.0.0';
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
    3: [p(50, 94), p(6, 52), p(94, 52)],
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
  onSelect: (cardId: string) => void;
  onReorderInHand: (fromIndex: number, toIndex: number) => void;
  onReorderPreview: (cardId: string, fromIndex: number, toIndex: number) => void;
  onReorderPreviewEnd: (cardId: string) => void;
  onDropToDiscard: (cardId: string, x: number, y: number) => boolean;
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
  onSelect,
  onReorderInHand,
  onReorderPreview,
  onReorderPreviewEnd,
  onDropToDiscard,
}: DraggableHandCardProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState(false);
  const dragDistanceRef = useRef(0);
  const previewIndexRef = useRef(stackIndex);

  const resetCardPosition = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      bounciness: 0,
      speed: 20,
    }).start(() => setDragging(false));
  }, [pan]);

  const handleSelect = useCallback(() => {
    onSelect(card.id);
  }, [onSelect, card.id]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragDistanceRef.current = 0;
          previewIndexRef.current = stackIndex;
          setDragging(false);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!canDragToDiscard && !canReorderInHand) return;
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
          const distance = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);
          dragDistanceRef.current = distance;
          if (canReorderInHand) {
            const step = Math.max(12, dragStep);
            const shift = computeReorderShift(gestureState.dx, step);
            const previewIndex = Math.max(0, Math.min(cardCount - 1, stackIndex + shift));
            if (previewIndex !== previewIndexRef.current) {
              previewIndexRef.current = previewIndex;
              onReorderPreview(card.id, stackIndex, previewIndex);
            }
          }
          if (distance > 8 && !dragging) {
            setDragging(true);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const movedEnough = dragDistanceRef.current > 10;
          if (movedEnough) {
            let droppedToDiscard = false;
            if (canDragToDiscard) {
              droppedToDiscard = onDropToDiscard(card.id, gestureState.moveX, gestureState.moveY);
            }
            if (!droppedToDiscard) {
              const mostlyHorizontalDrag = Math.abs(gestureState.dx) >= Math.abs(gestureState.dy);
              if (canReorderInHand && mostlyHorizontalDrag) {
                const step = Math.max(12, dragStep);
                const shift = computeReorderShift(gestureState.dx, step);
                if (shift !== 0) {
                  const nextIndex = Math.max(0, Math.min(cardCount - 1, stackIndex + shift));
                  if (nextIndex !== stackIndex) {
                    onReorderInHand(stackIndex, nextIndex);
                  }
                } else {
                  handleSelect();
                }
              } else {
                handleSelect();
              }
            }
          } else {
            handleSelect();
          }
          previewIndexRef.current = stackIndex;
          onReorderPreviewEnd(card.id);
          resetCardPosition();
        },
        onPanResponderTerminate: () => {
          previewIndexRef.current = stackIndex;
          onReorderPreviewEnd(card.id);
          resetCardPosition();
        },
      }),
    [
      canDragToDiscard,
      canReorderInHand,
      card.id,
      cardCount,
      dragging,
      dragStep,
      handleSelect,
      onDropToDiscard,
      onReorderInHand,
      onReorderPreview,
      onReorderPreviewEnd,
      pan,
      resetCardPosition,
      stackIndex,
    ]
  );

  return (
    <Animated.View
      style={[
        styles.handCardWrap,
        {
          width: cardWidth,
          height: cardHeight,
          marginLeft: -Math.round(cardWidth / 2),
          zIndex: dragging ? 1000 : fanZIndex,
          transform: [
            { translateX: fanOffsetX },
            { translateY: fanOffsetY },
            { rotate: `${fanRotationDeg}deg` },
            ...pan.getTranslateTransform(),
          ],
        },
      ]}
      {...panResponder.panHandlers}
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
  );
});

export function RemotePlayScreen() {
  const wsRef = useRef<WebSocket | null>(null);
  const discardDropZoneRef = useRef<View | null>(null);
  const { width, height } = useWindowDimensions();
  const isWide = width >= 1200;
  const isCompactMobile = width < 520;
  const isShortScreen = height < 520;
  const isPortraitLike = height >= width;
  const ui = useMemo(() => {
    const horizontalPadding = isCompactMobile ? 18 : 28;
    const columnsGap = 12;
    const rightColumnWidth = isWide ? Math.max(300, Math.min(360, Math.round(width * 0.28))) : width - horizontalPadding;
    const leftColumnWidth = isWide
      ? Math.max(320, width - horizontalPadding - columnsGap - rightColumnWidth)
      : width - horizontalPadding;
    const tableWidth = Math.max(240, leftColumnWidth);
    const tableHeightLimit = isWide
      ? Math.min(560, Math.round(height * 0.72))
      : Math.max(260, Math.round(height * (isShortScreen ? 0.62 : 0.74)));
    const tableMinHeight = isCompactMobile || isShortScreen ? 220 : 260;
    const tableHeight = Math.round(Math.max(tableMinHeight, Math.min(tableWidth * 0.56, tableHeightLimit, 500)));
    const scale = Math.max(0.62, Math.min(Math.min(tableWidth / 980, tableHeight / 500), 1.2));

    const seatWidth = Math.round(Math.max(80, Math.min(112 * scale, 136)));
    const seatHeight = Math.round(Math.max(36, Math.min(46 * scale, 56)));
    const seatFont = Math.round(Math.max(10, Math.min(14 * scale, 16)));

    const centerWidth = Math.round(Math.max(210, Math.min(330 * scale, 390)));
    const centerTitleSize = Math.round(Math.max(16, Math.min(28 * scale, 34)));
    const centerSubSize = Math.round(Math.max(11, Math.min(14 * scale, 18)));
    const centerTopOffset = Math.round(Math.max(60, Math.min(85 * scale, 100)));

    const pileCardWidth = Math.round(Math.max(104, Math.min(150 * scale, 186)));
    const pileCardHeight = Math.round(Math.max(72, Math.min(88 * scale, 106)));
    const pileLabelSize = Math.round(Math.max(10, Math.min(12 * scale, 15)));
    const pileValueSize = Math.round(Math.max(11, Math.min(13 * scale, 16)));

    const handCardsPerRow = isCompactMobile ? 6 : 7;
    const handGap = 8;
    const handAvailableWidth = Math.max(220, tableWidth - 12);
    const fittedHandWidth = Math.floor((handAvailableWidth - handGap * (handCardsPerRow - 1)) / handCardsPerRow);
    const handCardWidth = Math.round(Math.max(38, Math.min(fittedHandWidth, Math.min(86 * scale, 98))));
    const handCardHeight = Math.round(Math.max(56, Math.min(handCardWidth * 1.35, 130)));
    const handCardScale = 0.48;
    const handRankSize = Math.round(Math.max(8, Math.min(21 * scale * handCardScale, 12)));
    const handSuitSize = Math.round(Math.max(5, Math.min(11 * scale * handCardScale, 7)));
    const baseCasinoHandCardWidth = Math.round(Math.max(44, Math.min(handCardWidth + 8, 86)));
    const baseCasinoHandCardHeight = Math.round(Math.max(70, Math.min(baseCasinoHandCardWidth * 1.45, 126)));
    const casinoHandCardWidth = Math.round(baseCasinoHandCardWidth * handCardScale);
    const casinoHandCardHeight = Math.round(baseCasinoHandCardHeight * handCardScale);
    const casinoHandOverlap = Math.round(Math.max(8, Math.min(casinoHandCardWidth * 0.44, 24)));

    const rimOuterPadding = Math.round(Math.max(6, Math.min(10 * scale, 14)));
    const rimInnerPadding = Math.round(Math.max(5, Math.min(8 * scale, 12)));
    const tableOuterRadius = Math.round(tableHeight / 2);
    const tableInnerRadius = Math.round((tableHeight - rimOuterPadding * 2) / 2);
    const tableFeltRadius = Math.round((tableHeight - rimOuterPadding * 2 - rimInnerPadding * 2) / 2);
    const waitingTextMargin = Math.round(Math.max(94, tableHeight * 0.4));
    const seatPanelWidth = Math.round(Math.max(88, Math.min(122 * scale, 148)));
    const seatPanelHeight = Math.round(Math.max(36, Math.min(48 * scale, 60)));
    const actionCardWidth = Math.round(Math.max(70, Math.min(94 * scale, 112)));
    const actionCardHeight = Math.round(Math.max(94, Math.min(actionCardWidth * 1.35, 144)));

    return {
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
    };
  }, [width, height, isWide, isCompactMobile, isShortScreen]);

  const [connectionState, setConnectionState] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [currentPage, setCurrentPage] = useState<'connect' | 'table'>('connect');
  const [themeKey, setThemeKey] = useState<ThemeKey>('noir-or');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [name, setName] = useState('Joueur');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [roomCode, setRoomCode] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [tableHeaderHeight, setTableHeaderHeight] = useState(0);
  const [tableAreaHeight, setTableAreaHeight] = useState(0);
  const [leftColumnHeight, setLeftColumnHeight] = useState(0);
  const [discardDropRect, setDiscardDropRect] = useState<DropRect | null>(null);
  const [statusText, setStatusText] = useState('Non connecte');
  const [handOrderIds, setHandOrderIds] = useState<string[]>([]);
  const [handDragPreview, setHandDragPreview] = useState<HandDragPreview | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
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
        if (currentPage === 'connect') {
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
      setHandDragPreview(null);
    },
    [snapshot]
  );

  const updateHandReorderPreview = useCallback(
    (cardId: string, fromIndex: number, toIndex: number) => {
      if (!snapshot || !canReorderHand) return;
      const maxIndex = Math.max(0, orderedMyHand.length - 1);
      const clampedFrom = Math.max(0, Math.min(maxIndex, fromIndex));
      const clampedTo = Math.max(0, Math.min(maxIndex, toIndex));
      setHandDragPreview((prev) => {
        if (
          prev &&
          prev.cardId === cardId &&
          prev.fromIndex === clampedFrom &&
          prev.toIndex === clampedTo
        ) {
          return prev;
        }
        return { cardId, fromIndex: clampedFrom, toIndex: clampedTo };
      });
    },
    [snapshot, canReorderHand, orderedMyHand.length]
  );

  const clearHandReorderPreview = useCallback((cardId?: string) => {
    setHandDragPreview((prev) => {
      if (!prev) return prev;
      if (cardId && prev.cardId !== cardId) return prev;
      return null;
    });
  }, []);

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
      setHandDragPreview(null);
      return true;
    },
    [canDiscardTurn, discardDropRect]
  );

  const addLobbyBot = () => {
    if (!snapshot || snapshot.phase !== 'lobby') return;
    if (!isHost) {
      setStatusText('Seul lhote peut ajouter un bot.');
      return;
    }
    send({ type: 'add_debug_bots', count: 1 });
    setStatusText('Ajout bot en cours...');
  };

  const connect = (mode: 'create_room' | 'join_room') => {
    const trimmedUrl = serverUrl.trim();
    const trimmedName = name.trim() || 'Joueur';
    const trimmedCode = roomCodeToInput(roomCode);
    if (!trimmedUrl) {
      setStatusText('URL serveur manquante');
      return;
    }
    if (mode === 'join_room' && trimmedCode.length !== 6) {
      setStatusText('Code salle invalide (6 caracteres)');
      return;
    }

    wsRef.current?.close();
    wsRef.current = null;
    setSnapshot(null);
    setHandOrderIds([]);
    setHandDragPreview(null);
    setSelectedCardIds([]);
    setConnectionState('connecting');
    setStatusText('Connexion en cours...');

    try {
      const ws = new WebSocket(trimmedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        setStatusText('Connecte');
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
          setHandDragPreview(null);
          setSelectedCardIds((prev) => prev.filter((id) => handIds.has(id)));
          setCurrentPage('table');
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
        setCurrentPage('connect');
        setSettingsVisible(false);
        setHandOrderIds([]);
        setHandDragPreview(null);
        setSelectedCardIds([]);
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
    setSnapshot(null);
    setHandOrderIds([]);
    setHandDragPreview(null);
    setConnectionState('offline');
    setStatusText('Deconnecte');
    setSelectedCardIds([]);
    setCurrentPage('connect');
    setSettingsVisible(false);
  };

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
    const isEmpty = !seatPlayer;
    const isMine = Boolean(snapshot && seatPlayer && snapshot.youPlayerId === seatPlayer.id);
    const isActive = Boolean(snapshot && seatPlayer && snapshot.currentPlayerId === seatPlayer.id);
    return (
      <View
        key={`seat-${seatIndex}`}
        style={[
          styles.seatTag,
          {
            top: `${layout.top}%` as Percent,
            left: `${layout.left}%` as Percent,
            width: ui.seatPanelWidth,
            minHeight: ui.seatPanelHeight,
            marginLeft: -Math.round(ui.seatPanelWidth / 2),
            marginTop: -Math.round(ui.seatPanelHeight / 2),
          },
          isMine && styles.seatTagMine,
          isActive && styles.seatTagActive,
          isEmpty && styles.seatTagEmpty,
        ]}
      >
        {isEmpty ? (
          <Text numberOfLines={1} style={[styles.seatEmptyText, { fontSize: Math.max(10, ui.seatFont - 4) }]}>
            Place libre
          </Text>
        ) : (
          <View style={styles.seatPlayerWrap}>
            <Text
              numberOfLines={1}
              style={[
                styles.seatNameText,
                { fontSize: ui.seatFont },
                isActive && styles.seatNameTextActive,
              ]}
            >
              {seatPlayer.name}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTable = () => {
    const effectiveTableHeight = Math.max(180, tableAreaHeight || adaptiveTableHeight);
    const effectiveOuterRadius = Math.round(effectiveTableHeight / 2);
    const effectiveInnerRadius = Math.max(24, Math.round((effectiveTableHeight - ui.rimOuterPadding * 2) / 2));
    const effectiveFeltRadius = Math.max(
      20,
      Math.round((effectiveTableHeight - ui.rimOuterPadding * 2 - ui.rimInnerPadding * 2) / 2)
    );
    const effectiveWaitingMargin = Math.round(Math.max(64, effectiveTableHeight * 0.4));

    if (!snapshot) {
      return (
        <View
          style={styles.tableShell}
          onLayout={(event) => setTableAreaHeight(Math.round(event.nativeEvent.layout.height))}
        >
          <View
            style={[
              styles.tableRimOuter,
              {
                borderRadius: effectiveOuterRadius,
                padding: ui.rimOuterPadding,
                backgroundColor: theme.tableRimOuter,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.tableRimInner,
                {
                  borderRadius: effectiveInnerRadius,
                  padding: ui.rimInnerPadding,
                  backgroundColor: theme.tableRimInner,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.tableFelt,
                  {
                    borderRadius: effectiveFeltRadius,
                    backgroundColor: theme.tableFelt,
                    borderColor: theme.tableFeltBorder,
                  },
                ]}
              >
                <View style={styles.feltGlow} />
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
    const rankedPlayers = snapshot.players
      .filter((player) => player.connected)
      .slice()
      .sort((a, b) => a.totalScore - b.totalScore || a.name.localeCompare(b.name));
    const topRankPlayer = rankedPlayers[0] ?? null;
    const trailingRankPlayers = rankedPlayers.slice(1, 7);
    const actionCardCompactWidth = Math.max(40, Math.round(ui.actionCardWidth * 0.5));
    const actionCardCompactHeight = Math.max(56, Math.round(ui.actionCardHeight * 0.5));
    const playZoneWidth = Math.max(ui.centerWidth, actionCardCompactWidth * 2 + 220);
    const tableSeats = tableSeatPlayers
      .map((seatPlayer, idx) => ({
        seatPlayer,
        seatLayout: seatLayouts[idx] ?? { top: 50, left: 50, offsetX: -64, offsetY: -26 },
        seatIndex: idx,
      }));

    return (
      <View
        style={styles.tableShell}
        onLayout={(event) => setTableAreaHeight(Math.round(event.nativeEvent.layout.height))}
      >
        <View
          style={[
            styles.tableRimOuter,
            {
              borderRadius: effectiveOuterRadius,
              padding: ui.rimOuterPadding,
              backgroundColor: theme.tableRimOuter,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.tableRimInner,
              {
                borderRadius: effectiveInnerRadius,
                padding: ui.rimInnerPadding,
                backgroundColor: theme.tableRimInner,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.tableFelt,
                {
                  borderRadius: effectiveFeltRadius,
                  backgroundColor: theme.tableFelt,
                  borderColor: theme.tableFeltBorder,
                },
                ]}
              >
                <View style={styles.feltGlow} />
                <View
                  style={[
                    styles.boardPlayZone,
                    {
                      width: playZoneWidth,
                      marginLeft: -Math.round(playZoneWidth / 2),
                    },
                  ]}
                >
                  <View style={styles.boardCenterRow}>
                    <View style={styles.boardCenterTextCol}>
                      {topRankPlayer ? (
                        <Text style={[styles.boardRankTopItem, { color: theme.sub }]}>
                          1. {topRankPlayer.name} - {topRankPlayer.totalScore} pts
                        </Text>
                      ) : null}
                      <View style={styles.boardRankGrid}>
                        {trailingRankPlayers.map((player, index) => (
                          <Text key={`rank-${player.id}`} style={[styles.boardRankGridItem, { color: theme.sub }]}>
                            {index + 2}. {player.name} - {player.totalScore} pts
                          </Text>
                        ))}
                      </View>
                    </View>
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
                              {
                                width: actionCardCompactWidth,
                                minHeight: actionCardCompactHeight,
                                borderColor: theme.cardBorder,
                                backgroundColor: 'transparent',
                              },
                              !canDraw && styles.pileDisabled,
                              canDiscardTurn && styles.actionCardDropReady,
                            ]}
                            onPress={() => send({ type: 'action', action: 'draw_discard' })}
                            disabled={!canDraw}
                          >
                            <Text style={[styles.actionCardRank, { color: theme.text }]}>
                              {snapshot.discardTop ? rankLabel(snapshot.discardTop.rank) : '-'}
                            </Text>
                            <Text style={[styles.actionCardSuit, { color: suitTone(snapshot.discardTop?.suit ?? null) }]}>
                              {snapshot.discardTop ? suitGlyph(snapshot.discardTop.suit) : '?'}
                            </Text>
                            <Text style={[styles.actionCardLabel, { color: theme.text }]}>Defausse</Text>
                          </Pressable>
                        </View>
                        <Pressable
                          style={[
                            styles.actionCard,
                            {
                              width: actionCardCompactWidth,
                              minHeight: actionCardCompactHeight,
                              borderColor: theme.cardBorder,
                              backgroundColor: 'transparent',
                            },
                            !canDraw && styles.pileDisabled,
                          ]}
                          onPress={() => send({ type: 'action', action: 'draw_pile' })}
                          disabled={!canDraw}
                        >
                          <Text style={[styles.actionCardBack, { color: theme.text }]}>5R</Text>
                          <Text style={[styles.actionCardLabel, { color: theme.text }]}>Pioche</Text>
                          <Text style={[styles.actionCardCount, { color: theme.text }]}>{snapshot.drawPileCount}</Text>
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
    const fanTotalAngleDeg = handCount <= 4 ? 34 : handCount <= 7 ? 40 : handCount <= 8 ? 44 : handCount <= 10 ? 46 : 54;
    const fanHalfAngleDeg = fanTotalAngleDeg / 2;
    const fanStepAngleDeg = handCount > 1 ? fanTotalAngleDeg / (handCount - 1) : 0;
    const fanStepAngleRad = handCount > 1 ? (fanStepAngleDeg * Math.PI) / 180 : 0;
    const fanCompactFactor = 0.68;
    const targetStepX = Math.max(4, Math.round((ui.casinoHandCardWidth - ui.casinoHandOverlap) * fanCompactFactor));
    const fanRadius = Math.max(22, Math.round(targetStepX / Math.max(0.06, fanStepAngleRad)));
    const fanCenterLift = Math.max(8, Math.round(ui.casinoHandCardHeight * 0.22));
    const maxThetaRad = (fanHalfAngleDeg * Math.PI) / 180;
    const maxArcDrop = Math.round(fanRadius * (1 - Math.cos(maxThetaRad)));
    const activePreview =
      handDragPreview &&
      handDragPreview.fromIndex >= 0 &&
      handDragPreview.toIndex >= 0 &&
      handDragPreview.fromIndex < handCount &&
      handDragPreview.toIndex < handCount &&
      handDragPreview.fromIndex !== handDragPreview.toIndex
        ? handDragPreview
        : null;
    const previewThetaDeg =
      activePreview && handCount > 1 ? -fanHalfAngleDeg + activePreview.toIndex * fanStepAngleDeg : 0;
    const previewThetaRad = (previewThetaDeg * Math.PI) / 180;
    const previewOffsetX = Math.round(Math.sin(previewThetaRad) * fanRadius);
    const previewOffsetY = Math.round(fanRadius * (1 - Math.cos(previewThetaRad)) - fanCenterLift);
    const previewRotationDeg = Number((previewThetaDeg * 0.98).toFixed(2));
    return (
      <View pointerEvents="box-none" style={styles.handPanelOnTable}>
        {snapshot.validatedExposePlayerId === snapshot.youPlayerId ? (
          <Text style={[styles.handValidatedHint, { color: theme.title }]}>
            Tierces valides: glisse/choisis puis jette la carte finale.
          </Text>
        ) : null}

        <View
          style={[
            styles.handFanWrap,
            {
              height: ui.casinoHandCardHeight + maxArcDrop + 18,
              minHeight: ui.casinoHandCardHeight + maxArcDrop + 18,
            },
          ]}
        >
          {activePreview ? (
            <View
              pointerEvents="none"
              style={[
                styles.handInsertSlot,
                {
                  width: ui.casinoHandCardWidth,
                  height: ui.casinoHandCardHeight,
                  marginLeft: -Math.round(ui.casinoHandCardWidth / 2),
                  borderColor: theme.primary,
                  transform: [
                    { translateX: previewOffsetX },
                    { translateY: previewOffsetY },
                    { rotate: `${previewRotationDeg}deg` },
                  ],
                },
              ]}
            />
          ) : null}
          {orderedMyHand.map((card, index) => {
            const selected = selectedCardIds.includes(card.id);
            const baseThetaDeg = handCount > 1 ? -fanHalfAngleDeg + index * fanStepAngleDeg : 0;
            const baseThetaRad = (baseThetaDeg * Math.PI) / 180;
            const baseOffsetX = Math.round(Math.sin(baseThetaRad) * fanRadius);
            const baseOffsetY = Math.round(fanRadius * (1 - Math.cos(baseThetaRad)) - fanCenterLift);
            const baseRotationDeg = Number((baseThetaDeg * 0.98).toFixed(2));
            const fanZIndex = index + 1;

            let fanOffsetX = baseOffsetX;
            let fanOffsetY = baseOffsetY;
            let fanRotationDeg = baseRotationDeg;
            if (activePreview && index !== activePreview.fromIndex) {
              const movingRight = activePreview.fromIndex < activePreview.toIndex;
              const inShiftCorridor = movingRight
                ? index > activePreview.fromIndex && index <= activePreview.toIndex
                : index >= activePreview.toIndex && index < activePreview.fromIndex;
              if (inShiftCorridor) {
                const distanceToInsertion = Math.abs(index - activePreview.toIndex);
                const influence = Math.max(0, 1 - distanceToInsertion * 0.45);
                if (influence > 0) {
                  const direction = movingRight ? -1 : 1;
                  fanOffsetX = Math.round(baseOffsetX + direction * 10 * influence);
                  fanOffsetY = Math.round(baseOffsetY + 2 * influence);
                  fanRotationDeg = Number((baseRotationDeg + direction * 1.2 * influence).toFixed(2));
                }
              }
            }
            return (
              <DraggableHandCard
                key={card.id}
                card={card}
                stackIndex={index}
                cardCount={orderedMyHand.length}
                selected={selected}
                cardWidth={ui.casinoHandCardWidth}
                cardHeight={ui.casinoHandCardHeight}
                dragStep={Math.max(10, ui.casinoHandCardWidth - ui.casinoHandOverlap)}
                fanOffsetX={fanOffsetX}
                fanOffsetY={fanOffsetY}
                fanRotationDeg={fanRotationDeg}
                fanZIndex={fanZIndex}
                rankFontSize={ui.handRankSize}
                suitFontSize={ui.handSuitSize}
                canDragToDiscard={canDiscardTurn}
                canReorderInHand={canReorderHand}
                onSelect={toggleSelectedCard}
                onReorderInHand={reorderMyHand}
                onReorderPreview={updateHandReorderPreview}
                onReorderPreviewEnd={clearHandReorderPreview}
                onDropToDiscard={tryDiscardByDrop}
              />
            );
          })}
        </View>
      </View>
    );
  };

  const renderConnectionPanel = () => (
    <View style={[styles.connectPanelWrap, { width: isCompactMobile ? '100%' : 460 }]}>
      <View style={[styles.panelDark, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>Connexion</Text>
        <Text style={[styles.statusText, { color: theme.sub }]}>Etat: {statusText}</Text>
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
        <View style={styles.btnRow}>
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

  const renderConnectPage = () => (
    <View style={[styles.rootScroll, styles.connectPageScroll, isCompactMobile && styles.rootScrollCompact]}>
      <View
        style={[
          styles.topTitleRow,
          isCompactMobile && styles.topTitleRowCompact,
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
        ]}
      >
        <Text style={[styles.gameTitle, isCompactMobile && styles.gameTitleCompact, { color: theme.title }]}>5 ROIS - CONNEXION</Text>
        <Text style={[styles.gameSubTitle, isCompactMobile && styles.gameSubTitleCompact, { color: theme.sub }]}>
          Entre ton pseudo puis cree/rejoins une table
        </Text>
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
    const showRotateGate = isPortraitLike;
    const showSidePanel = false;
    return (
      <View style={[styles.tablePageRoot, isCompactMobile && styles.tablePageRootCompact]}>
        <View
          style={[styles.tableHeaderBar, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          onLayout={(event) => setTableHeaderHeight(Math.round(event.nativeEvent.layout.height))}
        >
          <Text numberOfLines={1} style={[styles.tableHeaderInlineText, { color: theme.secondaryText }]}>
            Salle {roomCodeDisplay} | Manche {snapshot?.roundNumber ?? '-'} / {snapshot?.maxRounds ?? 11} | Joueurs {connectedPlayers}/7 | {timeLabel}
          </Text>
          <View style={styles.tableHeaderActions}>
            <Pressable
              style={[
                styles.headerBotButton,
                { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                !canAddBot && styles.btnDisabled,
              ]}
              onPress={addLobbyBot}
              disabled={!canAddBot}
            >
              <Text style={[styles.headerBotButtonText, { color: theme.secondaryText }]}>Bot +1</Text>
            </Pressable>
            <Pressable
              style={[
                styles.headerDebugButton,
                { backgroundColor: theme.secondary, borderColor: theme.cardBorder },
                !canForceValidateRound && styles.btnDisabled,
              ]}
              onPress={() => {
                send({ type: 'debug_force_validate_round' });
                setStatusText('Validation debug demandee...');
              }}
              disabled={!canForceValidateRound}
            >
              <Text style={[styles.headerBotButtonText, { color: theme.secondaryText }]}>Debug</Text>
            </Pressable>
            <Pressable
              style={[styles.themeIconButton, { backgroundColor: theme.secondary, borderColor: theme.cardBorder }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={[styles.themeIconText, { color: theme.secondaryText }]}>{'\u2699'}</Text>
            </Pressable>
          </View>
        </View>

        {showRotateGate ? (
          <View style={styles.tablePageContent}>
            <View style={[styles.orientationGate, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <Text style={[styles.orientationTitle, { color: theme.title }]}>Tourne ton appareil en paysage</Text>
              <Text style={[styles.orientationText, { color: theme.sub }]}>
                La page Table est forcee en paysage. Sur web/PC, l'orientation systeme n'est pas verrouillable, donc on bloque cette vue en portrait.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.mainLayout, styles.tablePageContent, isWide && styles.mainLayoutWide]}>
            <View
              style={[styles.leftColumn, { width: isWide && showSidePanel ? ui.leftColumnWidth : '100%' }]}
              onLayout={(event) => setLeftColumnHeight(Math.round(event.nativeEvent.layout.height))}
            >
              {renderTable()}
            </View>
            {showSidePanel ? renderGameSidePanel() : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.screenBg }]}>
      <StatusBar style={theme.statusBar} />
      {renderHexBackground()}
      <View style={styles.topFade} pointerEvents="none" />
      {currentPage === 'connect' ? renderConnectPage() : renderTablePage()}
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
  tablePageContent: { flex: 1, minHeight: 0 },
  connectPageScroll: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainLayout: { gap: 12, flexDirection: 'column' },
  mainLayoutWide: { flexDirection: 'row', alignItems: 'stretch' },
  leftColumn: { flex: 1, gap: 10, minHeight: 0 },
  rightColumn: { gap: 10, minHeight: 0, flexShrink: 1 },
  connectPanelWrap: { alignSelf: 'center' },

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
  tableRimOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 240,
    backgroundColor: '#9CA3AF',
    padding: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  tableRimInner: {
    flex: 1,
    borderRadius: 220,
    backgroundColor: '#3F4754',
    padding: 8,
    borderWidth: 2,
    borderColor: '#A8B1BF',
  },
  tableFelt: {
    flex: 1,
    borderRadius: 208,
    backgroundColor: '#04673B',
    borderWidth: 1,
    borderColor: '#14B867',
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
  },
  boardCenterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  boardValidateButtonText: {
    fontSize: 9,
    fontWeight: '900',
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
  },
  actionCardDropReady: {
    borderColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  actionCardRank: { fontSize: 13, fontWeight: '900' },
  actionCardSuit: { fontSize: 10, fontWeight: '900' },
  actionCardLabel: { fontSize: 7, fontWeight: '800', textTransform: 'uppercase' },
  actionCardBack: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  actionCardCount: { fontSize: 8, fontWeight: '800' },
  boardLobbyStart: {
    position: 'absolute',
    top: '66%',
    alignSelf: 'center',
    alignItems: 'center',
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
  handFanWrap: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    paddingBottom: 2,
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


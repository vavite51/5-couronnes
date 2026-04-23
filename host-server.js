/* eslint-disable no-console */
const { WebSocketServer } = require('ws');
const crypto = require('node:crypto');
const os = require('node:os');
const http = require('node:http');

const PORT = Number(process.env.PORT || 8787);
const TURN_SECONDS = Number(process.env.TURN_SECONDS || 120);
const MAX_ROUNDS = 11;

const SUITS = ['stars', 'hearts', 'clubs', 'diamonds', 'spades'];
const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const BOT_FIRST_NAMES = [
  'Lucas',
  'Emma',
  'Leo',
  'Jade',
  'Hugo',
  'Lina',
  'Nathan',
  'Ines',
  'Arthur',
  'Chloe',
  'Gabriel',
  'Manon',
  'Raphael',
  'Sarah',
  'Noah',
  'Camille',
  'Ethan',
  'Lou',
  'Louis',
  'Mila',
  'Jules',
  'Lea',
  'Adam',
  'Nina',
  'Sacha',
  'Iris',
  'Theo',
  'Eva',
  'Mael',
  'Zoe',
];

function getLanIpAddresses() {
  const nets = os.networkInterfaces();
  /** @type {string[]} */
  const ips = [];
  for (const list of Object.values(nets)) {
    if (!Array.isArray(list)) continue;
    for (const net of list) {
      if (!net || net.internal) continue;
      if (net.family !== 'IPv4') continue;
      if (!ips.includes(net.address)) ips.push(net.address);
    }
  }
  return ips;
}

function getJoinHints(port) {
  const ips = getLanIpAddresses();
  if (ips.length === 0) return [`ws://127.0.0.1:${port}`];
  return ips.map((ip) => `ws://${ip}:${port}`);
}

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @typedef {{id:string,suit:('stars'|'hearts'|'clubs'|'diamonds'|'spades'|null),rank:number|null,joker:boolean}} Card */
/** @typedef {{id:string,name:string,connected:boolean,isHost:boolean,isBot:boolean,totalScore:number,hand:Card[],ws:import('ws').WebSocket|null}} RoomPlayer */
/**
 * @typedef Room
 * @property {string} code
 * @property {'lobby'|'inRound'|'roundEnded'|'gameOver'} phase
 * @property {number} roundNumber
 * @property {RoomPlayer[]} players
 * @property {string|null} hostPlayerId
 * @property {Card[]} drawPile
 * @property {Card[]} discardPile
 * @property {string|null} currentPlayerId
 * @property {string|null} dealerPlayerId
 * @property {string|null} shufflerPlayerId
 * @property {'draw'|'discard'|null} turnStage
 * @property {number} turnDeadlineMs
 * @property {number} botNextActionMs
 * @property {string} lastDebugEvent
 * @property {{winnerId:string,penalties:{playerId:string,value:number}[]}|null} lastRound
 * @property {string|null} exposedByPlayerId
 * @property {string[]} lastTurnPendingPlayerIds
 * @property {string|null} discardPickupPlayerId
 * @property {string|null} validatedExposePlayerId
 * @property {Record<string, {melds: Card[][], deadwood: Card[], penalty: number}>} exposedMeldsByPlayerId
 * @property {Record<string, {melds: Card[][], deadwood: Card[], penalty: number}>} roundRevealByPlayerId
 * @property {number} autoNextRoundAtMs
 */

function randomId(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
}

function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {Set<string>} takenNamesLower
 * @returns {string}
 */
function pickRandomBotFirstName(takenNamesLower) {
  const shuffled = BOT_FIRST_NAMES.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  for (const candidate of shuffled) {
    if (!takenNamesLower.has(candidate.toLowerCase())) return candidate;
  }
  const fallbackBase = shuffled[0] ?? 'Alex';
  let suffix = 2;
  while (takenNamesLower.has(`${fallbackBase}${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${fallbackBase}${suffix}`;
}

function cardDebugLabel(card) {
  if (!card) return 'inconnue';
  if (card.joker) return 'Joker';
  return `${card.rank}-${card.suit}`;
}

/**
 * @param {number} rank
 * @returns {string}
 */
function rankToLabel(rank) {
  if (rank === 11) return 'V';
  if (rank === 12) return 'D';
  if (rank === 13) return 'R';
  return String(rank);
}

function wildcardRank(roundNumber) {
  return Math.min(13, roundNumber + 2);
}

/**
 * Tirage du donneur manche 1: chaque joueur tire 1 carte (3..R),
 * la plus haute gagne. En cas degalite, on retire entre ex aequo.
 * @param {Room} room
 * @returns {{dealerPlayerId: string, debugSummary: string}}
 */
function drawInitialDealer(room) {
  const contenderIds = room.players.map((player) => player.id);
  if (contenderIds.length === 0) {
    return { dealerPlayerId: '', debugSummary: 'Aucun joueur pour le tirage du donneur.' };
  }
  /** @type {string[]} */
  let active = contenderIds.slice();
  /** @type {string[]} */
  const rounds = [];
  while (active.length > 1) {
    let bestRank = -Infinity;
    /** @type {string[]} */
    let bestIds = [];
    /** @type {string[]} */
    const drawLog = [];
    for (const playerId of active) {
      const drawnRank = randomInt(3, 13);
      const playerName = room.players.find((player) => player.id === playerId)?.name ?? 'Joueur';
      drawLog.push(`${playerName}:${rankToLabel(drawnRank)}`);
      if (drawnRank > bestRank) {
        bestRank = drawnRank;
        bestIds = [playerId];
      } else if (drawnRank === bestRank) {
        bestIds.push(playerId);
      }
    }
    rounds.push(drawLog.join(', '));
    active = bestIds;
  }
  const dealerPlayerId = active[0] ?? contenderIds[0];
  const dealerName = room.players.find((player) => player.id === dealerPlayerId)?.name ?? 'Joueur';
  const summary = `Tirage donneur manche 1 -> ${rounds.join(' | ')} | Donneur: ${dealerName}.`;
  return { dealerPlayerId, debugSummary: summary };
}

function cardPenalty(card, wildRank) {
  if (card.joker) return 50;
  if (card.rank === wildRank) return 20;
  if (card.rank === null) return 0;
  return card.rank;
}

function isWild(card, wildRank) {
  return card.joker || card.rank === wildRank;
}

function makeDeck() {
  const deckCopies = 2;
  /** @type {Card[]} */
  const cards = [];
  for (let copy = 0; copy < deckCopies; copy += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${copy}-${suit}-${rank}-${crypto.randomBytes(3).toString('hex')}`,
          suit,
          rank,
          joker: false,
        });
      }
    }
    for (let j = 0; j < 3; j += 1) {
      cards.push({
        id: `${copy}-joker-${j}-${crypto.randomBytes(3).toString('hex')}`,
        suit: null,
        rank: null,
        joker: true,
      });
    }
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards;
}

/**
 * @param {Card[]} cards
 */
function shuffleCards(cards) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
}

/**
 * @param {Room} room
 * @returns {boolean}
 */
function refillDrawPileFromDiscard(room) {
  if (room.discardPile.length <= 1) return false;
  const topDiscard = room.discardPile.pop();
  if (!topDiscard) return false;
  const refill = room.discardPile.splice(0);
  shuffleCards(refill);
  room.drawPile = refill;
  room.discardPile = [topDiscard];
  pushDebugEvent(room, 'Pioche reconstituee depuis la defausse.');
  return true;
}

function isSet(cards, wildRank) {
  if (cards.length < 3) return false;
  const naturals = cards.filter((c) => !isWild(c, wildRank));
  if (naturals.length === 0) return false;
  const targetRank = naturals[0].rank;
  if (targetRank === null) return false;
  return naturals.every((c) => c.rank === targetRank);
}

function isRun(cards, wildRank) {
  if (cards.length < 3) return false;
  const naturals = cards.filter((c) => !isWild(c, wildRank));
  const wildCount = cards.length - naturals.length;
  if (naturals.length === 0) return false;
  const suit = naturals[0].suit;
  if (!suit) return false;
  if (!naturals.every((c) => c.suit === suit && c.rank !== null)) return false;
  const ranks = naturals.map((c) => Number(c.rank)).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] === ranks[i - 1]) return false;
  }
  let gaps = 0;
  for (let i = 1; i < ranks.length; i += 1) {
    gaps += ranks[i] - ranks[i - 1] - 1;
  }
  return wildCount >= gaps;
}

function isMeld(cards, wildRank) {
  return isSet(cards, wildRank) || isRun(cards, wildRank);
}

function canFullyMeld(cards, wildRank) {
  if (cards.length === 0) return true;
  const fullMask = (1 << cards.length) - 1;
  /** @type {Map<number, boolean>} */
  const memo = new Map();

  /**
   * @param {number} mask
   */
  function solve(mask) {
    if (mask === 0) return true;
    if (memo.has(mask)) return memo.get(mask);
    let first = -1;
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) {
        first = i;
        break;
      }
    }
    if (first < 0) return true;

    const indexes = [];
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) indexes.push(i);
    }
    const others = indexes.filter((i) => i !== first);
    let ok = false;

    /**
     * @param {number} start
     * @param {number[]} selected
     */
    function choose(start, selected) {
      if (ok) return;
      if (selected.length >= 2) {
        const groupIdx = [first, ...selected];
        const groupCards = groupIdx.map((i) => cards[i]);
        if (isMeld(groupCards, wildRank)) {
          let groupMask = 0;
          for (const i of groupIdx) groupMask |= 1 << i;
          if (solve(mask & ~groupMask)) {
            ok = true;
            return;
          }
        }
      }
      for (let i = start; i < others.length; i += 1) {
        selected.push(others[i]);
        choose(i + 1, selected);
        selected.pop();
        if (ok) return;
      }
    }

    choose(0, []);
    memo.set(mask, ok);
    return ok;
  }

  return solve(fullMask);
}

/**
 * @param {Card[]} cards
 * @param {number} wildRank
 * @returns {Card[][]|null}
 */
function extractMeldGroups(cards, wildRank) {
  if (cards.length === 0) return [];
  const fullMask = (1 << cards.length) - 1;
  /** @type {Map<number, Card[][]|null>} */
  const memo = new Map();

  /**
   * @param {number} mask
   * @returns {Card[][]|null}
   */
  function solve(mask) {
    if (mask === 0) return [];
    if (memo.has(mask)) return memo.get(mask);

    let first = -1;
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) {
        first = i;
        break;
      }
    }
    if (first < 0) return [];

    const indexes = [];
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) indexes.push(i);
    }
    const others = indexes.filter((i) => i !== first);
    /** @type {Card[][]|null} */
    let found = null;

    /**
     * @param {number} start
     * @param {number[]} selected
     */
    function choose(start, selected) {
      if (found) return;
      if (selected.length >= 2) {
        const groupIdx = [first, ...selected];
        const groupCards = groupIdx.map((i) => cards[i]);
        if (isMeld(groupCards, wildRank)) {
          let groupMask = 0;
          for (const i of groupIdx) groupMask |= 1 << i;
          const tail = solve(mask & ~groupMask);
          if (tail) {
            found = [groupCards, ...tail];
            return;
          }
        }
      }
      for (let i = start; i < others.length; i += 1) {
        selected.push(others[i]);
        choose(i + 1, selected);
        selected.pop();
        if (found) return;
      }
    }

    choose(0, []);
    memo.set(mask, found);
    return found;
  }

  return solve(fullMask);
}

/**
 * @param {Card[]} cards
 * @param {number} wildRank
 * @returns {{melds: Card[][], deadwood: Card[], penalty: number}}
 */
function buildBestShowdown(cards, wildRank) {
  if (!cards.length) return { melds: [], deadwood: [], penalty: 0 };
  const fullMask = (1 << cards.length) - 1;
  /** @type {Map<number, {penalty:number, melds:number[][], deadwood:number[]}>} */
  const memo = new Map();

  /**
   * @param {number} mask
   * @returns {{penalty:number, melds:number[][], deadwood:number[]}}
   */
  function solve(mask) {
    if (mask === 0) return { penalty: 0, melds: [], deadwood: [] };
    if (memo.has(mask)) return memo.get(mask);

    let first = -1;
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) {
        first = i;
        break;
      }
    }
    if (first < 0) return { penalty: 0, melds: [], deadwood: [] };

    /** @type {{penalty:number, melds:number[][], deadwood:number[]}} */
    let best = {
      penalty: cardPenalty(cards[first], wildRank) + solve(mask & ~(1 << first)).penalty,
      melds: solve(mask & ~(1 << first)).melds,
      deadwood: [first, ...solve(mask & ~(1 << first)).deadwood],
    };

    const indexes = [];
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) indexes.push(i);
    }
    const others = indexes.filter((i) => i !== first);

    /**
     * @param {number} start
     * @param {number[]} selected
     */
    function choose(start, selected) {
      if (selected.length >= 2) {
        const groupIdx = [first, ...selected];
        const groupCards = groupIdx.map((i) => cards[i]);
        if (isMeld(groupCards, wildRank)) {
          let groupMask = 0;
          for (const i of groupIdx) groupMask |= 1 << i;
          const tail = solve(mask & ~groupMask);
          const candidate = {
            penalty: tail.penalty,
            melds: [groupIdx, ...tail.melds],
            deadwood: tail.deadwood,
          };
          const candidateMeldCards = candidate.melds.reduce((sum, meld) => sum + meld.length, 0);
          const bestMeldCards = best.melds.reduce((sum, meld) => sum + meld.length, 0);
          const isBetterPenalty = candidate.penalty < best.penalty;
          const isBetterCoverage = candidate.penalty === best.penalty && candidateMeldCards > bestMeldCards;
          if (isBetterPenalty || isBetterCoverage) {
            best = candidate;
          }
        }
      }
      for (let i = start; i < others.length; i += 1) {
        selected.push(others[i]);
        choose(i + 1, selected);
        selected.pop();
      }
    }

    choose(0, []);
    memo.set(mask, best);
    return best;
  }

  const resolved = solve(fullMask);
  const melds = resolved.melds.map((groupIdx) => groupIdx.map((idx) => cards[idx]));
  const deadwood = resolved.deadwood
    .slice()
    .sort((a, b) => a - b)
    .map((idx) => cards[idx]);
  return { melds, deadwood, penalty: resolved.penalty };
}

function minPenalty(cards, wildRank) {
  if (cards.length === 0) return 0;
  const fullMask = (1 << cards.length) - 1;
  /** @type {Map<number, number>} */
  const memo = new Map();

  /**
   * @param {number} mask
   */
  function solve(mask) {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask);
    let first = -1;
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) {
        first = i;
        break;
      }
    }
    if (first < 0) return 0;

    let best = cardPenalty(cards[first], wildRank) + solve(mask & ~(1 << first));
    const indexes = [];
    for (let i = 0; i < cards.length; i += 1) {
      if ((mask & (1 << i)) !== 0) indexes.push(i);
    }
    const others = indexes.filter((i) => i !== first);

    /**
     * @param {number} start
     * @param {number[]} selected
     */
    function choose(start, selected) {
      if (selected.length >= 2) {
        const groupIdx = [first, ...selected];
        const groupCards = groupIdx.map((i) => cards[i]);
        if (isMeld(groupCards, wildRank)) {
          let groupMask = 0;
          for (const i of groupIdx) groupMask |= 1 << i;
          best = Math.min(best, solve(mask & ~groupMask));
        }
      }
      for (let i = start; i < others.length; i += 1) {
        selected.push(others[i]);
        choose(i + 1, selected);
        selected.pop();
      }
    }

    choose(0, []);
    memo.set(mask, best);
    return best;
  }

  return solve(fullMask);
}

/**
 * @param {Room} room
 */
function startRound(room) {
  const cardsToDeal = Math.min(13, room.roundNumber + 2);
  room.drawPile = makeDeck();
  room.discardPile = [];
  room.turnStage = 'draw';
  room.lastRound = null;
  room.exposedByPlayerId = null;
  room.exposedMeldsByPlayerId = {};
  room.roundRevealByPlayerId = {};
  room.lastTurnPendingPlayerIds = [];
  room.discardPickupPlayerId = null;
  room.validatedExposePlayerId = null;

  for (const player of room.players) {
    player.hand = [];
  }
  for (let i = 0; i < cardsToDeal; i += 1) {
    for (const player of room.players) {
      const c = room.drawPile.pop();
      if (c) player.hand.push(c);
    }
  }
  const top = room.drawPile.pop();
  if (top) room.discardPile.push(top);
  let dealerId = room.dealerPlayerId;
  let dealerDrawSummary = '';
  if (room.roundNumber === 1 || !dealerId || !room.players.some((player) => player.id === dealerId)) {
    const drawResult = drawInitialDealer(room);
    dealerId = drawResult.dealerPlayerId;
    dealerDrawSummary = drawResult.debugSummary;
  } else {
    const previousDealerIndex = room.players.findIndex((player) => player.id === dealerId);
    const rotatedDealer = room.players[(previousDealerIndex + 1 + room.players.length) % room.players.length];
    dealerId = rotatedDealer?.id ?? room.players[0]?.id ?? null;
  }
  const dealerIndex = room.players.findIndex((player) => player.id === dealerId);
  const safeDealerIndex = dealerIndex >= 0 ? dealerIndex : 0;
  const leadPlayer = room.players[(safeDealerIndex + 1) % room.players.length];
  const shufflerPlayer = room.players[(safeDealerIndex - 1 + room.players.length) % room.players.length];
  room.dealerPlayerId = dealerId;
  room.shufflerPlayerId = shufflerPlayer?.id ?? null;
  room.currentPlayerId = leadPlayer?.id ?? null;
  room.discardPickupPlayerId = room.currentPlayerId;
  room.turnDeadlineMs = Date.now() + TURN_SECONDS * 1000;
  room.botNextActionMs = 0;
  room.autoNextRoundAtMs = 0;
  room.phase = 'inRound';
  const dealerName = room.players.find((player) => player.id === room.dealerPlayerId)?.name ?? 'Joueur';
  const shufflerName = room.players.find((player) => player.id === room.shufflerPlayerId)?.name ?? 'Joueur';
  const leadName = room.players.find((player) => player.id === room.currentPlayerId)?.name ?? 'Joueur';
  pushDebugEvent(
    room,
    `${dealerDrawSummary ? `${dealerDrawSummary} ` : ''}Manche ${room.roundNumber}: donneur ${dealerName}, melangeur ${shufflerName}, premier joueur ${leadName}.`
  );
  if (room.currentPlayerId) {
    const current = room.players.find((p) => p.id === room.currentPlayerId);
    if (current?.isBot) room.botNextActionMs = Date.now() + randomInt(700, 1500);
  }
}

/**
 * @param {Room} room
 */
function setCurrentPlayerTurn(room, playerId) {
  room.currentPlayerId = playerId;
  room.turnStage = 'draw';
  room.turnDeadlineMs = Date.now() + TURN_SECONDS * 1000;
  room.discardPickupPlayerId = playerId;
  room.validatedExposePlayerId = null;
  room.botNextActionMs = 0;
  const current = room.players.find((p) => p.id === playerId);
  if (current?.isBot) room.botNextActionMs = Date.now() + randomInt(700, 1500);
}

/**
 * @param {Room} room
 * @param {string} winnerId
 * @param {{playerId:string,value:number}[]} penalties
 */
function applyRoundResult(room, winnerId, penalties, roundRevealByPlayerId = {}) {
  for (const result of penalties) {
    const player = room.players.find((p) => p.id === result.playerId);
    if (player) player.totalScore += result.value;
  }
  room.lastRound = { winnerId, penalties };
  room.roundRevealByPlayerId = roundRevealByPlayerId;
  room.phase = room.roundNumber >= MAX_ROUNDS ? 'gameOver' : 'roundEnded';
  room.currentPlayerId = null;
  room.turnStage = null;
  room.turnDeadlineMs = 0;
  room.botNextActionMs = 0;
  room.exposedByPlayerId = null;
  room.lastTurnPendingPlayerIds = [];
  room.discardPickupPlayerId = null;
  room.validatedExposePlayerId = null;
  room.autoNextRoundAtMs = 0;
}

/**
 * @param {Room} room
 * @param {string} winnerId
 */
function endRound(room, winnerId) {
  const wildRank = wildcardRank(room.roundNumber);
  const penalties = [];
  /** @type {Record<string, {melds: Card[][], deadwood: Card[], penalty: number}>} */
  const roundRevealByPlayerId = {};
  for (const player of room.players) {
    const breakdown = buildBestShowdown(player.hand, wildRank);
    penalties.push({
      playerId: player.id,
      value: breakdown.penalty,
    });
    roundRevealByPlayerId[player.id] = breakdown;
  }
  applyRoundResult(room, winnerId, penalties, roundRevealByPlayerId);
}

/**
 * @param {Room} room
 * @param {string} triggeredBy
 * @returns {string|null}
 */
function forceValidateRound(room, triggeredBy) {
  if (room.phase !== 'inRound') return 'Aucune manche active a valider.';
  const wildRank = wildcardRank(room.roundNumber);
  const penalties = room.players.map((player) => ({
    playerId: player.id,
    value: player.hand.reduce((sum, card) => sum + cardPenalty(card, wildRank), 0),
  }));
  let winnerId = penalties[0]?.playerId ?? null;
  let bestPenalty = penalties[0]?.value ?? Number.POSITIVE_INFINITY;
  for (const item of penalties) {
    if (item.value < bestPenalty) {
      bestPenalty = item.value;
      winnerId = item.playerId;
    }
  }
  if (!winnerId) return 'Impossible de calculer le classement de manche.';
  room.exposedMeldsByPlayerId = {};
  /** @type {Record<string, {melds: Card[][], deadwood: Card[], penalty: number}>} */
  const roundRevealByPlayerId = {};
  for (const player of room.players) {
    roundRevealByPlayerId[player.id] = {
      melds: [],
      deadwood: player.hand.slice(),
      penalty: player.hand.reduce((sum, card) => sum + cardPenalty(card, wildRank), 0),
    };
  }
  applyRoundResult(room, winnerId, penalties, roundRevealByPlayerId);
  const winner = room.players.find((p) => p.id === winnerId);
  pushDebugEvent(
    room,
    `[DEBUG] ${triggeredBy} force la validation de la manche (points bruts en main). Gagnant calcule: ${winner?.name ?? winnerId}.`
  );
  return null;
}

/**
 * @param {Room} room
 */
function nextTurn(room) {
  if (!room.currentPlayerId || room.players.length === 0) return;
  const idx = room.players.findIndex((p) => p.id === room.currentPlayerId);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % room.players.length;
  setCurrentPlayerTurn(room, room.players[nextIdx].id);
}

/**
 * @param {Room} room
 * @param {string} exposingPlayerId
 */
function startLastTurnsAfterExpose(room, exposingPlayerId) {
  const idx = room.players.findIndex((p) => p.id === exposingPlayerId);
  const queue = [];
  for (let step = 1; step < room.players.length; step += 1) {
    const p = room.players[(idx + step) % room.players.length];
    if (p) queue.push(p.id);
  }
  room.exposedByPlayerId = exposingPlayerId;
  room.lastTurnPendingPlayerIds = queue;
}

/**
 * @param {Room} room
 * @param {string} playerId
 * @param {{melds: Card[][], deadwood: Card[], penalty: number}} breakdown
 */
function setLiveExposeEntry(room, playerId, breakdown) {
  room.exposedMeldsByPlayerId[playerId] = {
    melds: breakdown.melds.map((meld) => meld.slice()),
    deadwood: breakdown.deadwood.slice(),
    penalty: breakdown.penalty,
  };
}

/**
 * @param {Room} room
 */
function advanceAfterDiscard(room) {
  if (room.exposedByPlayerId) {
    if (room.lastTurnPendingPlayerIds.length === 0) {
      endRound(room, room.exposedByPlayerId);
      return;
    }
    const nextPlayerId = room.lastTurnPendingPlayerIds.shift();
    if (nextPlayerId) {
      setCurrentPlayerTurn(room, nextPlayerId);
      return;
    }
    endRound(room, room.exposedByPlayerId);
    return;
  }
  nextTurn(room);
}

/**
 * @param {Room} room
 */
function advanceWithoutDiscard(room) {
  if (room.exposedByPlayerId) {
    if (room.lastTurnPendingPlayerIds.length === 0) {
      endRound(room, room.exposedByPlayerId);
      return;
    }
    const nextPlayerId = room.lastTurnPendingPlayerIds.shift();
    if (nextPlayerId) {
      setCurrentPlayerTurn(room, nextPlayerId);
      return;
    }
    endRound(room, room.exposedByPlayerId);
    return;
  }
  nextTurn(room);
}

/**
 * @param {Room} room
 * @param {string} message
 */
function pushDebugEvent(room, message) {
  room.lastDebugEvent = `[${new Date().toISOString()}] ${message}`;
}

/**
 * @param {Room} room
 * @param {number} count
 * @returns {number}
 */
function addDebugBots(room, count) {
  const slots = Math.max(0, 7 - room.players.length);
  const requested = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
  const toAdd = Math.min(slots, requested);
  if (toAdd <= 0) return 0;
  const taken = new Set(room.players.map((player) => player.name.toLowerCase()));
  for (let i = 0; i < toAdd; i += 1) {
    const botName = pickRandomBotFirstName(taken);
    taken.add(botName.toLowerCase());
    room.players.push({
      id: randomId('bot'),
      name: botName,
      connected: true,
      isHost: false,
      isBot: true,
      totalScore: 0,
      hand: [],
      ws: null,
    });
  }
  pushDebugEvent(room, `${toAdd} bot(s) debug ajoute(s).`);
  return toAdd;
}

/**
 * @param {RoomPlayer} player
 * @param {number} wildRank
 * @returns {string|null}
 */
function chooseBestDiscard(player, wildRank) {
  if (!Array.isArray(player.hand) || player.hand.length === 0) return null;
  let bestCardId = player.hand[0].id;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < player.hand.length; i += 1) {
    const candidate = player.hand[i];
    const rest = player.hand.filter((_, idx) => idx !== i);
    const score = minPenalty(rest, wildRank);
    if (score < bestScore) {
      bestScore = score;
      bestCardId = candidate.id;
    } else if (score === bestScore && Math.random() < 0.35) {
      bestCardId = candidate.id;
    }
  }
  return bestCardId;
}

/**
 * @param {Card[]} hand
 * @param {number} wildRank
 * @returns {string|null}
 */
function findZeroDiscardCardId(hand, wildRank) {
  for (let i = 0; i < hand.length; i += 1) {
    const candidate = hand[i];
    const rest = hand.filter((_, idx) => idx !== i);
    if (canFullyMeld(rest, wildRank)) return candidate.id;
  }
  return null;
}

/**
 * @param {Card[]} hand
 * @param {number} wildRank
 * @returns {boolean}
 */
function canReachZeroAfterDiscard(hand, wildRank) {
  return Boolean(findZeroDiscardCardId(hand, wildRank));
}

/**
 * @param {Room} room
 * @returns {boolean}
 */
function runBotTurnIfNeeded(room) {
  if (room.phase !== 'inRound' || !room.currentPlayerId) return false;
  const player = room.players.find((p) => p.id === room.currentPlayerId);
  if (!player || !player.isBot) return false;
  if (room.botNextActionMs > Date.now()) return false;

  if (room.turnStage === 'draw') {
    const action = room.discardPile.length > 0 && Math.random() < 0.4 ? 'draw_discard' : 'draw_pile';
    const error = applyAction(room, player.id, action, undefined);
    if (error) {
      const fallbackError = applyAction(room, player.id, 'draw_pile', undefined);
      if (fallbackError) {
        pushDebugEvent(room, `${player.name} bloque pendant pioche (${fallbackError}).`);
        return false;
      }
      pushDebugEvent(room, `${player.name} pioche (fallback) dans la pioche.`);
    } else {
      pushDebugEvent(room, `${player.name} pioche (${action === 'draw_discard' ? 'defausse' : 'pioche'}).`);
    }
    room.botNextActionMs = Date.now() + randomInt(700, 1400);
    return true;
  }

  if (room.turnStage === 'discard') {
    const wildRank = wildcardRank(room.roundNumber);
    if (!room.exposedByPlayerId && canReachZeroAfterDiscard(player.hand, wildRank)) {
      const validateError = applyAction(room, player.id, 'validate_melds', undefined);
      if (!validateError) {
        pushDebugEvent(room, `${player.name} valide ses tierces.`);
      }
    }

    const discardCardId =
      room.validatedExposePlayerId === player.id
        ? findZeroDiscardCardId(player.hand, wildRank) || chooseBestDiscard(player, wildRank)
        : chooseBestDiscard(player, wildRank);
    if (!discardCardId) {
      pushDebugEvent(room, `${player.name} ne trouve pas de carte a jeter.`);
      return false;
    }
    const card = player.hand.find((c) => c.id === discardCardId) ?? null;
    const error = applyAction(room, player.id, 'discard', discardCardId);
    if (error) {
      pushDebugEvent(room, `${player.name} erreur de defausse (${error}).`);
      return false;
    }
    pushDebugEvent(room, `${player.name} jette ${cardDebugLabel(card)}.`);
    return true;
  }

  return false;
}

/**
 * @param {Room} room
 * @param {string} playerId
 * @param {'draw_pile'|'draw_discard'|'validate_melds'|'discard'} action
 * @param {string|undefined} cardId
 * @returns {string|null}
 */
function applyAction(room, playerId, action, cardId) {
  if (room.phase !== 'inRound') return 'La manche nest pas active.';
  if (room.currentPlayerId !== playerId) return 'Ce nest pas ton tour.';
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return 'Joueur introuvable.';
  const expectedHandCount = Math.min(13, room.roundNumber + 2);

  /**
   * @param {'draw_pile'|'draw_discard'} drawAction
   * @returns {string|null}
   */
  const performDraw = (drawAction) => {
    if (drawAction === 'draw_pile') {
      if (room.drawPile.length === 0) {
        refillDrawPileFromDiscard(room);
      }
      const c = room.drawPile.pop();
      if (!c) return 'La pioche est vide.';
      player.hand.push(c);
      room.discardPickupPlayerId = null;
    } else {
      if (room.discardPickupPlayerId && room.discardPickupPlayerId !== playerId) {
        return 'Cette carte de defausse est reservee au joueur suivant.';
      }
      const c = room.discardPile.pop();
      if (!c) return 'La defausse est vide.';
      player.hand.push(c);
      room.discardPickupPlayerId = null;
    }
    room.turnStage = 'discard';
    room.turnDeadlineMs = Date.now() + TURN_SECONDS * 1000;
    return null;
  };

  if (room.turnStage === 'draw') {
    if (action !== 'draw_pile' && action !== 'draw_discard') return 'Action invalide a cette etape.';
    return performDraw(action);
  }

  if (room.turnStage === 'discard') {
    if (action === 'draw_pile' || action === 'draw_discard') {
      if (player.hand.length > expectedHandCount) {
        return 'Tu as deja pioche pour ce tour.';
      }
      return performDraw(action);
    }
    const wildRank = wildcardRank(room.roundNumber);
    if (action === 'validate_melds') {
      if (room.exposedByPlayerId) return 'Un joueur a deja expose pour cette manche.';
      const discardCandidateId = findZeroDiscardCardId(player.hand, wildRank);
      if (!discardCandidateId) {
        return 'Validation refusee: tu dois pouvoir finir a 0 apres la defausse.';
      }
      const restAfterCandidate = player.hand.filter((card) => card.id !== discardCandidateId);
      const previewMelds = extractMeldGroups(restAfterCandidate, wildRank);
      if (!previewMelds) {
        return 'Validation refusee: impossible de construire les tierces exposees.';
      }
      setLiveExposeEntry(room, player.id, { melds: previewMelds, deadwood: [], penalty: 0 });
      room.validatedExposePlayerId = player.id;
      room.turnDeadlineMs = Date.now() + TURN_SECONDS * 1000;
      pushDebugEvent(room, `${player.name} valide ses tierces.`);
      return null;
    }
    if (action !== 'discard') return 'Tu dois valider puis jeter une carte.';
    if (!cardId) return 'Carte manquante.';
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx < 0) return 'Carte introuvable dans ta main.';
    if (room.validatedExposePlayerId === player.id && !room.exposedByPlayerId) {
      const rest = player.hand.filter((_, i) => i !== idx);
      if (!canFullyMeld(rest, wildRank)) {
        return 'Apres validation, ta main doit arriver a 0 avant de defausser.';
      }
      const finalMelds = extractMeldGroups(rest, wildRank);
      if (finalMelds) {
        setLiveExposeEntry(room, player.id, { melds: finalMelds, deadwood: [], penalty: 0 });
      }
    }
    const [card] = player.hand.splice(idx, 1);
    room.discardPile.push(card);
    if (room.validatedExposePlayerId === player.id && !room.exposedByPlayerId) {
      startLastTurnsAfterExpose(room, player.id);
      pushDebugEvent(room, `${player.name} expose ses combinaisons.`);
    }
    if (room.exposedByPlayerId) {
      setLiveExposeEntry(room, player.id, buildBestShowdown(player.hand, wildRank));
    }
    room.validatedExposePlayerId = null;
    advanceAfterDiscard(room);
    return null;
  }

  return 'Tour invalide.';
}

/**
 * @param {Room} room
 * @param {import('ws').WebSocket} viewerWs
 */
function snapshotFor(room, viewerWs) {
  const viewerPlayer = room.players.find((p) => p.ws === viewerWs) ?? null;
  const joinHints = getJoinHints(PORT);
  const wildRank = wildcardRank(room.roundNumber);
  const canValidateMelds = Boolean(
    viewerPlayer &&
      room.phase === 'inRound' &&
      room.currentPlayerId === viewerPlayer.id &&
      room.turnStage === 'discard' &&
      !room.exposedByPlayerId &&
      canReachZeroAfterDiscard(viewerPlayer.hand, wildRank)
  );
  return {
    type: 'snapshot',
    payload: {
      roomCode: room.code,
      phase: room.phase,
      roundNumber: room.roundNumber,
      wildRank,
      maxRounds: MAX_ROUNDS,
      hostPlayerId: room.hostPlayerId,
      youPlayerId: viewerPlayer ? viewerPlayer.id : '',
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.isHost,
        isBot: p.isBot,
        totalScore: p.totalScore,
        handCount: p.hand.length,
        visibleHand: p.hand,
      })),
      currentPlayerId: room.currentPlayerId,
      dealerPlayerId: room.dealerPlayerId,
      shufflerPlayerId: room.shufflerPlayerId,
      turnStage: room.turnStage,
      turnSecondsLeft:
        room.turnDeadlineMs > 0 ? Math.max(0, Math.ceil((room.turnDeadlineMs - Date.now()) / 1000)) : 0,
      drawPileCount: room.drawPile.length,
      discardTop: room.discardPile.length > 0 ? room.discardPile[room.discardPile.length - 1] : null,
      myHand: viewerPlayer ? viewerPlayer.hand : [],
      lastRound: room.lastRound,
      exposedByPlayerId: room.exposedByPlayerId,
      validatedExposePlayerId: room.validatedExposePlayerId,
      canValidateMelds,
      lastTurnsRemaining: room.lastTurnPendingPlayerIds.length,
      discardPickupPlayerId: room.discardPickupPlayerId,
      exposedMelds: Object.entries(room.exposedMeldsByPlayerId || {}).map(([playerId, entry]) => ({
        playerId,
        melds: entry.melds,
        deadwood: entry.deadwood,
        penalty: entry.penalty,
      })),
      roundReveal: Object.entries(room.roundRevealByPlayerId || {}).map(([playerId, entry]) => ({
        playerId,
        melds: entry.melds,
        deadwood: entry.deadwood,
        penalty: entry.penalty,
      })),
      joinHints,
      lastDebugEvent: room.lastDebugEvent,
    },
  };
}

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

/**
 * @param {Room} room
 */
function broadcastRoom(room) {
  for (const p of room.players) {
    if (!p.ws) continue;
    sendJson(p.ws, snapshotFor(room, p.ws));
  }
}

/**
 * @param {Room} room
 */
function ensureHost(room) {
  if (room.hostPlayerId) {
    const current = room.players.find((p) => p.id === room.hostPlayerId);
    if (current?.connected && !current.isBot) return;
  }
  const next = room.players.find((p) => p.connected && !p.isBot);
  room.hostPlayerId = next ? next.id : null;
  for (const player of room.players) {
    player.isHost = Boolean(next && player.id === next.id);
  }
}

function removeEmptyRooms() {
  for (const [code, room] of rooms.entries()) {
    const hasConnectedHuman = room.players.some((p) => p.connected && !p.isBot);
    if (!hasConnectedHuman) {
      rooms.delete(code);
    }
  }
}

/**
 * @param {import('ws').WebSocket} ws
 * @returns {Room|null}
 */
function roomForSocket(ws) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.ws === ws)) return room;
  }
  return null;
}

const httpServer = http.createServer((req, res) => {
  const reqUrl = req.url || '/';
  if (reqUrl === '/' || reqUrl === '/health') {
    const body = JSON.stringify({
      ok: true,
      service: 'five-rois-host',
      port: PORT,
      rooms: rooms.size,
      websocketPaths: ['/', '/ws'],
      now: new Date().toISOString(),
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const pathname = (req.url || '/').split('?')[0] || '/';
  if (pathname !== '/' && pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[five-rois-host] serveur HTTP+WS demarre sur 0.0.0.0:${PORT}`);
  console.log(`[five-rois-host] websocket local: ws://0.0.0.0:${PORT}`);
  console.log('[five-rois-host] adresses de connexion a partager:');
  for (const hint of getJoinHints(PORT)) {
    console.log(`  - ${hint}`);
  }
  console.log('[five-rois-host] websocket path optionnel cloud: /ws');
});

wss.on('connection', (ws) => {
  sendJson(ws, { type: 'info', message: 'Connecte au serveur test 5 Rois' });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      sendJson(ws, { type: 'error', message: 'JSON invalide' });
      return;
    }
    const type = String(msg?.type || '');

    if (type === 'create_room') {
      const name = String(msg?.name || '').trim() || 'Joueur';
      let code = randomRoomCode();
      while (rooms.has(code)) code = randomRoomCode();
      const playerId = randomId('player');
      /** @type {Room} */
      const room = {
        code,
        phase: 'lobby',
        roundNumber: 1,
        players: [
          {
            id: playerId,
            name,
            connected: true,
            isHost: true,
            isBot: false,
            totalScore: 0,
            hand: [],
            ws,
          },
        ],
        hostPlayerId: playerId,
        drawPile: [],
        discardPile: [],
        currentPlayerId: null,
        dealerPlayerId: null,
        shufflerPlayerId: null,
        turnStage: null,
        turnDeadlineMs: 0,
        botNextActionMs: 0,
        lastDebugEvent: '',
        lastRound: null,
        exposedByPlayerId: null,
        exposedMeldsByPlayerId: {},
        roundRevealByPlayerId: {},
        lastTurnPendingPlayerIds: [],
        discardPickupPlayerId: null,
        validatedExposePlayerId: null,
        autoNextRoundAtMs: 0,
      };
      rooms.set(code, room);
      sendJson(ws, { type: 'info', message: `Salle creee: ${code}` });
      broadcastRoom(room);
      return;
    }

    if (type === 'join_room') {
      const roomCode = String(msg?.roomCode || '').toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) {
        sendJson(ws, { type: 'error', message: 'Salle introuvable.' });
        return;
      }
      if (room.phase !== 'lobby') {
        sendJson(ws, { type: 'error', message: 'Partie deja demarree dans cette salle.' });
        return;
      }
      if (room.players.length >= 7) {
        sendJson(ws, { type: 'error', message: 'Salle complete (max 7).' });
        return;
      }
      const name = String(msg?.name || '').trim() || 'Joueur';
      const playerId = randomId('player');
      room.players.push({
        id: playerId,
        name,
        connected: true,
        isHost: false,
        isBot: false,
        totalScore: 0,
        hand: [],
        ws,
      });
      ensureHost(room);
      sendJson(ws, { type: 'info', message: `Bienvenue dans ${roomCode}` });
      broadcastRoom(room);
      return;
    }

    const room = roomForSocket(ws);
    if (!room) {
      sendJson(ws, { type: 'error', message: 'Tu dois dabord creer ou rejoindre une salle.' });
      return;
    }
    const me = room.players.find((p) => p.ws === ws);
    if (!me) {
      sendJson(ws, { type: 'error', message: 'Joueur introuvable dans la salle.' });
      return;
    }

    if (type === 'start_game') {
      if (!me.isHost) {
        sendJson(ws, { type: 'error', message: 'Seul lhote peut demarrer.' });
        return;
      }
      if (room.players.length < 2) {
        sendJson(ws, { type: 'error', message: 'Il faut au moins 2 joueurs.' });
        return;
      }
      room.roundNumber = 1;
      room.dealerPlayerId = null;
      room.shufflerPlayerId = null;
      for (const p of room.players) {
        p.totalScore = 0;
      }
      startRound(room);
      broadcastRoom(room);
      return;
    }

    if (type === 'add_debug_bots') {
      if (!me.isHost) {
        sendJson(ws, { type: 'error', message: 'Seul lhote peut ajouter des bots debug.' });
        return;
      }
      if (room.phase !== 'lobby') {
        sendJson(ws, { type: 'error', message: 'Ajout bots possible uniquement dans le lobby.' });
        return;
      }
      const added = addDebugBots(room, Number(msg?.count ?? 1));
      if (added <= 0) {
        sendJson(ws, { type: 'error', message: 'Impossible dajouter des bots (salle complete ?).' });
        return;
      }
      sendJson(ws, { type: 'info', message: `${added} bot(s) ajoute(s).` });
      broadcastRoom(room);
      return;
    }

    if (type === 'debug_force_validate_round') {
      if (!me.isHost) {
        sendJson(ws, { type: 'error', message: 'Seul lhote peut utiliser le debug manche.' });
        return;
      }
      const error = forceValidateRound(room, me.name);
      if (error) {
        sendJson(ws, { type: 'error', message: error });
        return;
      }
      sendJson(ws, { type: 'info', message: 'Validation debug de la manche effectuee. Partie en pause.' });
      broadcastRoom(room);
      return;
    }

    if (type === 'start_next_round') {
      if (!me.isHost) {
        sendJson(ws, { type: 'error', message: 'Seul lhote peut lancer la manche suivante.' });
        return;
      }
      if (room.phase !== 'roundEnded') {
        sendJson(ws, { type: 'error', message: 'Aucune manche a relancer.' });
        return;
      }
      room.roundNumber += 1;
      startRound(room);
      broadcastRoom(room);
      return;
    }

    if (type === 'action') {
      const action = String(msg?.action || '');
      const cardId = typeof msg?.cardId === 'string' ? msg.cardId : undefined;
      const error = applyAction(
        room,
        me.id,
        /** @type {'draw_pile'|'draw_discard'|'validate_melds'|'discard'} */ (action),
        cardId
      );
      if (error) {
        sendJson(ws, { type: 'error', message: error });
        return;
      }
      broadcastRoom(room);
      return;
    }

    if (type === 'ping') {
      sendJson(ws, { type: 'info', message: 'pong' });
      return;
    }

    sendJson(ws, { type: 'error', message: `Type de message inconnu: ${type}` });
  });

  ws.on('close', () => {
    const room = roomForSocket(ws);
    if (!room) return;
    const me = room.players.find((p) => p.ws === ws);
    if (!me) return;
    me.connected = false;
    me.ws = null;
    if (room.currentPlayerId === me.id && room.phase === 'inRound') {
      pushDebugEvent(room, `${me.name} deconnecte pendant son tour, passage auto.`);
      advanceWithoutDiscard(room);
    }
    ensureHost(room);
    broadcastRoom(room);
    removeEmptyRooms();
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase === 'roundEnded') {
      broadcastRoom(room);
      continue;
    }
    if (room.phase !== 'inRound') continue;
    const botActionDone = runBotTurnIfNeeded(room);
    if (room.turnDeadlineMs > 0 && Date.now() >= room.turnDeadlineMs) {
      const player = room.players.find((p) => p.id === room.currentPlayerId);
      if (!player) {
        advanceWithoutDiscard(room);
        broadcastRoom(room);
        continue;
      }
      if (room.turnStage === 'draw') {
        if (room.drawPile.length === 0) {
          refillDrawPileFromDiscard(room);
        }
        const c = room.drawPile.pop();
        if (c) player.hand.push(c);
        room.discardPickupPlayerId = null;
        pushDebugEvent(room, `${player.name} auto-pioche (timeout).`);
        room.turnStage = 'discard';
        room.turnDeadlineMs = Date.now() + TURN_SECONDS * 1000;
      } else if (room.turnStage === 'discard') {
        const c = player.hand[player.hand.length - 1] ?? null;
        if (!c) {
          pushDebugEvent(room, `${player.name} ne peut pas defausser (main vide). Passage auto.`);
          advanceWithoutDiscard(room);
        } else {
          const discardError = applyAction(room, player.id, 'discard', c.id);
          if (discardError) {
            pushDebugEvent(room, `${player.name} auto-defausse impossible (${discardError}). Passage auto.`);
            room.validatedExposePlayerId = null;
            const fallback = player.hand.pop();
            if (fallback) {
              room.discardPile.push(fallback);
              pushDebugEvent(room, `${player.name} auto-defausse fallback ${cardDebugLabel(fallback)}.`);
              advanceAfterDiscard(room);
            } else {
              advanceWithoutDiscard(room);
            }
          } else {
            pushDebugEvent(room, `${player.name} auto-defausse ${cardDebugLabel(c)} (timeout).`);
          }
        }
      } else {
        advanceWithoutDiscard(room);
      }
      broadcastRoom(room);
    } else if (botActionDone) {
      broadcastRoom(room);
    } else {
      broadcastRoom(room);
    }
  }
}, 1000);

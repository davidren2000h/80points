/**
 * Card Utilities for 80 Points (Shengji / Tractor)
 * Supports 2, 3, or 4 deck configurations.
 */

// ── Constants ──────────────────────────────────────────────
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

export const SUIT_SYMBOLS = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
export const SUIT_COLORS = {
  spades: '#1a1a2e', hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#1a1a2e',
};

// ── Card Creation ──────────────────────────────────────────
let _cardIdCounter = 0;

export function createCard(suit, rank) {
  return {
    id: _cardIdCounter++,
    suit,      // 'spades' | 'hearts' | 'diamonds' | 'clubs' | 'joker'
    rank,      // '2'-'A' | 'small' | 'big'
    points: getCardPoints(rank),
  };
}

export function resetCardIds() {
  _cardIdCounter = 0;
}

export function getCardPoints(rank) {
  if (rank === '5') return 5;
  if (rank === '10' || rank === 'K') return 10;
  return 0;
}

export function getCardDisplay(card) {
  if (card.suit === 'joker') {
    return card.rank === 'big' ? '🃏' : '🂿';
  }
  return `${SUIT_SYMBOLS[card.suit]}${card.rank}`;
}

export function getCardLabel(card) {
  if (card.suit === 'joker') {
    return card.rank === 'big' ? 'Big Joker' : 'Small Joker';
  }
  return `${card.rank} of ${card.suit}`;
}

// ── Deck Building ──────────────────────────────────────────
export function buildDeck(deckCount) {
  resetCardIds();
  const cards = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(createCard(suit, rank));
      }
    }
    cards.push(createCard('joker', 'small'));
    cards.push(createCard('joker', 'big'));
  }
  return cards;
}

// ── Shuffling ──────────────────────────────────────────────
export function shuffle(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Deck Config ────────────────────────────────────────────
export function getDeckConfig(deckCount) {
  const totalCards = deckCount * 54;
  const cardsPerPlayer = { 2: 25, 3: 37, 4: 49 }[deckCount];
  const bottomCards = totalCards - cardsPerPlayer * 4;
  const totalPoints = deckCount * 100;
  const winThreshold = { 2: 80, 3: 120, 4: 160 }[deckCount];
  const levelIncrement = { 2: 20, 3: 30, 4: 40 }[deckCount];

  return {
    deckCount,
    totalCards,
    cardsPerPlayer,
    bottomCards,
    totalPoints,
    winThreshold,
    levelIncrement,
  };
}

// ── Dealing ────────────────────────────────────────────────
export function dealCards(deckCount) {
  const config = getDeckConfig(deckCount);
  const deck = shuffle(buildDeck(deckCount));
  const hands = [[], [], [], []];
  let idx = 0;
  for (let i = 0; i < config.cardsPerPlayer; i++) {
    for (let p = 0; p < 4; p++) {
      hands[p].push(deck[idx++]);
    }
  }
  const bottom = deck.slice(idx);
  return { hands, bottom, config };
}

// ── Sorting ────────────────────────────────────────────────
export function sortHand(hand, trumpSuit, trumpRank) {
  return [...hand].sort((a, b) => {
    const aVal = cardSortValue(a, trumpSuit, trumpRank);
    const bVal = cardSortValue(b, trumpSuit, trumpRank);
    return bVal - aVal; // high to low
  });
}

export function cardSortValue(card, trumpSuit, trumpRank) {
  // Big Joker = 1000, Small Joker = 999
  if (card.suit === 'joker') return card.rank === 'big' ? 1000 : 999;

  const isTrumpRank = card.rank === trumpRank;
  const isTrumpSuit = card.suit === trumpSuit;

  if (isTrumpRank && isTrumpSuit) return 998; // Trump rank of trump suit
  if (isTrumpRank) {
    // Off-suit trump-rank cards: group by suit so identical cards stay together
    const SUIT_SUB = { spades: 3, hearts: 2, diamonds: 1, clubs: 0 };
    return 993 + (SUIT_SUB[card.suit] || 0); // 993-996, below trump-suit trump-rank (998)
  }

  if (isTrumpSuit) {
    return 500 + RANK_ORDER[card.rank]; // Trump suit cards
  }

  // Non-trump cards sorted by suit then rank (black/red interleaved)
  // Desired visual order: black, red, black, red — skipping the trump suit
  const BLACK_RED_ORDER = ['spades', 'hearts', 'clubs', 'diamonds']; // alternating black/red
  const nonTrumpSuits = BLACK_RED_ORDER.filter(s => s !== trumpSuit);
  const suitBase = {};
  nonTrumpSuits.forEach((s, i) => { suitBase[s] = (nonTrumpSuits.length - i) * 100; });
  return (suitBase[card.suit] || 0) + RANK_ORDER[card.rank];
}

// ── Trump Strength ─────────────────────────────────────────
export function isTrump(card, trumpSuit, trumpRank) {
  if (card.suit === 'joker') return true;
  if (card.rank === trumpRank) return true;
  if (trumpSuit && card.suit === trumpSuit) return true;
  return false;
}

export function getEffectiveSuit(card, trumpSuit, trumpRank) {
  if (isTrump(card, trumpSuit, trumpRank)) return 'trump';
  return card.suit;
}

// ── Card Comparison (for single card) ──────────────────────
export function cardStrength(card, trumpSuit, trumpRank) {
  if (card.suit === 'joker') return card.rank === 'big' ? 1000 : 999;
  const isTrumpRank = card.rank === trumpRank;
  const isTrumpSuit = card.suit === trumpSuit;
  if (isTrumpRank && isTrumpSuit) return 998;
  if (isTrumpRank) return 997;
  if (isTrumpSuit) return 500 + RANK_ORDER[card.rank];
  return RANK_ORDER[card.rank];
}

// ── Points Counting ────────────────────────────────────────
export function countPoints(cards) {
  return cards.reduce((sum, card) => sum + (card.points || 0), 0);
}

// ── Group cards by effective suit ──────────────────────────
export function groupBySuit(hand, trumpSuit, trumpRank) {
  const groups = { trump: [], spades: [], hearts: [], diamonds: [], clubs: [] };
  for (const card of hand) {
    const suit = getEffectiveSuit(card, trumpSuit, trumpRank);
    groups[suit].push(card);
  }
  // Remove empty non‑trump suits
  for (const suit of SUITS) {
    if (suit === trumpSuit) {
      // Trump suit cards are in 'trump' group
    }
  }
  return groups;
}

// ── Card identity key (same suit + rank = identical card across decks) ─────
export function cardKey(card) {
  if (card.suit === 'joker') return `joker-${card.rank}`;
  return `${card.suit}-${card.rank}`;
}

// ── Find pairs, tractors in a hand for a specific suit ─────
export function findPairs(cards, trumpSuit, trumpRank) {
  // Group by card identity (suit+rank), not by strength.
  // A pair requires two IDENTICAL cards (same suit and rank from different decks).
  const byIdentity = {};
  for (const card of cards) {
    const key = cardKey(card);
    if (!byIdentity[key]) byIdentity[key] = [];
    byIdentity[key].push(card);
  }
  const pairs = [];
  for (const group of Object.values(byIdentity)) {
    for (let i = 0; i + 1 < group.length; i += 2) {
      pairs.push([group[i], group[i + 1]]);
    }
  }
  return pairs;
}

export function findTractors(cards, trumpSuit, trumpRank) {
  const pairs = findPairs(cards, trumpSuit, trumpRank);
  if (pairs.length < 2) return [];

  // Sort pairs by strength of first card
  pairs.sort((a, b) => cardStrength(a[0], trumpSuit, trumpRank) - cardStrength(b[0], trumpSuit, trumpRank));

  const tractors = [];
  let current = [pairs[0]];

  for (let i = 1; i < pairs.length; i++) {
    const prevStrength = cardStrength(current[current.length - 1][0], trumpSuit, trumpRank);
    const currStrength = cardStrength(pairs[i][0], trumpSuit, trumpRank);

    if (isConsecutiveStrength(prevStrength, currStrength, trumpSuit, trumpRank)) {
      current.push(pairs[i]);
    } else {
      if (current.length >= 2) tractors.push([...current]);
      current = [pairs[i]];
    }
  }
  if (current.length >= 2) tractors.push(current);

  return tractors;
}

function isConsecutiveStrength(s1, s2, trumpSuit, trumpRank) {
  // For non-trump: simple rank+1
  // For trump: need special handling around trump rank
  return s2 - s1 === 1;
}

// ── Multi-deck structure detection ─────────────────────────

/**
 * Find groups of exactly `groupSize` identical cards (same suit+rank).
 * For 3/4 deck modes: finds triplets (groupSize=3) or quads (groupSize=4).
 * Cards must be truly identical (same suit and rank), not just same strength.
 */
export function findGroups(cards, groupSize, trumpSuit, trumpRank) {
  const byIdentity = {};
  for (const card of cards) {
    const key = cardKey(card);
    if (!byIdentity[key]) byIdentity[key] = [];
    byIdentity[key].push(card);
  }
  const groups = [];
  for (const group of Object.values(byIdentity)) {
    const count = Math.floor(group.length / groupSize);
    for (let i = 0; i < count; i++) {
      groups.push(group.slice(i * groupSize, (i + 1) * groupSize));
    }
  }
  return groups;
}

/**
 * Find tractors made of consecutive groups of `groupSize`.
 * E.g., groupSize=3 finds tractor-triplets like ♠333 ♠444.
 */
export function findTractorGroups(cards, groupSize, trumpSuit, trumpRank) {
  const groups = findGroups(cards, groupSize, trumpSuit, trumpRank);
  if (groups.length < 2) return [];

  groups.sort((a, b) =>
    cardStrength(a[0], trumpSuit, trumpRank) - cardStrength(b[0], trumpSuit, trumpRank)
  );

  const tractors = [];
  let current = [groups[0]];

  for (let i = 1; i < groups.length; i++) {
    const prevStrength = cardStrength(current[current.length - 1][0], trumpSuit, trumpRank);
    const currStrength = cardStrength(groups[i][0], trumpSuit, trumpRank);

    if (isConsecutiveStrength(prevStrength, currStrength, trumpSuit, trumpRank)) {
      current.push(groups[i]);
    } else {
      if (current.length >= 2) tractors.push([...current]);
      current = [groups[i]];
    }
  }
  if (current.length >= 2) tractors.push(current);

  return tractors;
}

export function findTriplets(cards, trumpSuit, trumpRank) {
  return findGroups(cards, 3, trumpSuit, trumpRank);
}

export function findQuads(cards, trumpSuit, trumpRank) {
  return findGroups(cards, 4, trumpSuit, trumpRank);
}

// ── Card identity check ───────────────────────────────────
export function sameCard(a, b) {
  return a.id === b.id;
}

export function removeCards(hand, cards) {
  const ids = new Set(cards.map(c => c.id));
  return hand.filter(c => !ids.has(c.id));
}

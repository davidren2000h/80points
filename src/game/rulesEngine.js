/**
 * Rules Engine for 80 Points (Shengji / Tractor)
 * Handles all validation logic, driven by deck count.
 */

import {
  isTrump, getEffectiveSuit, cardStrength, countPoints,
  findPairs, findTractors, groupBySuit, SUITS, RANK_ORDER, removeCards,
} from './cardUtils.js';

// ══════════════════════════════════════════════════════════
// 1. Trump Declaration & Counter-Trump
// ══════════════════════════════════════════════════════════

/**
 * Check if a trump declaration is valid.
 * @param {object[]} cards - Cards the player is declaring with (all same rank = trumpRank)
 * @param {number} deckCount
 * @param {object|null} currentDeclaration - Existing declaration to counter, or null
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateTrumpDeclaration(cards, deckCount, currentDeclaration) {
  if (cards.length === 0) return { valid: false, reason: 'No cards provided' };

  // All cards must be the same rank
  const rank = cards[0].rank;
  const suit = cards[0].suit;
  if (!cards.every(c => c.rank === rank)) {
    return { valid: false, reason: 'All declaration cards must be the same rank' };
  }

  // Jokers cannot declare suit trump (they declare no-trump)
  if (suit === 'joker') {
    return validateNoTrumpDeclaration(cards, deckCount, currentDeclaration);
  }

  // All cards must be the same suit for suit declaration
  if (!cards.every(c => c.suit === suit)) {
    return { valid: false, reason: 'All declaration cards must be the same suit' };
  }

  const count = cards.length;

  if (!currentDeclaration) {
    // First declaration: single is enough
    if (count >= 1) return { valid: true };
    return { valid: false, reason: 'Need at least 1 card to declare' };
  }

  // Counter-trump: need more cards than existing declaration
  const required = currentDeclaration.count + 1;
  const maxPossible = deckCount;

  if (count < required) {
    return { valid: false, reason: `Need ${required} cards to counter (have ${count})` };
  }
  if (count > maxPossible) {
    return { valid: false, reason: `Cannot declare more than ${maxPossible} cards` };
  }

  return { valid: true };
}

/**
 * Validate no-trump declaration (using jokers).
 */
export function validateNoTrumpDeclaration(cards, deckCount, currentDeclaration) {
  const requiredCount = { 2: 2, 3: 3, 4: 4 }[deckCount];

  if (cards.length < requiredCount) {
    return { valid: false, reason: `Need ${requiredCount} jokers for no-trump (have ${cards.length})` };
  }

  // Must be all same type of joker (all big or all small)
  const jokerType = cards[0].rank;
  if (!cards.every(c => c.suit === 'joker' && c.rank === jokerType)) {
    return { valid: false, reason: 'No-trump requires all same type of joker (all Big or all Small)' };
  }

  // No-trump always overrides suit-based trump
  return { valid: true };
}

/**
 * Get counter-trump requirements for display.
 */
export function getCounterTrumpRequirements(deckCount, currentDeclaration) {
  if (!currentDeclaration) return { min: 1, label: '1+ card of trump rank' };
  const required = currentDeclaration.count + 1;
  return {
    min: required,
    max: deckCount,
    label: `${required}+ cards to counter`,
  };
}

// ══════════════════════════════════════════════════════════
// 2. Follow Suit Rules
// ══════════════════════════════════════════════════════════

/**
 * Determine what cards a player can legally play.
 * @param {object[]} hand - Player's current hand
 * @param {object[]} leadPlay - The cards led in this trick
 * @param {string} trumpSuit
 * @param {string} trumpRank
 * @returns {object[]} - Array of playable cards from hand
 */
export function getLegalPlays(hand, leadPlay, trumpSuit, trumpRank) {
  if (!leadPlay || leadPlay.length === 0) {
    // Leading: can play anything
    return hand;
  }

  const leadSuit = getEffectiveSuit(leadPlay[0], trumpSuit, trumpRank);
  const leadStructure = analyzePlay(leadPlay, trumpSuit, trumpRank);
  const suitCards = hand.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === leadSuit);

  if (suitCards.length === 0) {
    // No cards of the led suit — can play anything
    return hand;
  }

  const requiredCount = leadPlay.length;

  if (suitCards.length <= requiredCount) {
    // Must play all suit cards, plus fill from other cards
    if (suitCards.length < requiredCount) {
      // Play all suit cards + any cards to make up the count
      // Return all cards as playable (engine will enforce that all suit cards are used)
      return hand;
    }
    return suitCards;
  }

  // Have more suit cards than needed: must pick from suit cards
  // For structured plays (pairs, tractors), try to match structure
  if (leadStructure.type === 'pair') {
    const pairs = findPairs(suitCards, trumpSuit, trumpRank);
    if (pairs.length > 0) {
      // Must play a pair if possible
      return suitCards; // Engine constrains to pairs from suit
    }
    return suitCards;
  }

  if (leadStructure.type === 'tractor') {
    const tractors = findTractors(suitCards, trumpSuit, trumpRank);
    if (tractors.length > 0) {
      return suitCards;
    }
    // No tractor: try pairs
    const pairs = findPairs(suitCards, trumpSuit, trumpRank);
    if (pairs.length > 0) {
      return suitCards;
    }
    return suitCards;
  }

  return suitCards;
}

/**
 * Validate that a specific play selection is legal.
 */
export function validatePlay(selectedCards, hand, leadPlay, trumpSuit, trumpRank) {
  if (!leadPlay || leadPlay.length === 0) {
    // Leading: validate play structure
    return validateLeadPlay(selectedCards, trumpSuit, trumpRank);
  }

  const requiredCount = leadPlay.length;
  if (selectedCards.length !== requiredCount) {
    return { valid: false, reason: `Must play exactly ${requiredCount} card(s)` };
  }

  // Check all selected cards are in hand
  const handIds = new Set(hand.map(c => c.id));
  if (!selectedCards.every(c => handIds.has(c.id))) {
    return { valid: false, reason: 'Selected cards not in hand' };
  }

  const leadSuit = getEffectiveSuit(leadPlay[0], trumpSuit, trumpRank);
  const suitCards = hand.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === leadSuit);
  const selectedSuitCards = selectedCards.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === leadSuit);

  if (suitCards.length >= requiredCount) {
    // Must play only suit cards
    if (selectedSuitCards.length < requiredCount) {
      return { valid: false, reason: `Must follow suit (${leadSuit})` };
    }
  } else {
    // Must play all suit cards first
    if (selectedSuitCards.length < suitCards.length) {
      return { valid: false, reason: `Must play all ${leadSuit} cards first` };
    }
  }

  return { valid: true };
}

/**
 * Validate a lead play structure.
 */
export function validateLeadPlay(cards, trumpSuit, trumpRank) {
  if (cards.length === 0) return { valid: false, reason: 'Must play at least 1 card' };
  if (cards.length === 1) return { valid: true };

  // All cards must be of the same effective suit
  const suit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);
  if (!cards.every(c => getEffectiveSuit(c, trumpSuit, trumpRank) === suit)) {
    return { valid: false, reason: 'All cards in a play must be the same suit' };
  }

  if (cards.length === 2) {
    // Must be a pair
    const s1 = cardStrength(cards[0], trumpSuit, trumpRank);
    const s2 = cardStrength(cards[1], trumpSuit, trumpRank);
    if (s1 === s2) return { valid: true };
    return { valid: false, reason: 'Two cards must form a pair' };
  }

  // 4+ cards: tractor or throw
  const analysis = analyzePlay(cards, trumpSuit, trumpRank);
  if (analysis.type !== 'invalid') return { valid: true };

  // Check if it's a valid throw (甩牌)
  return validateThrow(cards, trumpSuit, trumpRank);
}

// ══════════════════════════════════════════════════════════
// 3. Play Analysis
// ══════════════════════════════════════════════════════════

/**
 * Analyze a play to determine its type and structure.
 */
export function analyzePlay(cards, trumpSuit, trumpRank) {
  if (cards.length === 0) return { type: 'invalid' };
  if (cards.length === 1) return { type: 'single', cards, strength: cardStrength(cards[0], trumpSuit, trumpRank) };

  // Check for pair
  if (cards.length === 2) {
    const s1 = cardStrength(cards[0], trumpSuit, trumpRank);
    const s2 = cardStrength(cards[1], trumpSuit, trumpRank);
    if (s1 === s2) return { type: 'pair', cards, strength: s1 };
    return { type: 'invalid' };
  }

  // Check for tractor (consecutive pairs)
  if (cards.length % 2 === 0) {
    const tractorResult = checkTractor(cards, trumpSuit, trumpRank);
    if (tractorResult) return { type: 'tractor', cards, strength: tractorResult.maxStrength, pairs: tractorResult.pairs };
  }

  // Could be a throw
  return { type: 'throw', cards };
}

function checkTractor(cards, trumpSuit, trumpRank) {
  if (cards.length < 4 || cards.length % 2 !== 0) return null;

  // Group by strength
  const byStrength = {};
  for (const card of cards) {
    const s = cardStrength(card, trumpSuit, trumpRank);
    if (!byStrength[s]) byStrength[s] = [];
    byStrength[s].push(card);
  }

  // Each strength must have exactly 2 cards
  const strengths = Object.keys(byStrength).map(Number).sort((a, b) => a - b);
  if (strengths.length !== cards.length / 2) return null;
  if (!strengths.every(s => byStrength[s].length === 2)) return null;

  // Check consecutive
  for (let i = 1; i < strengths.length; i++) {
    if (strengths[i] - strengths[i - 1] !== 1) return null;
  }

  return {
    pairs: strengths.length,
    maxStrength: strengths[strengths.length - 1],
  };
}

// ══════════════════════════════════════════════════════════
// 4. Throwing (甩牌)
// ══════════════════════════════════════════════════════════

/**
 * Validate a throw attempt.
 * A throw must represent the maximum possible structure for that suit.
 * All cards must be of the same effective suit.
 */
export function validateThrow(cards, trumpSuit, trumpRank) {
  if (cards.length <= 1) return { valid: false, reason: 'Throw must be multiple cards' };

  // All same suit
  const suit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);
  if (!cards.every(c => getEffectiveSuit(c, trumpSuit, trumpRank) === suit)) {
    return { valid: false, reason: 'All throw cards must be same suit' };
  }

  // Decompose into components: tractors, pairs, singles
  const components = decomposeThrow(cards, trumpSuit, trumpRank);
  if (components) return { valid: true, components };

  return { valid: false, reason: 'Invalid throw structure' };
}

/**
 * Decompose a throw into its components (tractors, pairs, singles).
 */
export function decomposeThrow(cards, trumpSuit, trumpRank) {
  const remaining = [...cards];
  const components = { tractors: [], pairs: [], singles: [] };

  // Extract tractors first (greedy)
  const tractors = findTractors(remaining, trumpSuit, trumpRank);
  for (const tractor of tractors) {
    const tractorCards = tractor.flat();
    for (const tc of tractorCards) {
      const idx = remaining.findIndex(c => c.id === tc.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    components.tractors.push(tractorCards);
  }

  // Extract pairs
  const pairs = findPairs(remaining, trumpSuit, trumpRank);
  for (const pair of pairs) {
    for (const pc of pair) {
      const idx = remaining.findIndex(c => c.id === pc.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    components.pairs.push(pair);
  }

  // Remaining are singles
  components.singles = remaining;

  return components;
}

/**
 * Check if a throw can be beaten by any opponent.
 * Returns the failing component if the throw fails.
 */
export function checkThrowBeatable(throwCards, otherHands, trumpSuit, trumpRank) {
  const suit = getEffectiveSuit(throwCards[0], trumpSuit, trumpRank);
  const components = decomposeThrow(throwCards, trumpSuit, trumpRank);
  if (!components) return { beatable: false };

  for (const hand of otherHands) {
    const suitCards = hand.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === suit);

    // Check if any single can be beaten
    for (const single of components.singles) {
      const singleStrength = cardStrength(single, trumpSuit, trumpRank);
      if (suitCards.some(c => cardStrength(c, trumpSuit, trumpRank) > singleStrength)) {
        return { beatable: true, failCard: single };
      }
    }

    // Check if any pair can be beaten
    for (const pair of components.pairs) {
      const pairStrength = cardStrength(pair[0], trumpSuit, trumpRank);
      const opponentPairs = findPairs(suitCards, trumpSuit, trumpRank);
      if (opponentPairs.some(p => cardStrength(p[0], trumpSuit, trumpRank) > pairStrength)) {
        return { beatable: true, failCard: pair[0] };
      }
    }

    // Check if any tractor can be beaten
    for (const tractor of components.tractors) {
      const tractorAnalysis = analyzePlay(tractor, trumpSuit, trumpRank);
      const opponentTractors = findTractors(suitCards, trumpSuit, trumpRank);
      for (const oTractor of opponentTractors) {
        const oCards = oTractor.flat();
        if (oCards.length >= tractor.length) {
          const oAnalysis = analyzePlay(oCards.slice(0, tractor.length), trumpSuit, trumpRank);
          if (oAnalysis.strength > tractorAnalysis.strength) {
            return { beatable: true, failCard: tractor[0] };
          }
        }
      }
    }
  }

  return { beatable: false };
}

// ══════════════════════════════════════════════════════════
// 5. Trick Winner Determination
// ══════════════════════════════════════════════════════════

/**
 * Determine the winner of a trick.
 * @param {Array<{player: number, cards: object[]}>} plays
 * @param {string} trumpSuit
 * @param {string} trumpRank
 * @returns {number} - Index of winning player
 */
export function determineTrickWinner(plays, trumpSuit, trumpRank) {
  if (plays.length === 0) return -1;

  const leadCards = plays[0].cards;
  const leadSuit = getEffectiveSuit(leadCards[0], trumpSuit, trumpRank);
  const leadAnalysis = analyzePlay(leadCards, trumpSuit, trumpRank);

  let winnerIdx = 0;
  let winnerStrength = getStructuredStrength(leadCards, leadAnalysis, trumpSuit, trumpRank);
  let winnerIsTrump = leadSuit === 'trump';

  for (let i = 1; i < plays.length; i++) {
    const followCards = plays[i].cards;
    const playSuit = getEffectiveSuit(followCards[0], trumpSuit, trumpRank);
    const playIsTrump = playSuit === 'trump';

    // Check if the follower's play matches the lead's structure
    const followAnalysis = analyzePlay(followCards, trumpSuit, trumpRank);
    const structureMatches = doesStructureMatch(leadAnalysis, followAnalysis);

    // A play can only win if it matches the lead's structure
    // (e.g., pair beats pair, tractor beats tractor, single beats single)
    if (!structureMatches) continue;

    const playStrength = getStructuredStrength(followCards, followAnalysis, trumpSuit, trumpRank);

    if (playIsTrump && !winnerIsTrump) {
      // Trump beats non-trump (but only if structure matches)
      winnerIdx = i;
      winnerStrength = playStrength;
      winnerIsTrump = true;
    } else if (playIsTrump === winnerIsTrump && playSuit === (winnerIsTrump ? 'trump' : leadSuit)) {
      // Same suit category: compare strength
      if (playStrength > winnerStrength) {
        winnerIdx = i;
        winnerStrength = playStrength;
      }
    }
  }

  return plays[winnerIdx].player;
}

/**
 * Check if a following play's structure matches the lead play's structure.
 * In Shengji, only matching structure can beat the lead.
 */
function doesStructureMatch(leadAnalysis, followAnalysis) {
  // Single vs single
  if (leadAnalysis.type === 'single') return followAnalysis.type === 'single';
  // Pair vs pair
  if (leadAnalysis.type === 'pair') return followAnalysis.type === 'pair';
  // Tractor vs tractor (same number of pairs)
  if (leadAnalysis.type === 'tractor') {
    return followAnalysis.type === 'tractor' && followAnalysis.pairs === leadAnalysis.pairs;
  }
  // Throw: for simplicity, can only be beaten by a matching structure throw
  // (In practice, throws are complex — for now treat as max-card comparison if types differ)
  return leadAnalysis.type === followAnalysis.type;
}

/**
 * Get structured play strength. For matched structures, use the appropriate metric.
 */
function getStructuredStrength(cards, analysis, trumpSuit, trumpRank) {
  if (analysis.type === 'single') return cardStrength(cards[0], trumpSuit, trumpRank);
  if (analysis.type === 'pair') return analysis.strength;
  if (analysis.type === 'tractor') return analysis.strength;
  // Fallback for throws or invalid: use max card
  return Math.max(...cards.map(c => cardStrength(c, trumpSuit, trumpRank)));
}

function getPlayStrength(cards, trumpSuit, trumpRank) {
  if (cards.length === 1) return cardStrength(cards[0], trumpSuit, trumpRank);

  // For pairs/tractors: use highest card strength
  return Math.max(...cards.map(c => cardStrength(c, trumpSuit, trumpRank)));
}

// ══════════════════════════════════════════════════════════
// 6. Bottom Scoring
// ══════════════════════════════════════════════════════════

/**
 * Calculate bottom score with multiplier.
 * @param {object[]} bottomCards - Cards in the bottom
 * @param {number} lastTrickCardCount - Number of cards in the final trick play
 * @returns {number} - Multiplied score
 */
export function calculateBottomScore(bottomCards, lastTrickCardCount) {
  const rawPoints = countPoints(bottomCards);
  const multiplier = Math.max(1, lastTrickCardCount);
  return rawPoints * multiplier;
}

// ══════════════════════════════════════════════════════════
// 7. Level Advancement
// ══════════════════════════════════════════════════════════

/**
 * Calculate level change after a round.
 * @param {number} nonDeclarerPoints - Points captured by non-declarer team
 * @param {number} deckCount
 * @returns {{ declarerWins: boolean, levelChange: number }}
 */
export function calculateLevelChange(nonDeclarerPoints, deckCount) {
  const config = {
    2: { threshold: 80, increment: 20 },
    3: { threshold: 120, increment: 30 },
    4: { threshold: 160, increment: 40 },
  }[deckCount];

  if (nonDeclarerPoints === 0) {
    // Clean sweep (剃光头): declarer advances 3 levels
    return { declarerWins: true, levelChange: 3 };
  }

  if (nonDeclarerPoints >= config.threshold) {
    // Non-declarer wins
    const excess = nonDeclarerPoints - config.threshold;
    const extraLevels = Math.floor(excess / config.increment);
    return { declarerWins: false, levelChange: 1 + extraLevels };
  }

  // Declarer wins
  const deficit = config.threshold - nonDeclarerPoints;
  const extraLevels = Math.floor(deficit / config.increment);
  return { declarerWins: true, levelChange: 1 + extraLevels };
}

// ══════════════════════════════════════════════════════════
// 8. No-Trump Threshold Info
// ══════════════════════════════════════════════════════════

export function getNoTrumpRequirement(deckCount) {
  return {
    2: { count: 2, description: 'Pair of Big Jokers' },
    3: { count: 3, description: 'Three Big Jokers or three Small Jokers' },
    4: { count: 4, description: 'Four Big Jokers or four Small Jokers' },
  }[deckCount];
}

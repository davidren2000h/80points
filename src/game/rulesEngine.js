/**
 * Rules Engine for 80 Points (Shengji / Tractor)
 * Handles all validation logic, driven by deck count.
 */

import {
  isTrump, getEffectiveSuit, cardStrength, countPoints, cardKey,
  findPairs, findTractors, findGroups, findTractorGroups, findTriplets, findQuads,
  groupBySuit, SUITS, RANK_ORDER, removeCards,
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
 * Returns the pool of cards the player may choose from.
 * Actual structure enforcement is in validatePlay.
 */
export function getLegalPlays(hand, leadPlay, trumpSuit, trumpRank) {
  if (!leadPlay || leadPlay.length === 0) {
    return hand;
  }

  const leadSuit = getEffectiveSuit(leadPlay[0], trumpSuit, trumpRank);
  const suitCards = hand.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === leadSuit);

  if (suitCards.length === 0) {
    return hand;
  }

  const requiredCount = leadPlay.length;
  if (suitCards.length <= requiredCount) {
    if (suitCards.length < requiredCount) {
      return hand;
    }
    return suitCards;
  }

  return suitCards;
}

/**
 * Validate that a specific play selection is legal.
 * Enforces follow-suit and structure-first rules.
 */
export function validatePlay(selectedCards, hand, leadPlay, trumpSuit, trumpRank) {
  if (!leadPlay || leadPlay.length === 0) {
    return validateLeadPlay(selectedCards, trumpSuit, trumpRank);
  }

  const requiredCount = leadPlay.length;
  if (selectedCards.length !== requiredCount) {
    return { valid: false, reason: `Must play exactly ${requiredCount} card(s)` };
  }

  const handIds = new Set(hand.map(c => c.id));
  if (!selectedCards.every(c => handIds.has(c.id))) {
    return { valid: false, reason: 'Selected cards not in hand' };
  }

  const leadSuit = getEffectiveSuit(leadPlay[0], trumpSuit, trumpRank);
  const suitCards = hand.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === leadSuit);
  const selectedSuitCards = selectedCards.filter(c => getEffectiveSuit(c, trumpSuit, trumpRank) === leadSuit);

  if (suitCards.length >= requiredCount) {
    if (selectedSuitCards.length < requiredCount) {
      return { valid: false, reason: `Must follow suit (${leadSuit})` };
    }
    // Enforce structure-first rule (triplet > pair > single)
    return validateFollowStructure(selectedSuitCards, suitCards, leadPlay, trumpSuit, trumpRank);
  } else {
    if (selectedSuitCards.length < suitCards.length) {
      return { valid: false, reason: `Must play all ${leadSuit} cards first` };
    }
  }

  return { valid: true };
}

/**
 * Validate that follow cards maximize structure usage.
 * Enforces the downgrade chain: quad > triplet > pair > single.
 */
function validateFollowStructure(selectedSuitCards, allSuitCards, leadPlay, trumpSuit, trumpRank) {
  const leadAnalysis = analyzePlay(leadPlay, trumpSuit, trumpRank);

  if (leadAnalysis.type === 'single') return { valid: true };

  // Determine target group size from lead
  let targetGroupSize;
  if (leadAnalysis.type === 'pair') targetGroupSize = 2;
  else if (leadAnalysis.type === 'triplet') targetGroupSize = 3;
  else if (leadAnalysis.type === 'quad') targetGroupSize = 4;
  else if (leadAnalysis.type === 'tractor') targetGroupSize = leadAnalysis.groupSize;
  else return { valid: true };

  // For tractors, first check matching tractor requirement
  if (leadAnalysis.type === 'tractor') {
    const availTractors = findTractorGroups(allSuitCards, leadAnalysis.groupSize, trumpSuit, trumpRank);
    const matching = availTractors.filter(t => t.length >= leadAnalysis.groups);
    if (matching.length > 0) {
      const selectedTractors = findTractorGroups(selectedSuitCards, leadAnalysis.groupSize, trumpSuit, trumpRank);
      const selectedMatching = selectedTractors.filter(t => t.length >= leadAnalysis.groups);
      if (selectedMatching.length === 0) {
        return { valid: false, reason: 'Must play a matching tractor when you have one' };
      }
      return { valid: true };
    }
  }

  // Structure downgrade check: must use highest available structure
  const names = { 2: 'pair', 3: 'triplet', 4: 'quad' };
  for (let gs = targetGroupSize; gs >= 2; gs--) {
    const availGroups = findGroups(allSuitCards, gs, trumpSuit, trumpRank);
    if (availGroups.length > 0) {
      const selectedGroups = findGroups(selectedSuitCards, gs, trumpSuit, trumpRank);
      if (selectedGroups.length === 0) {
        return { valid: false, reason: `Must play a ${names[gs] || gs + '-group'} when you have one` };
      }
      return { valid: true };
    }
  }

  return { valid: true };
}

/**
 * Validate a lead play structure.
 * Supports singles, pairs, triplets, quads, tractors (all group sizes), and throws.
 */
export function validateLeadPlay(cards, trumpSuit, trumpRank) {
  if (cards.length === 0) return { valid: false, reason: 'Must play at least 1 card' };
  if (cards.length === 1) return { valid: true };

  const suit = getEffectiveSuit(cards[0], trumpSuit, trumpRank);
  if (!cards.every(c => getEffectiveSuit(c, trumpSuit, trumpRank) === suit)) {
    return { valid: false, reason: 'All cards in a play must be the same suit' };
  }

  const analysis = analyzePlay(cards, trumpSuit, trumpRank);

  // Valid atomic structures: pair, triplet, quad, tractor (any group size)
  if (['pair', 'triplet', 'quad', 'tractor'].includes(analysis.type)) {
    return { valid: true };
  }

  // Check if it's a valid throw (甩牌)
  if (analysis.type === 'throw') {
    return validateThrow(cards, trumpSuit, trumpRank);
  }

  return { valid: false, reason: 'Invalid card combination' };
}

// ══════════════════════════════════════════════════════════
// 3. Play Analysis
// ══════════════════════════════════════════════════════════

/**
 * Analyze a play to determine its type and structure.
 * Supports: single, pair, triplet, quad, tractor (pair/triplet/quad based), throw.
 */
export function analyzePlay(cards, trumpSuit, trumpRank) {
  if (cards.length === 0) return { type: 'invalid' };
  if (cards.length === 1) return { type: 'single', cards, strength: cardStrength(cards[0], trumpSuit, trumpRank) };

  // Group by card identity (suit+rank) — a pair/triplet/quad requires identical cards
  const byIdentity = {};
  for (const card of cards) {
    const key = cardKey(card);
    if (!byIdentity[key]) byIdentity[key] = [];
    byIdentity[key].push(card);
  }

  const identityKeys = Object.keys(byIdentity);
  const groups = identityKeys.map(k => byIdentity[k]);
  // Sort groups by strength
  groups.sort((a, b) => cardStrength(a[0], trumpSuit, trumpRank) - cardStrength(b[0], trumpSuit, trumpRank));
  const groupSizes = groups.map(g => g.length);
  const strengths = groups.map(g => cardStrength(g[0], trumpSuit, trumpRank));

  // Single identity group (all cards are truly identical)
  if (groups.length === 1) {
    const size = groupSizes[0];
    const strength = strengths[0];
    if (size === 2) return { type: 'pair', cards, strength };
    if (size === 3) return { type: 'triplet', cards, strength };
    if (size === 4) return { type: 'quad', cards, strength };
    return { type: 'throw', cards };
  }

  // Multiple identity groups: check tractor patterns (all groups same size, consecutive strengths)
  const allSameSize = groupSizes.every(s => s === groupSizes[0]);
  if (allSameSize && groupSizes[0] >= 2 && groups.length >= 2) {
    let consecutive = true;
    for (let i = 1; i < strengths.length; i++) {
      if (strengths[i] - strengths[i - 1] !== 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      const groupSize = groupSizes[0];
      return {
        type: 'tractor',
        cards,
        strength: strengths[strengths.length - 1],
        groupSize,
        groups: groups.length,
        pairs: groupSize === 2 ? groups.length : undefined,
      };
    }
  }

  // Otherwise: throw
  return { type: 'throw', cards };
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
 * Decompose a throw into its components.
 * Priority order: tractor-quads, quads, tractor-triplets, triplets, tractor-pairs, pairs, singles.
 */
export function decomposeThrow(cards, trumpSuit, trumpRank) {
  const remaining = [...cards];
  const components = { tractors: [], quads: [], triplets: [], pairs: [], singles: [] };

  function extractCards(cardList) {
    for (const c of cardList) {
      const idx = remaining.findIndex(r => r.id === c.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  // 1. Tractor-quads
  const tractorQuads = findTractorGroups(remaining, 4, trumpSuit, trumpRank);
  for (const tractor of tractorQuads) {
    const flat = tractor.flat();
    extractCards(flat);
    components.tractors.push(flat);
  }

  // 2. Quads
  const quads = findQuads(remaining, trumpSuit, trumpRank);
  for (const quad of quads) {
    extractCards(quad);
    components.quads.push(quad);
  }

  // 3. Tractor-triplets
  const tractorTriplets = findTractorGroups(remaining, 3, trumpSuit, trumpRank);
  for (const tractor of tractorTriplets) {
    const flat = tractor.flat();
    extractCards(flat);
    components.tractors.push(flat);
  }

  // 4. Triplets
  const triplets = findTriplets(remaining, trumpSuit, trumpRank);
  for (const triplet of triplets) {
    extractCards(triplet);
    components.triplets.push(triplet);
  }

  // 5. Tractor-pairs
  const tractors = findTractors(remaining, trumpSuit, trumpRank);
  for (const tractor of tractors) {
    const flat = tractor.flat();
    extractCards(flat);
    components.tractors.push(flat);
  }

  // 6. Pairs
  const pairs = findPairs(remaining, trumpSuit, trumpRank);
  for (const pair of pairs) {
    extractCards(pair);
    components.pairs.push(pair);
  }

  // 7. Singles
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

    // Check singles
    for (const single of components.singles) {
      const singleStrength = cardStrength(single, trumpSuit, trumpRank);
      if (suitCards.some(c => cardStrength(c, trumpSuit, trumpRank) > singleStrength)) {
        return { beatable: true, failCard: single };
      }
    }

    // Check pairs
    for (const pair of components.pairs) {
      const pairStrength = cardStrength(pair[0], trumpSuit, trumpRank);
      const opponentPairs = findPairs(suitCards, trumpSuit, trumpRank);
      if (opponentPairs.some(p => cardStrength(p[0], trumpSuit, trumpRank) > pairStrength)) {
        return { beatable: true, failCard: pair[0] };
      }
    }

    // Check triplets
    for (const triplet of (components.triplets || [])) {
      const tripletStrength = cardStrength(triplet[0], trumpSuit, trumpRank);
      const opponentTriplets = findTriplets(suitCards, trumpSuit, trumpRank);
      if (opponentTriplets.some(t => cardStrength(t[0], trumpSuit, trumpRank) > tripletStrength)) {
        return { beatable: true, failCard: triplet[0] };
      }
    }

    // Check quads
    for (const quad of (components.quads || [])) {
      const quadStrength = cardStrength(quad[0], trumpSuit, trumpRank);
      const opponentQuads = findQuads(suitCards, trumpSuit, trumpRank);
      if (opponentQuads.some(q => cardStrength(q[0], trumpSuit, trumpRank) > quadStrength)) {
        return { beatable: true, failCard: quad[0] };
      }
    }

    // Check tractors (all group sizes)
    for (const tractor of components.tractors) {
      const tractorAnalysis = analyzePlay(tractor, trumpSuit, trumpRank);
      if (tractorAnalysis.type === 'tractor') {
        const opponentTractors = findTractorGroups(suitCards, tractorAnalysis.groupSize, trumpSuit, trumpRank);
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

  // Throws (甩牌) are only allowed when no opponent can beat any component,
  // so the leader always wins a throw.
  if (leadAnalysis.type === 'throw') {
    return plays[0].player;
  }

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
  if (leadAnalysis.type === 'single') return followAnalysis.type === 'single';
  if (leadAnalysis.type === 'pair') return followAnalysis.type === 'pair';
  if (leadAnalysis.type === 'triplet') return followAnalysis.type === 'triplet';
  if (leadAnalysis.type === 'quad') return followAnalysis.type === 'quad';
  if (leadAnalysis.type === 'tractor') {
    return followAnalysis.type === 'tractor' &&
      followAnalysis.groupSize === leadAnalysis.groupSize &&
      followAnalysis.groups === leadAnalysis.groups;
  }
  return leadAnalysis.type === followAnalysis.type;
}

/**
 * Get structured play strength. For matched structures, use the appropriate metric.
 */
function getStructuredStrength(cards, analysis, trumpSuit, trumpRank) {
  if (analysis.type === 'single') return cardStrength(cards[0], trumpSuit, trumpRank);
  if (['pair', 'triplet', 'quad', 'tractor'].includes(analysis.type)) return analysis.strength;
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

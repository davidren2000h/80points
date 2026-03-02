/**
 * Game Engine for 80 Points (Shengji / Tractor)
 * Full game state machine with immutable state updates.
 */

import {
  dealCards, getDeckConfig, sortHand, countPoints, removeCards,
  isTrump, getEffectiveSuit, cardStrength, getCardDisplay, RANKS,
  buildDeck, shuffle,
} from './cardUtils.js';

import {
  validateTrumpDeclaration, validatePlay, validateLeadPlay,
  determineTrickWinner, calculateBottomScore, calculateLevelChange,
  checkThrowBeatable, analyzePlay, getLegalPlays, decomposeThrow,
} from './rulesEngine.js';

// ── Game Phases ────────────────────────────────────────────
export const PHASES = {
  SETUP: 'setup',
  DEALING: 'dealing',
  DECLARING: 'declaring',
  BOTTOM: 'bottom',           // Declarer picks up + discards bottom
  PLAYING: 'playing',
  TRICK_END: 'trick_end',
  ROUND_END: 'round_end',
  GAME_OVER: 'game_over',
};

// ── Initial State ──────────────────────────────────────────
export function createInitialState() {
  return {
    phase: PHASES.SETUP,
    deckCount: 2,

    // Players: 0=South, 1=West, 2=North, 3=East
    // Teams: [0,2] vs [1,3]
    players: [
      { name: 'You', level: 2, team: 0 },
      { name: 'West', level: 2, team: 1 },
      { name: 'North', level: 2, team: 0 },
      { name: 'East', level: 2, team: 1 },
    ],

    hands: [[], [], [], []],
    bottom: [],
    discardedBottom: [],

    // Dealing state
    dealQueue: [],        // Cards waiting to be dealt
    dealCardIndex: 0,     // Which player gets next card
    dealingDone: false,
    dealingPaused: false,  // True when waiting for player 0 to decide on trump declaration
    dealingPrompt: null,   // { options: [{ suit, count, cards, label }], canCounter: bool }
    dealingLastPromptKey: null, // Track the last prompt fingerprint to avoid re-prompting same situation

    trumpSuit: null,
    trumpRank: '2',   // Current trump rank (based on declarer's level)
    noTrump: false,

    declaration: null,  // { player, suit, count, cards }
    declarer: 0,        // Player index of the declarer
    declarerTeam: 0,    // Team index of declaring side

    // Trick state
    currentTrick: [],   // [{ player, cards }]
    trickLeader: 0,
    tricksPlayed: 0,

    // Scoring
    nonDeclarerPoints: 0,
    declarerPoints: 0,
    trickPoints: [],     // Points won per trick

    // Round tracking
    roundNumber: 1,
    lastTrickWinner: null,
    lastTrickCardCount: 0,

    // Configuration cache
    config: getDeckConfig(2),

    // UI state
    selectedCards: [],
    message: 'Select deck count and start the game!',
  };
}

// ── Action Dispatch ────────────────────────────────────────
export function dispatch(state, action) {
  switch (action.type) {
    case 'SET_DECK_COUNT': return setDeckCount(state, action.deckCount);
    case 'SET_PLAYER_NAMES': return setPlayerNames(state, action.playerName, action.aiNames);
    case 'START_GAME': return startGame(state);
    case 'DEAL_NEXT': return dealNext(state);
    case 'DEALING_DECLARE': return dealingDeclare(state, action.suit, action.count);
    case 'DEALING_SKIP': return dealingSkip(state);
    case 'DECLARE_TRUMP': return declareTrump(state, action.player, action.cards);
    case 'FINALIZE_TRUMP': return finalizeTrump(state);
    case 'DISCARD_BOTTOM': return discardBottom(state, action.cards);
    case 'SELECT_CARD': return selectCard(state, action.cardId);
    case 'PLAY_CARDS': return playCards(state, action.player);
    case 'AI_PLAY': return aiPlay(state);
    case 'NEXT_TRICK': return nextTrick(state);
    case 'END_ROUND': return endRound(state);
    case 'NEXT_ROUND': return nextRound(state);
    default: return state;
  }
}

// ── Reducers ───────────────────────────────────────────────

function setDeckCount(state, deckCount) {
  if (state.phase !== PHASES.SETUP) return state;
  return {
    ...state,
    deckCount,
    config: getDeckConfig(deckCount),
  };
}

function setPlayerNames(state, playerName, aiNames) {
  if (state.phase !== PHASES.SETUP) return state;
  const newPlayers = state.players.map((p, i) => {
    if (i === 0) return { ...p, name: playerName };
    // aiNames is [west, north, east] => indices 1,2,3
    return { ...p, name: aiNames[i - 1] };
  });
  return { ...state, players: newPlayers };
}

function startGame(state) {
  if (state.phase !== PHASES.SETUP) return state;

  const config = getDeckConfig(state.deckCount);
  const deck = shuffle(buildDeck(state.deckCount));
  const trumpRank = getLevelRank(state.players[state.declarer].level);

  // Split deck into player cards and bottom cards
  const playerCardCount = config.cardsPerPlayer * 4;
  const playerCards = deck.slice(0, playerCardCount);
  const bottomCards = deck.slice(playerCardCount);

  return {
    ...state,
    phase: PHASES.DEALING,
    hands: [[], [], [], []],
    bottom: bottomCards,
    config,
    trumpRank,
    trumpSuit: null,
    noTrump: false,
    declaration: null,
    currentTrick: [],
    nonDeclarerPoints: 0,
    declarerPoints: 0,
    trickPoints: [],
    tricksPlayed: 0,
    selectedCards: [],
    dealQueue: playerCards,
    dealCardIndex: 0,
    dealingDone: false,
    message: `Dealing ${config.cardsPerPlayer} cards to each player...`,
  };
}

/**
 * Deal next card from the queue to the next player (round-robin).
 * AI players may auto-declare trump when they receive a trump-rank card.
 */
function dealNext(state) {
  if (state.phase !== PHASES.DEALING) return state;
  if (state.dealingPaused) return state; // Waiting for player 0 response

  if (state.dealQueue.length === 0) {
    // Dealing is complete → enter DECLARING phase
    const sortedHands = state.hands.map(h => sortHand(h, state.trumpSuit, state.trumpRank));
    return {
      ...state,
      phase: PHASES.DECLARING,
      hands: sortedHands,
      dealingDone: true,
      dealingPaused: false,
      dealingPrompt: null,
      message: `Dealing complete! ${state.config.cardsPerPlayer} cards each, ${state.config.bottomCards} in bottom. Declare trump or finalize.`,
    };
  }

  const card = state.dealQueue[0];
  const remaining = state.dealQueue.slice(1);
  const player = state.dealCardIndex % 4;
  const newHands = state.hands.map((h, i) =>
    i === player ? [...h, card] : h
  );
  const nextIdx = state.dealCardIndex + 1;

  // Check if this AI player wants to auto-declare trump
  let newDeclaration = state.declaration;
  let newDeclarer = state.declarer;
  let newDeclarerTeam = state.declarerTeam;
  let newTrumpSuit = state.trumpSuit;
  let newNoTrump = state.noTrump;
  let declMsg = '';

  if (player !== 0) { // AI players (1, 2, 3)
    const aiResult = aiTryDeclare(newHands[player], player, state.trumpRank, state.deckCount, state.declaration);
    if (aiResult) {
      newDeclaration = aiResult;
      newDeclarer = player;
      newDeclarerTeam = state.players[player].team;
      newTrumpSuit = aiResult.suit;
      newNoTrump = aiResult.isNoTrump;
      declMsg = aiResult.isNoTrump
        ? ` — ${state.players[player].name} declared No-Trump!`
        : ` — ${state.players[player].name} declared ${aiResult.suit} as trump!`;
    }
  }

  const cardsDealt = nextIdx;
  const totalCards = state.config.cardsPerPlayer * 4;
  const progress = Math.round((cardsDealt / totalCards) * 100);

  // Check if player 0 should be prompted to declare
  // We check after every card is dealt (regardless of who received it),
  // because an AI declaration may have happened that opens counter options
  const prompt = buildPlayerDeclarePrompt(newHands[0], state.trumpRank, state.deckCount, newDeclaration);

  if (prompt) {
    // Build a fingerprint so we don't re-prompt the exact same situation
    const promptKey = prompt.options.map(o => `${o.suit}:${o.count}`).sort().join('|');
    if (promptKey !== state.dealingLastPromptKey) {
      return {
        ...state,
        hands: newHands,
        dealQueue: remaining,
        dealCardIndex: nextIdx,
        declaration: newDeclaration,
        declarer: newDeclarer,
        declarerTeam: newDeclarerTeam,
        trumpSuit: newTrumpSuit,
        noTrump: newNoTrump,
        dealingPaused: true,
        dealingPrompt: prompt,
        dealingLastPromptKey: promptKey,
        message: `Dealing paused — You have trump cards! Declare or skip.`,
      };
    }
  }

  return {
    ...state,
    hands: newHands,
    dealQueue: remaining,
    dealCardIndex: nextIdx,
    declaration: newDeclaration,
    declarer: newDeclarer,
    declarerTeam: newDeclarerTeam,
    trumpSuit: newTrumpSuit,
    noTrump: newNoTrump,
    dealingPaused: false,
    dealingPrompt: null,
    message: `Dealing... ${progress}%${declMsg}`,
  };
}

/**
 * Build a prompt for player 0 to declare trump during dealing.
 * Returns null if no new declaration options are available.
 */
function buildPlayerDeclarePrompt(hand, trumpRank, deckCount, currentDeclaration) {
  // Group trump-rank cards by suit
  const trumpCards = hand.filter(c => c.rank === trumpRank && c.suit !== 'joker');
  const bySuit = {};
  for (const c of trumpCards) {
    if (!bySuit[c.suit]) bySuit[c.suit] = [];
    bySuit[c.suit].push(c);
  }

  // Also check jokers for no-trump
  const bigJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'big');
  const smallJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'small');
  const noTrumpReq = { 2: 2, 3: 3, 4: 4 }[deckCount];

  const options = [];

  if (!currentDeclaration) {
    // No one has declared yet — any single trump-rank card is enough
    for (const [suit, cards] of Object.entries(bySuit)) {
      // Offer declaring with 1, 2, ... up to all cards of this suit
      for (let count = 1; count <= cards.length; count++) {
        options.push({
          suit,
          count,
          cards: cards.slice(0, count),
          label: `Declare ${suit} ×${count}`,
          isNoTrump: false,
        });
      }
    }
    // No-trump options
    if (bigJokers.length >= noTrumpReq) {
      options.push({
        suit: null,
        count: noTrumpReq,
        cards: bigJokers.slice(0, noTrumpReq),
        label: `No-Trump (Big Joker ×${noTrumpReq})`,
        isNoTrump: true,
      });
    }
    if (smallJokers.length >= noTrumpReq) {
      options.push({
        suit: null,
        count: noTrumpReq,
        cards: smallJokers.slice(0, noTrumpReq),
        label: `No-Trump (Small Joker ×${noTrumpReq})`,
        isNoTrump: true,
      });
    }
  } else {
    // Someone already declared — need more cards to counter
    // Don't prompt if player 0 is the current declarer (can't counter yourself)
    if (currentDeclaration.player === 0) return null;

    const needed = currentDeclaration.count + 1;
    for (const [suit, cards] of Object.entries(bySuit)) {
      for (let count = needed; count <= cards.length; count++) {
        options.push({
          suit,
          count,
          cards: cards.slice(0, count),
          label: `Counter: ${suit} ×${count}`,
          isNoTrump: false,
        });
      }
    }
    // No-trump always overrides
    if (bigJokers.length >= noTrumpReq) {
      options.push({
        suit: null,
        count: noTrumpReq,
        cards: bigJokers.slice(0, noTrumpReq),
        label: `No-Trump (Big Joker ×${noTrumpReq})`,
        isNoTrump: true,
      });
    }
    if (smallJokers.length >= noTrumpReq) {
      options.push({
        suit: null,
        count: noTrumpReq,
        cards: smallJokers.slice(0, noTrumpReq),
        label: `No-Trump (Small Joker ×${noTrumpReq})`,
        isNoTrump: true,
      });
    }
  }

  if (options.length === 0) return null;

  // Deduplicate: only show the highest count per suit (user picks)
  // Actually keep all so user can choose 1 or 2 etc.
  return { options, canCounter: !!currentDeclaration };
}

/**
 * Player 0 chose to declare during dealing.
 */
function dealingDeclare(state, suit, count) {
  if (!state.dealingPaused || !state.dealingPrompt) return state;

  const option = state.dealingPrompt.options.find(
    o => o.suit === suit && o.count === count
  );
  if (!option) return { ...state, message: 'Invalid declaration option.' };

  const newDeclaration = {
    player: 0,
    suit: option.suit,
    count: option.count,
    cards: option.cards,
    isNoTrump: option.isNoTrump,
  };

  return {
    ...state,
    declaration: newDeclaration,
    declarer: 0,
    declarerTeam: state.players[0].team,
    trumpSuit: option.suit,
    noTrump: option.isNoTrump,
    dealingPaused: false,
    dealingPrompt: null,
    dealingLastPromptKey: null, // Reset so future counter prompts show
    message: option.isNoTrump
      ? `You declared No-Trump! Dealing continues...`
      : `You declared ${option.suit} as trump with ${option.count} card(s)! Dealing continues...`,
  };
}

/**
 * Player 0 chose to skip declaration during dealing.
 */
function dealingSkip(state) {
  if (!state.dealingPaused) return state;
  return {
    ...state,
    dealingPaused: false,
    dealingPrompt: null,
    message: 'You skipped declaration. Dealing continues...',
  };
}

/**
 * AI attempts to declare trump during dealing.
 * Simple strategy: declare if they have 2+ of the same trump-rank suit.
 */
function aiTryDeclare(hand, player, trumpRank, deckCount, currentDeclaration) {
  // Group trump-rank cards by suit
  const trumpCards = hand.filter(c => c.rank === trumpRank && c.suit !== 'joker');
  const bySuit = {};
  for (const c of trumpCards) {
    if (!bySuit[c.suit]) bySuit[c.suit] = [];
    bySuit[c.suit].push(c);
  }

  // Find best declaration
  let bestSuit = null;
  let bestCount = 0;
  for (const [suit, cards] of Object.entries(bySuit)) {
    if (cards.length > bestCount) {
      bestCount = cards.length;
      bestSuit = suit;
    }
  }

  if (!currentDeclaration) {
    // No existing declaration: declare if we have any trump-rank card
    // AI is somewhat conservative: only declare with 1+ cards
    if (bestCount >= 1 && Math.random() < 0.3 * bestCount) {
      const declCards = bySuit[bestSuit].slice(0, bestCount);
      return {
        player,
        suit: bestSuit,
        count: declCards.length,
        cards: declCards,
        isNoTrump: false,
      };
    }
  } else {
    // Counter-declare: need more cards than current
    const needed = currentDeclaration.count + 1;
    if (bestCount >= needed && currentDeclaration.player !== player) {
      const declCards = bySuit[bestSuit].slice(0, bestCount);
      return {
        player,
        suit: bestSuit,
        count: declCards.length,
        cards: declCards,
        isNoTrump: false,
      };
    }
  }

  return null;
}

function declareTrump(state, player, cards) {
  if (state.phase !== PHASES.DECLARING) return state;

  // Validate cards are in player's hand and are trump rank
  const hand = state.hands[player];
  const validCards = cards.filter(c =>
    hand.some(h => h.id === c.id) && (c.rank === state.trumpRank || c.suit === 'joker')
  );

  if (validCards.length === 0) {
    return { ...state, message: 'Invalid declaration cards.' };
  }

  const result = validateTrumpDeclaration(validCards, state.deckCount, state.declaration);
  if (!result.valid) {
    return { ...state, message: result.reason };
  }

  const isNoTrump = validCards[0].suit === 'joker';
  const newSuit = isNoTrump ? null : validCards[0].suit;

  return {
    ...state,
    declaration: {
      player,
      suit: newSuit,
      count: validCards.length,
      cards: validCards,
      isNoTrump,
    },
    declarer: player,
    declarerTeam: state.players[player].team,
    trumpSuit: newSuit,
    noTrump: isNoTrump,
    message: isNoTrump
      ? `Player ${state.players[player].name} declared No-Trump!`
      : `Player ${state.players[player].name} declared ${newSuit} as trump with ${validCards.length} card(s)!`,
  };
}

function finalizeTrump(state) {
  if (state.phase !== PHASES.DECLARING) return state;

  let trumpSuit = state.trumpSuit;
  let noTrump = state.noTrump;
  let declarer = state.declarer;

  // If no one declared, flip bottom card
  if (!state.declaration) {
    const bottomCard = state.bottom[0];
    if (bottomCard && bottomCard.suit !== 'joker') {
      trumpSuit = bottomCard.suit;
    } else {
      // Joker in bottom: no trump or re-deal (use first non-joker)
      const nonJoker = state.bottom.find(c => c.suit !== 'joker');
      trumpSuit = nonJoker ? nonJoker.suit : 'spades';
    }
    noTrump = false;
  }

  // Declarer picks up bottom
  const newHands = state.hands.map((h, i) => {
    if (i === declarer) {
      const combined = [...h, ...state.bottom];
      return sortHand(combined, trumpSuit, state.trumpRank);
    }
    return sortHand(h, trumpSuit, state.trumpRank);
  });

  return {
    ...state,
    phase: PHASES.BOTTOM,
    hands: newHands,
    trumpSuit,
    noTrump,
    declarer,
    declarerTeam: state.players[declarer].team,
    selectedCards: [],
    message: `Trump: ${noTrump ? 'No-Trump' : trumpSuit} (rank ${state.trumpRank}). ${state.players[declarer].name} must discard ${state.config.bottomCards} card(s) to the bottom.`,
  };
}

function discardBottom(state, cards) {
  if (state.phase !== PHASES.BOTTOM) return state;
  if (cards.length !== state.config.bottomCards) {
    return { ...state, message: `Must discard exactly ${state.config.bottomCards} cards.` };
  }

  const declarer = state.declarer;
  const newHand = removeCards(state.hands[declarer], cards);
  const newHands = state.hands.map((h, i) => i === declarer ? sortHand(newHand, state.trumpSuit, state.trumpRank) : h);

  return {
    ...state,
    phase: PHASES.PLAYING,
    hands: newHands,
    discardedBottom: cards,
    bottom: cards,
    trickLeader: declarer,
    selectedCards: [],
    message: `Bottom set. ${state.players[declarer].name} leads the first trick!`,
  };
}

function selectCard(state, cardId) {
  const selected = state.selectedCards.includes(cardId)
    ? state.selectedCards.filter(id => id !== cardId)
    : [...state.selectedCards, cardId];
  return { ...state, selectedCards: selected };
}

function playCards(state, player) {
  if (state.phase !== PHASES.PLAYING) return state;

  // Get the current expected player (counter-clockwise order for Shengji)
  const expectedPlayer = state.currentTrick.length === 0
    ? state.trickLeader
    : (state.trickLeader + 3 * state.currentTrick.length) % 4;

  if (player !== expectedPlayer) {
    return { ...state, message: `It's ${state.players[expectedPlayer].name}'s turn.` };
  }

  const hand = state.hands[player];
  const selectedCards = hand.filter(c => state.selectedCards.includes(c.id));

  if (selectedCards.length === 0) {
    return { ...state, message: 'Select cards to play.' };
  }

  // Determine required card count
  const isLeading = state.currentTrick.length === 0;
  const leadPlay = isLeading ? null : state.currentTrick[0].cards;

  if (!isLeading && selectedCards.length !== leadPlay.length) {
    return { ...state, message: `Must play ${leadPlay.length} card(s) to match the lead.` };
  }

  // Validate the play
  if (isLeading) {
    const result = validateLeadPlay(selectedCards, state.trumpSuit, state.trumpRank);
    if (!result.valid) return { ...state, message: result.reason };

    // If it's a throw (多张), check if it's beatable
    if (selectedCards.length > 2) {
      const analysis = analyzePlay(selectedCards, state.trumpSuit, state.trumpRank);
      if (analysis.type === 'throw') {
        const otherHands = state.hands.filter((_, i) => i !== player);
        const beatCheck = checkThrowBeatable(selectedCards, otherHands, state.trumpSuit, state.trumpRank);
        if (beatCheck.beatable) {
          // Force play the smallest failing component
          const components = decomposeThrow(selectedCards, state.trumpSuit, state.trumpRank);
          const failCard = beatCheck.failCard;
          return {
            ...state,
            message: `Throw failed! An opponent can beat your ${getCardDisplay(failCard)}. Play the smallest card.`,
            selectedCards: [failCard.id],
          };
        }
      }
    }
  } else {
    const result = validatePlay(selectedCards, hand, leadPlay, state.trumpSuit, state.trumpRank);
    if (!result.valid) return { ...state, message: result.reason };
  }

  // Execute the play
  const newHand = removeCards(hand, selectedCards);
  const newHands = state.hands.map((h, i) => i === player ? newHand : h);
  const newTrick = [...state.currentTrick, { player, cards: selectedCards }];

  if (newTrick.length < 4) {
    const nextPlayer = (state.trickLeader + 3 * newTrick.length) % 4;
    return {
      ...state,
      hands: newHands,
      currentTrick: newTrick,
      selectedCards: [],
      message: `${state.players[nextPlayer].name}'s turn.`,
    };
  }

  // Trick complete — determine winner
  const winner = determineTrickWinner(newTrick, state.trumpSuit, state.trumpRank);
  const trickCards = newTrick.flatMap(p => p.cards);
  const points = countPoints(trickCards);
  const isLastTrick = newHands.every(h => h.length === 0);

  // Points go to winner's team
  const winnerTeam = state.players[winner].team;
  let nonDeclarerPoints = state.nonDeclarerPoints;
  let declarerPoints = state.declarerPoints;
  if (winnerTeam !== state.declarerTeam) {
    nonDeclarerPoints += points;
  } else {
    declarerPoints += points;
  }

  // Bottom scoring on last trick
  let bottomScore = 0;
  if (isLastTrick && winnerTeam !== state.declarerTeam) {
    bottomScore = calculateBottomScore(state.bottom, trickCards.length);
    nonDeclarerPoints += bottomScore;
  }

  return {
    ...state,
    phase: isLastTrick ? PHASES.ROUND_END : PHASES.TRICK_END,
    hands: newHands,
    currentTrick: newTrick,
    nonDeclarerPoints,
    declarerPoints,
    trickPoints: [...state.trickPoints, { winner, points, bottomScore }],
    tricksPlayed: state.tricksPlayed + 1,
    lastTrickWinner: winner,
    lastTrickCardCount: trickCards.length,
    selectedCards: [],
    message: isLastTrick
      ? `Last trick won by ${state.players[winner].name}! ${points > 0 ? `${points} points.` : ''} ${bottomScore > 0 ? `Bottom score: ${bottomScore}!` : ''} Round over!`
      : `${state.players[winner].name} wins the trick! ${points > 0 ? `${points} points captured.` : 'No points.'} `,
  };
}

function nextTrick(state) {
  if (state.phase !== PHASES.TRICK_END) return state;

  return {
    ...state,
    phase: PHASES.PLAYING,
    currentTrick: [],
    trickLeader: state.lastTrickWinner,
    selectedCards: [],
    message: `${state.players[state.lastTrickWinner].name} leads the next trick.`,
  };
}

/**
 * AI auto-play: computed entirely inside the reducer using fresh state.
 * Determines the current expected player, picks appropriate cards, and plays them.
 */
function aiPlay(state) {
  if (state.phase !== PHASES.PLAYING) return state;

  // Compute expected player from fresh state (CCW order)
  const player = state.currentTrick.length === 0
    ? state.trickLeader
    : (state.trickLeader + 3 * state.currentTrick.length) % 4;

  // Only AI players (1, 2, 3)
  if (player <= 0) return state;

  const hand = state.hands[player];
  if (hand.length === 0) return state;

  const leadPlay = state.currentTrick.length > 0 ? state.currentTrick[0].cards : null;
  const count = leadPlay ? leadPlay.length : 1;

  let cardsToPlay;

  if (!leadPlay) {
    // Leading: play the last (highest) card
    cardsToPlay = [hand[hand.length - 1]];
  } else {
    const leadSuit = getEffectiveSuit(leadPlay[0], state.trumpSuit, state.trumpRank);
    const suitCards = hand.filter(c => getEffectiveSuit(c, state.trumpSuit, state.trumpRank) === leadSuit);

    if (suitCards.length >= count) {
      cardsToPlay = suitCards.slice(-count);
    } else if (suitCards.length > 0) {
      const others = hand.filter(c => getEffectiveSuit(c, state.trumpSuit, state.trumpRank) !== leadSuit);
      cardsToPlay = [...suitCards, ...others.slice(-(count - suitCards.length))];
    } else {
      cardsToPlay = hand.slice(-count);
    }
  }

  // Directly execute the play (bypass SELECT_CARD + PLAY_CARDS)
  const newHand = removeCards(hand, cardsToPlay);
  const newHands = state.hands.map((h, i) => i === player ? newHand : h);
  const newTrick = [...state.currentTrick, { player, cards: cardsToPlay }];

  if (newTrick.length < 4) {
    const nextPlayer = (state.trickLeader + 3 * newTrick.length) % 4;
    return {
      ...state,
      hands: newHands,
      currentTrick: newTrick,
      selectedCards: [],
      message: `${state.players[nextPlayer].name}'s turn.`,
    };
  }

  // Trick complete — determine winner
  const winner = determineTrickWinner(newTrick, state.trumpSuit, state.trumpRank);
  const trickCards = newTrick.flatMap(p => p.cards);
  const points = countPoints(trickCards);
  const isLastTrick = newHands.every(h => h.length === 0);

  const winnerTeam = state.players[winner].team;
  let nonDeclarerPoints = state.nonDeclarerPoints;
  let declarerPoints = state.declarerPoints;
  if (winnerTeam !== state.declarerTeam) {
    nonDeclarerPoints += points;
  } else {
    declarerPoints += points;
  }

  let bottomScore = 0;
  if (isLastTrick && winnerTeam !== state.declarerTeam) {
    bottomScore = calculateBottomScore(state.bottom, trickCards.length);
    nonDeclarerPoints += bottomScore;
  }

  return {
    ...state,
    phase: isLastTrick ? PHASES.ROUND_END : PHASES.TRICK_END,
    hands: newHands,
    currentTrick: newTrick,
    nonDeclarerPoints,
    declarerPoints,
    trickPoints: [...state.trickPoints, { winner, points, bottomScore }],
    tricksPlayed: state.tricksPlayed + 1,
    lastTrickWinner: winner,
    lastTrickCardCount: trickCards.length,
    selectedCards: [],
    message: isLastTrick
      ? `Last trick won by ${state.players[winner].name}! ${points > 0 ? `${points} points.` : ''} ${bottomScore > 0 ? `Bottom score: ${bottomScore}!` : ''} Round over!`
      : `${state.players[winner].name} wins the trick! ${points > 0 ? `${points} points captured.` : 'No points.'} `,
  };
}

function endRound(state) {
  if (state.phase !== PHASES.ROUND_END) return state;

  const result = calculateLevelChange(state.nonDeclarerPoints, state.deckCount);
  const newPlayers = state.players.map(p => {
    if (result.declarerWins && p.team === state.declarerTeam) {
      return { ...p, level: advanceLevel(p.level, result.levelChange) };
    }
    if (!result.declarerWins && p.team !== state.declarerTeam) {
      return { ...p, level: advanceLevel(p.level, result.levelChange) };
    }
    return p;
  });

  // Check if anyone passed Ace (level > 14)
  const gameOver = newPlayers.some(p => p.level > 14);

  return {
    ...state,
    phase: gameOver ? PHASES.GAME_OVER : PHASES.SETUP,
    players: newPlayers,
    roundNumber: state.roundNumber + 1,
    declarer: getNextDeclarer(state, result),
    message: result.declarerWins
      ? `Declarer team wins! Advanced ${result.levelChange} level(s). Non-declarer scored ${state.nonDeclarerPoints} points.`
      : `Non-declarer team wins! Advanced ${result.levelChange} level(s). They scored ${state.nonDeclarerPoints} points.`,
  };
}

function nextRound(state) {
  // Reset for next round but keep player levels, then auto-start dealing
  const fresh = createInitialState();
  const resetState = {
    ...fresh,
    players: state.players,
    roundNumber: state.roundNumber,
    declarer: state.declarer,
    declarerTeam: state.players[state.declarer].team,
    deckCount: state.deckCount,
    config: getDeckConfig(state.deckCount),
  };
  // Immediately start the game (transition to DEALING)
  return startGame(resetState);
}

// ── Helpers ────────────────────────────────────────────────

function getLevelRank(level) {
  if (level < 2 || level > 14) return 'A';
  return RANKS[level - 2]; // RANKS[0]='2', RANKS[12]='A'
}

function advanceLevel(currentLevel, change) {
  return Math.min(15, currentLevel + change); // 15 = past Ace = win
}

function getNextDeclarer(state, result) {
  if (result.declarerWins) {
    // Same team keeps declaring, rotate within team
    return (state.declarer + 2) % 4;
  }
  // Other team gets to declare
  return (state.declarer + 1) % 4;
}

// ── Exports for Testing ────────────────────────────────────
export { getLevelRank, aiSelectBottomDiscard };

/**
 * AI strategy for selecting cards to discard to the bottom.
 * Priority: discard non-trump, non-point, low-rank cards first.
 * Tries to void off-suits (discard entire short suits).
 */
function aiSelectBottomDiscard(hand, count, trumpSuit, trumpRank) {
  // Separate trump from non-trump
  const nonTrump = hand.filter(c => !isTrump(c, trumpSuit, trumpRank));
  const trump = hand.filter(c => isTrump(c, trumpSuit, trumpRank));

  // Sort non-trump: prefer discarding no-point low-rank cards first
  const scored = nonTrump.map(c => ({
    card: c,
    score: (c.points || 0) * 100 + cardStrength(c, trumpSuit, trumpRank),
  }));
  scored.sort((a, b) => a.score - b.score); // lowest score first = best discard candidates

  const discards = [];
  for (const { card } of scored) {
    if (discards.length >= count) break;
    discards.push(card);
  }

  // If still need more cards (very rare: hand is mostly trump), discard lowest trump
  if (discards.length < count) {
    const trumpSorted = [...trump].sort(
      (a, b) => cardStrength(a, trumpSuit, trumpRank) - cardStrength(b, trumpSuit, trumpRank)
    );
    for (const c of trumpSorted) {
      if (discards.length >= count) break;
      discards.push(c);
    }
  }

  return discards.slice(0, count);
}

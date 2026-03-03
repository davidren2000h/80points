# Product Requirements Document (PRD)

**Product Name:** 80 Points (Shengji / Tractor) – Multi‑Deck Edition  
**Version:** v1  
**Platform:** Web  
**Language:** English

---

## 1. Objective

Build a web‑based implementation of 80 Points (Shengji / Tractor) that natively supports multi‑deck variants (2, 3, or 4 decks).

The game must preserve:

- Traditional 80‑point core mechanics
- Strong rule correctness
- Configurable regional / house‑rule differences

The number of decks is a first‑class game parameter, not a forked ruleset.

---

## 2. Game Setup & Configuration

### 2.1 Player Count

- Fixed: 4 players
- Fixed partnerships (opposite seats)

### 2.2 Deck Count (Configurable)

At game creation, host must select:

- **2 decks** (classic, balanced)
- **3 decks** (chaotic, high‑power)
- **4 decks** (extreme, unbalanced but fun)

All downstream rules derive from this value.

---

## 3. Card Distribution

| Deck Count | Cards per Player | Bottom Cards |
|------------|-----------------|-------------|
| 2 decks    | 25              | 8           |
| 3 decks    | 37              | 12          |
| 4 decks    | 49              | 16          |

- Bottom cards are taken by the declarer after trump is finalized.
- Declarer must discard the same number back as the bottom.

---

## 4. Trump Declaration & Counter‑Trump (反主)

### 4.1 Trump Declaration

- Players may declare trump during dealing.
- If no one declares, trump suit is determined by flipping the bottom card.

### 4.2 Counter‑Trump Rules (Key Multi‑Deck Difference)

Counter‑trump strength scales with deck count:

| Decks | Counter Rule              |
|-------|---------------------------|
| 2     | Pair beats single (2 > 1) |
| 3     | 2 beats 1, 3 beats 2      |
| 4     | 2 > 1, 3 > 2, 4 > 3       |

**Examples:**

- In 3‑deck mode, three identical trump‑rank cards can counter two.
- In 4‑deck mode, four cards are required to counter three.

This hierarchy must be enforced strictly by the rules engine.

---

## 5. No‑Trump (无主) Conditions

No‑trump declaration requirements scale with deck count:

| Decks | Requirement                              |
|-------|------------------------------------------|
| 2     | Pair of Big Jokers                       |
| 3     | Three Big Jokers or three Small Jokers   |
| 4     | Four Big Jokers or four Small Jokers     |

- Mixed jokers are not allowed
- No‑trump overrides suit‑based trump logic

---

## 6. Scoring & Win Thresholds

### 6.1 Total Points

- Each deck contains 100 points
- Only 5, 10, K score

### 6.2 Win Threshold

| Decks | Win Threshold | Level Increment     |
|-------|---------------|---------------------|
| 2     | 80 points     | +1 per 20 pts       |
| 3     | 120 points    | +1 per 30 pts       |
| 4     | 160 points    | +1 per 40 pts       |

### 6.3 Special Case: Clean Sweep (剃光头)

- If the non‑declarer side scores 0 points
- Declarer side advances 3 levels immediately
- Applies to all deck counts

---

## 7. Trick Play Rules

### 7.1 Legal Plays

- Single
- Pair
- Tractor (consecutive pairs)
- Throwing (甩牌)

### 7.2 Throwing (甩牌)

- Allowed for both trump and non‑trump suits
- Must represent the maximum possible structure for that suit

**Failure Handling:**

If throwing fails (i.e., another player can beat part of it):

- Player is forced to play the smallest losing component
- No re‑throw allowed

---

## 8. Bottom Scoring (扣底)

Bottom scoring multiplier depends on number of cards used in final trick:

| Cards Used | Multiplier |
|------------|------------|
| 1 card     | ×1         |
| 2 cards    | ×2         |
| 3 cards    | ×3         |
| N cards    | ×N         |

- Applies regardless of deck count
- Multiplier applies to total bottom score

---

## 9. Core Gameplay Loop

1. Select deck count (2 / 3 / 4)
2. Deal cards
3. Trump declaration / counter‑trump
4. Declarer takes and discards bottom
5. Trick‑taking phase
6. Score accumulation
7. Bottom resolution
8. Level adjustment
9. Next round

---

## 10. UX / Rules Engine Requirements

### 10.1 Rules Engine

- Deck‑count‑driven parameters (no hard‑coding)
- Deterministic validation:
  - Counter‑trump legality
  - No‑trump qualification
  - Forced follow rules
  - Throwing validation

### 10.2 UI

- Clearly show:
  - Deck count
  - Required counter sizes
  - No‑trump thresholds
  - Bottom size & multiplier
- Illegal actions must be disabled, not warned

---

## 11. Out of Scope (v1)

- AI players
- Ranked matchmaking
- Spectator mode
- Custom scoring formulas beyond deck scaling

---

## 12. Design Philosophy (Important)

> Multi‑deck is not a balance problem — it is a power fantasy mode.

- **2‑deck** = competitive
- **3‑deck** = explosive
- **4‑deck** = chaos

The system must support all, not normalize them.

# PRD Addendum: Multi‑Deck Extended Card Structures (3 / 4 Decks)

## 1. New Card Structures Introduced by Multi‑Deck Modes

Multi‑deck modes introduce higher‑multiplicity same‑rank structures, which must be treated as **first‑class legal plays**, not decomposed into pairs.

| Deck Count | Max Same‑Suit Same‑Rank | New Base Structure |
|------------|------------------------|--------------------|
| 2 decks    | 2 cards                | Pair               |
| 3 decks    | 3 cards                | Triplet (三张)      |
| 4 decks    | 4 cards                | Quad (四张)         |

These structures are **suit‑bound** (same suit, same rank) and apply to both trump and non‑trump suits.

---

## 2. Legal Play Structures by Deck Count

### 2‑Deck (Baseline – unchanged)

- Single
- Pair
- Tractor (consecutive pairs)

### 3‑Deck Mode (新增)

- Single
- Pair
- Triplet (三张，同花色同点数)
- Tractor‑Triplet (三张拖拉机)

**Example (legal):**
- ♠333 ♠444
- Trump 666 777

### 4‑Deck Mode (新增)

- Single
- Pair
- Triplet
- Quad (四张，同花色同点数)
- Tractor‑Quad (四张拖拉机)

**Example (legal):**
- ♥3333 ♥4444
- Trump 9999 TTTT

> **Important:**
> - Pair / Triplet / Quad are **distinct atomic structures**.
> - A Triplet is **not** treated as "pair + single", and a Quad is **not** "two pairs".

---

## 3. Follow‑Suit & Follow‑Structure Rules (关键)

### Core Principle

Players must follow **structure first**, then **count**, then **rank**.

### 3.1 When Lead Plays a Triplet (3‑Deck)

**Lead example:**
♣777

**Follow rules (in order):**

1. If player has a same‑suit triplet → must follow triplet
2. Else if player has same‑suit pair → must follow pair
3. Else → may follow single(s)
4. If no same‑suit cards → normal trump / slough rules apply

✅ **Legal responses:**
- ♣888
- ♣99
- ♣K

❌ **Illegal:**
- Playing 3 singles while holding a pair
- Using trump while holding any ♣ cards

### 3.2 When Lead Plays a Quad (4‑Deck)

**Lead example:**
♦4444

**Follow rules (in order):**

1. If player has same‑suit quad → must follow quad
2. Else if player has same‑suit triplet → must follow triplet
3. Else if player has same‑suit pair → must follow pair
4. Else → may follow single(s)

✅ **Legal:**
- ♦5555
- ♦666
- ♦JJ
- ♦A

❌ **Illegal:**
- Splitting structure intentionally
- Playing fewer cards when a higher structure is available

---

## 4. Multi‑Deck Tractor Rules

### 4.1 Tractor‑Triplet (3 副牌)

**Definition:**
- Two or more consecutive ranks
- Each rank represented by a triplet
- Same suit OR all trump

**Example:**
- ♠333 ♠444
- Trump 999 TTT

**Follow requirements:**
- If player has same‑suit Tractor‑Triplet → must follow
- Else downgrade structurally:
  - Triplet → Pair → Single

### 4.2 Tractor‑Quad (4 副牌)

**Definition:**
- Two or more consecutive ranks
- Each rank represented by a quad

**Example:**
- ♥3333 ♥4444

**Follow downgrade path:**
Quad → Triplet → Pair → Single

---

## 5. Throwing (甩牌) in Multi‑Deck Modes

Throwing is allowed for all legal structures, including:

- Triplets
- Quads
- Tractor‑Triplet
- Tractor‑Quad
- Mixed throwing (e.g., Quad + Pair)

### Throw Failure Handling (统一规则)

If any component is beatable:
- Throw fails
- Player must play the **smallest losing structural component**
- No re‑throw

---

## 6. Trump Interaction with Multi‑Deck Structures

- Trump does **not** change structure requirements
- Trump only affects ranking, not follow legality
- A player **cannot** trump if they hold any card of the led suit, regardless of structure size

---

## 7. Rules Engine Requirements (新增硬要求)

The rules engine must:

1. Track max multiplicity per suit per rank by deck count
2. Validate structure availability before allowing a move
3. Enforce structure downgrade path
4. Treat Triplet / Quad as atomic units
5. Support tractor validation for:
   - Pair‑based
   - Triplet‑based
   - Quad‑based sequences

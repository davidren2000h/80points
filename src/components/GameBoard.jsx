import React, { useEffect, useRef } from 'react';
import Hand from './Hand.jsx';
import TrickArea from './TrickArea.jsx';
import GameInfo from './GameInfo.jsx';
import TrumpDeclaration from './TrumpDeclaration.jsx';
import BottomPanel from './BottomPanel.jsx';
import ScoreBoard from './ScoreBoard.jsx';
import Card from './Card.jsx';
import { PHASES, aiSelectBottomDiscard } from '../game/gameEngine.js';
import { sortHand } from '../game/cardUtils.js';

/**
 * Main game board layout.
 * AI players auto-play, dealing animates, tricks auto-advance.
 */
export default function GameBoard({ state, onAction }) {
  const { phase, hands, players, currentTrick, trickLeader, selectedCards, message, declarer } = state;
  const currentPlayer = getCurrentPlayer(state);

  // Format name as "Team X: name"
  const pLabel = (idx) => `Team ${players[idx].team + 1}: ${players[idx].name}`;

  // Separate refs for each phase timer to prevent cross-phase interference
  const dealTimerRef = useRef(null);
  const aiPlayTimerRef = useRef(null);
  const declareTimerRef = useRef(null);
  const bottomTimerRef = useRef(null);
  const trickEndTimerRef = useRef(null);

  // ── DEALING PHASE: auto-deal cards one by one ────────────
  useEffect(() => {
    if (phase !== PHASES.DEALING) return;
    if (state.dealingPaused) return; // Paused — waiting for player response
    dealTimerRef.current = setTimeout(() => {
      onAction({ type: 'DEAL_NEXT' });
    }, 30); // Fast dealing (30ms per card)
    return () => clearTimeout(dealTimerRef.current);
  }, [phase, state.dealCardIndex, state.dealingPaused]);

  // ── PLAYING PHASE: auto-play for AI players ──────────────
  useEffect(() => {
    if (phase !== PHASES.PLAYING) return;
    if (currentPlayer <= 0) return; // Player 0 or invalid

    aiPlayTimerRef.current = setTimeout(() => {
      // AI_PLAY computes everything inside the reducer with fresh state
      onAction({ type: 'AI_PLAY' });
    }, 600); // 600ms delay so human can follow

    return () => clearTimeout(aiPlayTimerRef.current);
  }, [phase, currentPlayer, currentTrick.length]);

  // ── DECLARING PHASE: player must click "Finalize Trump & Continue" ─
  // No auto-timer — the TrumpDeclaration panel has a button for this.

  // ── BOTTOM PHASE: AI auto-discard when declarer is not player 0 ─
  useEffect(() => {
    if (phase !== PHASES.BOTTOM) return;
    if (declarer === 0) return; // Human player handles it manually
    bottomTimerRef.current = setTimeout(() => {
      const hand = state.hands[declarer];
      const discards = aiSelectBottomDiscard(
        hand, state.config.bottomCards, state.trumpSuit, state.trumpRank
      );
      onAction({ type: 'DISCARD_BOTTOM', cards: discards });
    }, 800); // Short delay so human can see what's happening
    return () => clearTimeout(bottomTimerRef.current);
  }, [phase, declarer]);

  // ── TRICK_END: auto-advance to next trick ────────────────
  useEffect(() => {
    if (phase !== PHASES.TRICK_END) return;
    trickEndTimerRef.current = setTimeout(() => {
      onAction({ type: 'NEXT_TRICK' });
    }, 1200); // 1.2s to see the completed trick
    return () => clearTimeout(trickEndTimerRef.current);
  }, [phase, state.tricksPlayed]);

  // ── Handlers ─────────────────────────────────────────────
  const handleCardClick = (card) => {
    onAction({ type: 'SELECT_CARD', cardId: card.id });
  };

  const handlePlayCards = () => {
    onAction({ type: 'PLAY_CARDS', player: 0 });
  };

  const handleDeclare = (player, cards) => {
    onAction({ type: 'DECLARE_TRUMP', player, cards });
  };

  const handleFinalizeTrump = () => {
    onAction({ type: 'FINALIZE_TRUMP' });
  };

  const handleDiscardBottom = (cards) => {
    onAction({ type: 'DISCARD_BOTTOM', cards });
  };

  const handleEndRound = () => {
    onAction({ type: 'END_ROUND' });
  };

  const handleNextRound = () => {
    onAction({ type: 'NEXT_ROUND' });
  };

  // ── Compute dealing progress ─────────────────────────────
  const dealProgress = phase === PHASES.DEALING
    ? Math.round(((state.config.cardsPerPlayer * 4 - (state.dealQueue?.length || 0)) / (state.config.cardsPerPlayer * 4)) * 100)
    : 100;

  return (
    <div style={boardContainerStyle}>
      {/* Left: Game Info */}
      <GameInfo state={state} />

      {/* Center: Game Area */}
      <div style={centerStyle}>
        {/* Message Bar */}
        <div style={messageBannerStyle}>
          {message}
        </div>



        {/* ── DEALING PHASE ──────────────────────────── */}
        {phase === PHASES.DEALING && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 20 }}>
            {/* Progress Bar */}
            <div style={progressBarContainerStyle}>
              <div style={{ ...progressBarFillStyle, width: `${dealProgress}%` }} />
            </div>
            <div style={{ color: '#ecf0f1', fontSize: 14 }}>
              {state.dealingPaused ? 'Dealing paused — Your decision needed!' : `Dealing cards... ${dealProgress}%`}
            </div>

            {/* Show player card counts during dealing */}
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              {players.map((p, i) => (
                <div key={i} style={dealingPlayerStyle}>
                  <div style={{ fontWeight: 'bold', color: '#ecf0f1', fontSize: 13 }}>{pLabel(i)}</div>
                  <div style={{ fontSize: 24, color: '#f39c12', fontWeight: 'bold' }}>{hands[i].length}</div>
                  <div style={{ fontSize: 11, color: '#95a5a6' }}>cards</div>
                </div>
              ))}
            </div>

            {/* Show declaration during dealing */}
            {state.declaration && !state.dealingPaused && (
              <div style={dealingDeclStyle}>
                🎺 <strong>{players[state.declaration.player]?.name}</strong> declared{' '}
                {state.declaration.isNoTrump ? 'No-Trump' : `${state.declaration.suit} as trump`}!
              </div>
            )}

            {/* ── DECLARATION PROMPT MODAL ─────────────── */}
            {state.dealingPaused && state.dealingPrompt && (
              <div style={declareModalStyle}>
                <div style={declareModalInnerStyle}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50', fontSize: 16 }}>
                    🎺 Trump Declaration
                  </h3>

                  {state.declaration && (
                    <div style={existingDeclBannerStyle}>
                      Current trump: <strong>{players[state.declaration.player]?.name}</strong> declared{' '}
                      {state.declaration.isNoTrump ? 'No-Trump' : `${state.declaration.suit}`}{' '}
                      with {state.declaration.count} card(s).
                      You can counter with more cards!
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 12 }}>
                    You have trump-rank cards. Would you like to declare?
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {state.dealingPrompt.options.map((opt, i) => (
                      <button
                        key={i}
                        style={declareOptionBtnStyle}
                        onClick={() => onAction({ type: 'DEALING_DECLARE', suit: opt.suit, count: opt.count })}
                      >
                        <span style={{ fontSize: 16 }}>
                          {opt.isNoTrump ? '🚫' : suitEmoji(opt.suit)}
                        </span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    style={skipBtnStyle}
                    onClick={() => onAction({ type: 'DEALING_SKIP' })}
                  >
                    Skip — Don't declare now
                  </button>
                </div>
              </div>
            )}

            {/* Show your cards as they arrive (player 0) */}
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#95a5a6', fontSize: 11, textAlign: 'center', marginBottom: 4 }}>Your cards</div>
              <Hand
                cards={sortHand(hands[0], state.trumpSuit, state.trumpRank)}
                disabled
                deckCount={state.deckCount}
              />
            </div>
          </div>
        )}

        {/* ── DECLARING PHASE ────────────────────────── */}
        {phase === PHASES.DECLARING && (
          <TrumpDeclaration
            state={state}
            onDeclare={handleDeclare}
            onFinalize={handleFinalizeTrump}
          />
        )}

        {/* ── BOTTOM DISCARD PHASE ───────────────────── */}
        {phase === PHASES.BOTTOM && declarer === 0 && (
          <BottomPanel
            state={state}
            selectedCards={selectedCards}
            onCardClick={handleCardClick}
            onDiscard={handleDiscardBottom}
          />
        )}
        {phase === PHASES.BOTTOM && declarer !== 0 && (
          <div style={{
            textAlign: 'center', padding: 30, color: '#ecf0f1',
            background: 'rgba(0,0,0,0.2)', borderRadius: 12, margin: '8px 0',
          }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
              {players[declarer]?.name} is setting the bottom cards...
            </div>
            <div style={{ fontSize: 13, color: '#95a5a6' }}>
              The declarer is choosing {state.config.bottomCards} cards to discard.
            </div>
          </div>
        )}

        {/* ── PLAYING / TRICK_END PHASE ──────────────── */}
        {(phase === PHASES.PLAYING || phase === PHASES.TRICK_END) && (() => {
          // Determine which player shows the point badge for each team
          const nonDeclPts = state.nonDeclarerPoints;
          const declPts = state.declarerPoints;
          const declarerTeam = state.declarerTeam;
          const myTeam = state.players[0].team; // South's team
          const isMyTeamDeclarer = myTeam === declarerTeam;
          const myTeamPts = isMyTeamDeclarer ? declPts : nonDeclPts;
          const oppTeamPts = isMyTeamDeclarer ? nonDeclPts : declPts;

          const pointBadge = (playerIdx) => {
            const playerTeam = state.players[playerIdx].team;
            if (playerIdx === 0) {
              // South always shows our team's points
              return (
                <span style={safeBadgeStyle}>
                  {isMyTeamDeclarer ? '🛡️' : '💰'} Your team: {myTeamPts} pts
                </span>
              );
            }
            // Show opponent badge on one opponent only (West)
            if (playerTeam !== myTeam && playerIdx === 1) {
              return (
                <span style={earnedBadgeStyle}>
                  {isMyTeamDeclarer ? '💰' : '🛡️'} Opponents: {oppTeamPts} pts
                </span>
              );
            }
            return null;
          };

          return (
          <>
            {/* North hand (opponent) */}
            <div style={topPlayerStyle}>
              <div style={playerLabelStyle(2 === currentPlayer)}>
                {pLabel(2)}
                <span style={cardCountStyle}> ({hands[2].length})</span>
              </div>
              {pointBadge(2)}
              <Hand cards={hands[2].slice(0, Math.min(hands[2].length, 10))} faceDown disabled label="" />
              {hands[2].length > 10 && (
                <div style={{ fontSize: 10, color: '#95a5a6', textAlign: 'center' }}>
                  +{hands[2].length - 10} more
                </div>
              )}
            </div>

            {/* Middle row: West — Trick — East */}
            <div style={middleRowStyle}>
              <div style={sidePlayerStyle}>
                <div style={playerLabelStyle(1 === currentPlayer)}>
                  {pLabel(1)}
                  <span style={cardCountStyle}> ({hands[1].length})</span>
                </div>
                {pointBadge(1)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', zIndex: 1 }}>
                  {hands[1].slice(0, Math.min(hands[1].length, 8)).map((c, i) => (
                    <div key={c.id} style={{ marginTop: i === 0 ? 0 : -60 }}>
                      <Card card={c} faceDown small disabled />
                    </div>
                  ))}
                  {hands[1].length > 8 && (
                    <div style={{ fontSize: 10, color: '#95a5a6', textAlign: 'center' }}>
                      +{hands[1].length - 8}
                    </div>
                  )}
                </div>
              </div>

              <TrickArea
                trick={currentTrick}
                players={players}
                trickLeader={trickLeader}
              />

              <div style={sidePlayerStyle}>
                <div style={playerLabelStyle(3 === currentPlayer)}>
                  {pLabel(3)}
                  <span style={cardCountStyle}> ({hands[3].length})</span>
                </div>
                {pointBadge(3)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', zIndex: 1 }}>
                  {hands[3].slice(0, Math.min(hands[3].length, 8)).map((c, i) => (
                    <div key={c.id} style={{ marginTop: i === 0 ? 0 : -60 }}>
                      <Card card={c} faceDown small disabled />
                    </div>
                  ))}
                  {hands[3].length > 8 && (
                    <div style={{ fontSize: 10, color: '#95a5a6', textAlign: 'center' }}>
                      +{hands[3].length - 8}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* South hand (player 0 — always visible) */}
            <div style={bottomPlayerStyle}>
              <div style={playerLabelStyle(0 === currentPlayer)}>
                {pLabel(0)}
                <span style={cardCountStyle}> ({hands[0].length})</span>
                {pointBadge(0)}
                {0 === currentPlayer && phase === PHASES.PLAYING && (
                  <span style={turnIndicatorStyle}> ← YOUR TURN</span>
                )}
              </div>
              <Hand
                cards={sortHand(hands[0], state.trumpSuit, state.trumpRank)}
                selectedCards={selectedCards}
                onCardClick={handleCardClick}
                disabled={currentPlayer !== 0 || phase !== PHASES.PLAYING}
                deckCount={state.deckCount}
              />
            </div>

            {/* Action Buttons */}
            <div style={actionBarStyle}>
              {phase === PHASES.PLAYING && currentPlayer === 0 && selectedCards.length > 0 && (
                <button style={playBtnStyle} onClick={handlePlayCards}>
                  Play Selected ({selectedCards.length})
                </button>
              )}

              {phase === PHASES.PLAYING && currentPlayer !== 0 && (
                <div style={aiThinkingStyle}>
                  {players[currentPlayer]?.name} is thinking...
                </div>
              )}

              {phase === PHASES.TRICK_END && (
                <div style={aiThinkingStyle}>
                  {players[state.lastTrickWinner]?.name} won the trick — next trick starting...
                </div>
              )}
            </div>
          </>
          );
        })()}

        {/* ── ROUND END ──────────────────────────────── */}
        {phase === PHASES.ROUND_END && (
          <ScoreBoard state={state} onEndRound={handleEndRound} />
        )}

        {/* Ready for next round — two options */}
        {phase === PHASES.SETUP && state.roundNumber > 1 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <h2 style={{ color: '#ecf0f1' }}>Ready for Round {state.roundNumber}</h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
              <button style={playBtnStyle} onClick={handleNextRound}>
                ▶ Continue Next Round
              </button>
              <button style={quitBtnStyle} onClick={() => window.location.reload()}>
                ✕ Quit
              </button>
            </div>
          </div>
        )}

        {/* ── GAME OVER ──────────────────────────────── */}
        {phase === PHASES.GAME_OVER && (
          <div style={gameOverStyle}>
            <h1>🎉 Game Over!</h1>
            <div style={{ fontSize: 18 }}>
              {state.players.filter(p => p.level > 14).map((p, _, arr) => (
                <div key={p.name}><strong>Team {p.team + 1}: {p.name}</strong> passed Ace!</div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 14, color: '#7f8c8d' }}>
              Final Levels: {state.players.map(p => `Team ${p.team + 1}: ${p.name}: ${p.level}`).join(' | ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

function suitEmoji(suit) {
  const map = { spades: '♠️', hearts: '♥️', diamonds: '♦️', clubs: '♣️' };
  return map[suit] || suit;
}

/**
 * Get the player whose turn it is.
 * Play order is COUNTER-CLOCKWISE (standard for Shengji/升级):
 *   South(0) → East(3) → North(2) → West(1)
 * Formula: (trickLeader + 3 * step) % 4
 */
function getCurrentPlayer(state) {
  if (state.phase === PHASES.BOTTOM) return state.declarer;
  if (state.phase !== PHASES.PLAYING) return -1;
  if (state.currentTrick.length === 0) return state.trickLeader;
  return (state.trickLeader + 3 * state.currentTrick.length) % 4;
}

// ══════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════

const boardContainerStyle = {
  display: 'flex',
  gap: 16,
  padding: 16,
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0d5016 0%, #1a7a2e 50%, #0d5016 100%)',
};

const centerStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
};

const messageBannerStyle = {
  background: 'rgba(255,255,255,0.95)',
  padding: '10px 20px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 'bold',
  color: '#2c3e50',
  textAlign: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
};



const progressBarContainerStyle = {
  width: '80%',
  maxWidth: 400,
  height: 12,
  background: 'rgba(255,255,255,0.15)',
  borderRadius: 6,
  overflow: 'hidden',
};

const progressBarFillStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #f39c12, #e74c3c)',
  borderRadius: 6,
  transition: 'width 0.05s linear',
};

const dealingPlayerStyle = {
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '12px 20px',
  textAlign: 'center',
  minWidth: 100,
};

const dealingDeclStyle = {
  background: 'rgba(243,156,18,0.2)',
  border: '1px solid #f39c12',
  borderRadius: 8,
  padding: '8px 16px',
  color: '#f39c12',
  fontSize: 14,
  fontWeight: 'bold',
};

const topPlayerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const middleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  minWidth: 520,
  flex: 1,
};

const sidePlayerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  minWidth: 80,
};

const bottomPlayerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '8px 16px',
};

const playerLabelStyle = (isActive) => ({
  fontSize: 12,
  fontWeight: 'bold',
  color: isActive ? '#f39c12' : '#ecf0f1',
  textAlign: 'center',
  padding: '2px 8px',
  borderRadius: 4,
  background: isActive ? 'rgba(243,156,18,0.2)' : 'transparent',
});

const cardCountStyle = {
  fontWeight: 'normal',
  opacity: 0.7,
};

const turnIndicatorStyle = {
  color: '#f39c12',
  fontSize: 11,
  fontWeight: 'bold',
  animation: 'pulse 1s infinite',
};

const actionBarStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  padding: 8,
};

const playBtnStyle = {
  padding: '10px 24px',
  border: 'none',
  borderRadius: 8,
  background: '#e74c3c',
  color: '#fff',
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(231,76,60,0.3)',
};

const quitBtnStyle = {
  padding: '10px 24px',
  border: '2px solid #95a5a6',
  borderRadius: 8,
  background: 'transparent',
  color: '#95a5a6',
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const aiThinkingStyle = {
  padding: '8px 20px',
  borderRadius: 8,
  background: 'rgba(243,156,18,0.15)',
  color: '#f39c12',
  fontSize: 13,
  fontStyle: 'italic',
};

const gameOverStyle = {
  textAlign: 'center',
  padding: 60,
  color: '#ecf0f1',
};

const declareModalStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const declareModalInnerStyle = {
  background: '#fff',
  borderRadius: 14,
  padding: '24px 28px',
  maxWidth: 400,
  width: '90%',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
};

const existingDeclBannerStyle = {
  background: 'rgba(243,156,18,0.12)',
  border: '1px solid #f39c12',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: '#7f6b2e',
  marginBottom: 12,
};

const declareOptionBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  border: '2px solid #27ae60',
  borderRadius: 8,
  background: 'rgba(39,174,96,0.08)',
  color: '#27ae60',
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const skipBtnStyle = {
  marginTop: 12,
  width: '100%',
  padding: '8px 16px',
  border: '1px solid #bdc3c7',
  borderRadius: 8,
  background: 'transparent',
  color: '#7f8c8d',
  fontSize: 13,
  cursor: 'pointer',
};

const safeBadgeStyle = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 10,
  background: '#2980b9',
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  position: 'relative',
  zIndex: 10,
  marginTop: 2,
  marginBottom: 2,
  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
};

const escapedBadgeStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  background: 'rgba(231,76,60,0.25)',
  border: '1px solid rgba(231,76,60,0.6)',
  color: '#e74c3c',
  fontSize: 11,
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  position: 'relative',
  zIndex: 10,
  marginTop: 2,
  marginBottom: 2,
};

const earnedBadgeStyle = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 10,
  background: '#e67e22',
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  position: 'relative',
  zIndex: 10,
  marginTop: 2,
  marginBottom: 2,
  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
};

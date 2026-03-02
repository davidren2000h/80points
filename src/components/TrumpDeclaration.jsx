import React from 'react';
import { SUIT_SYMBOLS } from '../game/cardUtils.js';
import { getNoTrumpRequirement } from '../game/rulesEngine.js';

/**
 * Trump declaration panel.
 * Shows during the DECLARING phase.
 */
export default function TrumpDeclaration({ state, onDeclare, onFinalize }) {
  const { hands, trumpRank, declaration, deckCount, players } = state;
  const currentPlayer = 0; // Player 0 is the local player

  // Find declarable cards in player's hand (trump rank or jokers)
  const hand = hands[currentPlayer] || [];
  const declarableCards = hand.filter(c => c.rank === trumpRank || c.suit === 'joker');

  // Group by suit for declaration options
  const groupedByType = {};
  for (const card of declarableCards) {
    const key = card.suit === 'joker' ? card.rank : card.suit;
    if (!groupedByType[key]) groupedByType[key] = [];
    groupedByType[key].push(card);
  }

  const noTrumpReq = getNoTrumpRequirement(deckCount);

  return (
    <div style={panelStyle}>
      <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>Trump Declaration</h3>

      {declaration && (
        <div style={currentDeclStyle}>
          Current: <strong>{players[declaration.player]?.name}</strong> declared{' '}
          {declaration.isNoTrump ? 'No-Trump' : declaration.suit}{' '}
          with {declaration.count} card(s)
        </div>
      )}

      <div style={{ fontSize: 12, color: '#7f8c8d', marginBottom: 8 }}>
        Trump rank this round: <strong>{trumpRank}</strong> | 
        No-trump requires: {noTrumpReq.description}
      </div>

      {Object.entries(groupedByType).length === 0 ? (
        <div style={{ color: '#95a5a6', fontStyle: 'italic' }}>
          No declarable cards in hand.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(groupedByType).map(([key, cards]) => {
            const isJoker = key === 'big' || key === 'small';
            const label = isJoker
              ? `${key === 'big' ? 'Big' : 'Small'} Joker (×${cards.length})`
              : `${SUIT_SYMBOLS[key] || key} ${trumpRank} (×${cards.length})`;

            return (
              <div key={key} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Array.from({ length: cards.length }, (_, i) => i + 1).map(count => (
                  <button
                    key={count}
                    style={btnStyle}
                    onClick={() => onDeclare(currentPlayer, cards.slice(0, count))}
                  >
                    {label.split('(')[0]} ×{count}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <button style={finalizeBtnStyle} onClick={onFinalize}>
        Finalize Trump &amp; Continue →
      </button>
    </div>
  );
}

const panelStyle = {
  background: '#fff8e1',
  border: '1px solid #f39c12',
  borderRadius: 12,
  padding: 16,
  margin: '8px 0',
};

const currentDeclStyle = {
  background: '#fef9e7',
  padding: 8,
  borderRadius: 6,
  fontSize: 13,
  marginBottom: 8,
  border: '1px solid #f9e79f',
};

const btnStyle = {
  padding: '6px 12px',
  border: '1px solid #f39c12',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 'bold',
  color: '#e67e22',
  transition: 'background 0.15s',
};

const finalizeBtnStyle = {
  marginTop: 12,
  padding: '8px 20px',
  border: 'none',
  borderRadius: 8,
  background: '#27ae60',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 'bold',
  width: '100%',
};

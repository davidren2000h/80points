import React from 'react';
import Hand from './Hand.jsx';

/**
 * Bottom cards management panel.
 * Declarer selects cards to discard back to the bottom.
 */
export default function BottomPanel({ state, selectedCards, onCardClick, onDiscard }) {
  const { hands, declarer, config, players } = state;
  const hand = hands[declarer] || [];
  const requiredCount = config.bottomCards;
  const selectedCount = selectedCards.length;

  return (
    <div style={panelStyle}>
      <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
        Set Bottom Cards
      </h3>
      <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 8 }}>
        {players[declarer]?.name}: Select <strong>{requiredCount}</strong> cards to discard to the bottom.
        ({selectedCount}/{requiredCount} selected)
      </div>

      <Hand
        cards={hand}
        selectedCards={selectedCards}
        onCardClick={onCardClick}
        deckCount={state.deckCount}
      />

      <button
        style={{
          ...discardBtnStyle,
          opacity: selectedCount === requiredCount ? 1 : 0.4,
          cursor: selectedCount === requiredCount ? 'pointer' : 'default',
        }}
        disabled={selectedCount !== requiredCount}
        onClick={() => {
          const cards = hand.filter(c => selectedCards.includes(c.id));
          onDiscard(cards);
        }}
      >
        Discard {selectedCount}/{requiredCount} to Bottom
      </button>
    </div>
  );
}

const panelStyle = {
  background: '#fff',
  border: '1px solid #3498db',
  borderRadius: 12,
  padding: 16,
  margin: '8px 0',
};

const discardBtnStyle = {
  marginTop: 8,
  padding: '10px 24px',
  border: 'none',
  borderRadius: 8,
  background: '#3498db',
  color: '#fff',
  fontSize: 14,
  fontWeight: 'bold',
  width: '100%',
};

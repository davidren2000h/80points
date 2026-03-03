import React from 'react';
import Card from './Card.jsx';

/**
 * Displays a player's hand of cards.
 * When deckCount >= 3 (many cards), splits into two rows with smaller cards.
 */
export default function Hand({ cards, selectedCards, onCardClick, disabled, label, faceDown, deckCount }) {
  // Use compact mode for 3+ decks (37+ cards) or whenever hand exceeds 28 cards
  const compact = (deckCount && deckCount >= 3) || cards.length > 28;
  const overlap = compact ? -12 : -20;

  if (compact && cards.length > 0) {
    // Split cards into two rows: first row gets the first half
    const mid = Math.ceil(cards.length / 2);
    const row1 = cards.slice(0, mid);
    const row2 = cards.slice(mid);

    const renderRow = (rowCards, rowOffset) =>
      rowCards.map((card, i) => (
        <div key={card.id} style={{ marginLeft: i > 0 ? overlap : 0 }}>
          <Card
            card={card}
            selected={selectedCards?.includes(card.id)}
            onClick={onCardClick}
            disabled={disabled}
            faceDown={faceDown}
            small
          />
        </div>
      ));

    return (
      <div style={containerStyle}>
        {label && <div style={labelStyle}>{label}</div>}
        <div style={compactRowStyle}>{renderRow(row1, 0)}</div>
        {row2.length > 0 && <div style={compactRowStyle}>{renderRow(row2, mid)}</div>}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {label && <div style={labelStyle}>{label}</div>}
      <div style={cardsRowStyle}>
        {cards.map((card, i) => (
          <div key={card.id} style={{ marginLeft: i > 0 ? overlap : 0 }}>
            <Card
              card={card}
              selected={selectedCards?.includes(card.id)}
              onClick={onCardClick}
              disabled={disabled}
              faceDown={faceDown}
            />
          </div>
        ))}
        {cards.length === 0 && (
          <div style={emptyStyle}>No cards</div>
        )}
      </div>
    </div>
  );
}

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#7f8c8d',
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const cardsRowStyle = {
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'center',
  padding: '8px 0',
  minHeight: 110,
};

const compactRowStyle = {
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'center',
  padding: '2px 0',
  minHeight: 76,
};

const emptyStyle = {
  color: '#bdc3c7',
  fontStyle: 'italic',
  padding: 20,
};

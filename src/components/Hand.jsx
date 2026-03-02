import React from 'react';
import Card from './Card.jsx';

/**
 * Displays a player's hand of cards.
 */
export default function Hand({ cards, selectedCards, onCardClick, disabled, label, faceDown }) {
  return (
    <div style={containerStyle}>
      {label && <div style={labelStyle}>{label}</div>}
      <div style={cardsRowStyle}>
        {cards.map((card, i) => (
          <div key={card.id} style={{ marginLeft: i > 0 ? -20 : 0 }}>
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

const emptyStyle = {
  color: '#bdc3c7',
  fontStyle: 'italic',
  padding: 20,
};

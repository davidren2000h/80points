import React from 'react';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../game/cardUtils.js';

/**
 * Single card component.
 */
export default function Card({ card, selected, onClick, faceDown, small, disabled }) {
  if (!card) return null;

  const isJoker = card.suit === 'joker';
  const isBigJoker = isJoker && card.rank === 'big';
  const isSmallJoker = isJoker && card.rank === 'small';

  const color = isJoker
    ? (isBigJoker ? '#e74c3c' : '#1a1a2e')
    : SUIT_COLORS[card.suit];

  const symbol = isJoker ? '' : SUIT_SYMBOLS[card.suit];
  const rankDisplay = isJoker ? (isBigJoker ? 'BJ' : 'SJ') : card.rank;
  const pointBadge = card.points > 0;

  const handleClick = () => {
    if (!disabled && onClick) onClick(card);
  };

  if (faceDown) {
    return (
      <div
        className={`card card-facedown ${small ? 'card-small' : ''}`}
        style={cardBackStyle}
      >
        <div style={cardBackPatternStyle}>🂠</div>
      </div>
    );
  }

  return (
    <div
      className={`card ${selected ? 'card-selected' : ''} ${small ? 'card-small' : ''} ${disabled ? 'card-disabled' : ''}`}
      style={{
        ...cardStyle,
        borderColor: selected ? '#f39c12' : '#ccc',
        transform: selected ? 'translateY(-12px)' : 'translateY(0)',
        boxShadow: selected ? '0 4px 16px rgba(243,156,18,0.5)' : '0 2px 6px rgba(0,0,0,0.15)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        width: small ? 48 : 70,
        height: small ? 72 : 100,
        fontSize: small ? '11px' : '14px',
      }}
      onClick={handleClick}
    >
      <div style={{ color, fontWeight: 'bold', lineHeight: 1 }}>
        {rankDisplay}
      </div>
      {!isJoker && (
        <div style={{ color, fontSize: small ? '18px' : '26px', lineHeight: 1 }}>
          {symbol}
        </div>
      )}
      {isJoker && (
        <div style={{ fontSize: small ? '20px' : '30px', lineHeight: 1 }}>
          {isBigJoker ? '🃏' : '🂿'}
        </div>
      )}
      {pointBadge && (
        <div style={pointBadgeStyle}>
          {card.points}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  background: '#fff',
  border: '2px solid #ccc',
  borderRadius: 8,
  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
  userSelect: 'none',
  position: 'relative',
  flexShrink: 0,
};

const cardBackStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 70,
  height: 100,
  background: 'linear-gradient(135deg, #2c3e50, #3498db)',
  border: '2px solid #2c3e50',
  borderRadius: 8,
  flexShrink: 0,
};

const cardBackPatternStyle = {
  fontSize: 36,
  opacity: 0.5,
};

const pointBadgeStyle = {
  position: 'absolute',
  top: 2,
  right: 2,
  background: '#f39c12',
  color: '#fff',
  borderRadius: '50%',
  width: 16,
  height: 16,
  fontSize: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
};

import React from 'react';
import Card from './Card.jsx';

/**
 * Displays the current trick area — cards played in the current trick.
 */
export default function TrickArea({ trick, players, trickLeader }) {
  // Position plays around a central area: South(bottom), West(left), North(top), East(right)
  const positions = [
    { label: 'South', style: { bottom: 0, left: '50%', transform: 'translateX(-50%)' } },
    { label: 'West', style: { top: '50%', left: 0, transform: 'translateY(-50%)' } },
    { label: 'North', style: { top: 0, left: '50%', transform: 'translateX(-50%)' } },
    { label: 'East', style: { top: '50%', right: 0, transform: 'translateY(-50%)' } },
  ];

  return (
    <div style={containerStyle}>
      <div style={trickAreaStyle}>
        {trick.map((play, i) => {
          const pos = positions[play.player];
          return (
            <div key={i} style={{ position: 'absolute', ...pos.style, display: 'flex', gap: 2 }}>
              {play.cards.map(card => (
                <Card key={card.id} card={card} disabled />
              ))}
            </div>
          );
        })}
        {trick.length === 0 && (
          <div style={emptyStyle}>
            {trickLeader !== undefined
              ? `${players[trickLeader]?.name || `Player ${trickLeader}`} leads`
              : 'Trick Area'}
          </div>
        )}
      </div>
    </div>
  );
}

const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 8,
};

const trickAreaStyle = {
  position: 'relative',
  width: 340,
  height: 260,
  border: '2px dashed #bdc3c7',
  borderRadius: 16,
  background: 'rgba(39,174,96,0.05)',
};

const emptyStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  color: '#bdc3c7',
  fontSize: 14,
  fontStyle: 'italic',
};

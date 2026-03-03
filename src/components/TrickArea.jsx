import React from 'react';
import Card from './Card.jsx';

/**
 * Displays the current trick area — cards played in the current trick.
 */
export default function TrickArea({ trick, players, trickLeader }) {
  // Determine if cards should be shrunk based on max cards in any single play
  const maxCards = trick.reduce((max, play) => Math.max(max, play.cards.length), 0);
  const useSmall = maxCards > 3;
  // Overlap cards when there are many
  const cardWidth = useSmall ? 48 : 70;
  const overlap = maxCards > 6 ? -(cardWidth * 0.45) : maxCards > 4 ? -(cardWidth * 0.3) : 2;

  // Position plays around a central area: South(bottom), West(left), North(top), East(right)
  // For horizontal positions (South/North), cards fan horizontally
  // For vertical positions (West/East), cards fan horizontally too but positioned at sides
  const positions = [
    { label: 'South', style: { bottom: 10, left: '50%', transform: 'translateX(-50%)' } },
    { label: 'West', style: { top: '50%', left: 10, transform: 'translateY(-50%)' } },
    { label: 'North', style: { top: 10, left: '50%', transform: 'translateX(-50%)' } },
    { label: 'East', style: { top: '50%', right: 10, transform: 'translateY(-50%)' } },
  ];

  return (
    <div style={containerStyle}>
      <div style={trickAreaStyle}>
        {trick.map((play, i) => {
          const pos = positions[play.player];
          return (
            <div key={i} style={{ position: 'absolute', ...pos.style, display: 'flex' }}>
              {play.cards.map((card, cardIdx) => (
                <div key={card.id} style={{ marginLeft: cardIdx > 0 ? overlap : 0 }}>
                  <Card card={card} disabled small={useSmall} />
                </div>
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
  width: 500,
  height: 380,
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

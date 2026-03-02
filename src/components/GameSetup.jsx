import React, { useState, useEffect } from 'react';
import { getDeckConfig } from '../game/cardUtils.js';

const AI_NAMES = [
  'Bob', 'Tom', 'Alice', 'Emma', 'Jack', 'Lily', 'Max', 'Sophie',
  'Leo', 'Mia', 'Sam', 'Chloe', 'Ben', 'Grace', 'Ryan', 'Ivy',
  'Luke', 'Ella', 'Finn', 'Ruby',
];

function pickRandomAINames() {
  const shuffled = [...AI_NAMES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1], shuffled[2]]; // West, North, East
}

/**
 * Game setup screen — name input + deck count selection.
 */
export default function GameSetup({ deckCount, onDeckCountChange, onStart, onSetNames, players }) {
  const [playerName, setPlayerName] = useState('');
  const [aiNames, setAiNames] = useState(pickRandomAINames);
  const configs = [2, 3, 4].map(d => ({ ...getDeckConfig(d), deckCount: d }));

  // Push names to state whenever they change
  useEffect(() => {
    const name = playerName.trim() || 'You';
    onSetNames(name, aiNames);
  }, [playerName, aiNames]);

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>80 Points</h1>
      <h2 style={subtitleStyle}>升级 · Shengji · Tractor</h2>

      <div style={nameInputSection}>
        <h3 style={{ margin: '0 0 12px 0', color: '#ecf0f1' }}>Your Name</h3>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          style={nameInputStyle}
          maxLength={20}
          autoFocus
        />
      </div>

      <div style={deckSelectStyle}>
        <h3 style={{ margin: '0 0 12px 0', color: '#ecf0f1' }}>Select Deck Count</h3>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {configs.map(cfg => (
            <button
              key={cfg.deckCount}
              style={{
                ...deckBtnStyle,
                borderColor: cfg.deckCount === deckCount ? '#3498db' : '#dee2e6',
                background: cfg.deckCount === deckCount ? '#ebf5fb' : '#fff',
              }}
              onClick={() => onDeckCountChange(cfg.deckCount)}
            >
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2c3e50' }}>{cfg.deckCount}</div>
              <div style={{ fontSize: 11, color: '#7f8c8d' }}>decks</div>
              <div style={tagStyle}>
                {cfg.deckCount === 2 ? '⚔️ Competitive' : cfg.deckCount === 3 ? '💥 Explosive' : '🌪️ Chaos'}
              </div>
              <div style={detailsStyle}>
                <div>{cfg.cardsPerPlayer} cards/player</div>
                <div>{cfg.bottomCards} bottom cards</div>
                <div>{cfg.winThreshold} pts to win</div>
                <div>+1 level / {cfg.levelIncrement} pts</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={playersStyle}>
        <h3 style={{ margin: '0 0 8px 0', color: '#ecf0f1' }}>Players</h3>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {players.map((p, i) => (
            <div key={i} style={playerCardStyle}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#2c3e50' }}>Team {p.team + 1}: {p.name}</div>
              <div style={{ fontSize: 11, color: '#555' }}>
                Level {p.level}{i === 0 ? ' (You)' : ' (AI)'}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#fff', marginTop: 8, textAlign: 'center', fontWeight: 'bold' }}>
          Team 1: {players[0]?.name} &amp; {players[2]?.name} · Team 2: {players[1]?.name} &amp; {players[3]?.name}
        </div>
        <button
          style={reshuffleBtn}
          onClick={() => setAiNames(pickRandomAINames())}
        >
          🔄 Shuffle AI Names
        </button>
      </div>

      <button style={startBtnStyle} onClick={onStart}>
        🎴 Start Game
      </button>
    </div>
  );
}

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
  padding: 40,
  maxWidth: 700,
  margin: '0 auto',
};

const titleStyle = {
  fontSize: 42,
  fontWeight: 'bold',
  color: '#f1c40f',
  margin: 0,
  letterSpacing: 2,
  textShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const subtitleStyle = {
  fontSize: 16,
  color: '#ecf0f1',
  fontWeight: 'normal',
  margin: 0,
};

const deckSelectStyle = {
  background: '#f8f9fa',
  borderRadius: 16,
  padding: 24,
  width: '100%',
};

const deckBtnStyle = {
  border: '2px solid #dee2e6',
  borderRadius: 12,
  padding: 16,
  cursor: 'pointer',
  background: '#fff',
  transition: 'border-color 0.2s, background 0.2s',
  flex: 1,
  minWidth: 140,
};

const tagStyle = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 10,
  background: '#f0f0f0',
  display: 'inline-block',
  margin: '4px 0',
};

const detailsStyle = {
  fontSize: 11,
  color: '#7f8c8d',
  marginTop: 8,
  lineHeight: 1.6,
};

const playersStyle = {
  background: '#f8f9fa',
  borderRadius: 16,
  padding: 20,
  width: '100%',
};

const playerCardStyle = {
  background: '#fff',
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid #dee2e6',
};

const nameInputSection = {
  background: '#f8f9fa',
  borderRadius: 16,
  padding: 24,
  width: '100%',
  textAlign: 'center',
};

const nameInputStyle = {
  padding: '10px 16px',
  fontSize: 16,
  borderRadius: 8,
  border: '2px solid #dee2e6',
  outline: 'none',
  width: 220,
  textAlign: 'center',
  transition: 'border-color 0.2s',
};

const reshuffleBtn = {
  marginTop: 10,
  padding: '6px 16px',
  border: '1px solid #bdc3c7',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  color: '#555',
};

const startBtnStyle = {
  padding: '14px 48px',
  border: 'none',
  borderRadius: 12,
  background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
  color: '#fff',
  fontSize: 18,
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(39,174,96,0.3)',
  transition: 'transform 0.15s',
};

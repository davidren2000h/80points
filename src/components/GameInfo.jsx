import React from 'react';
import { getNoTrumpRequirement, getCounterTrumpRequirements } from '../game/rulesEngine.js';

/**
 * Shows game info: trump, scores, levels, configuration details.
 */
export default function GameInfo({ state }) {
  const {
    deckCount, config, trumpSuit, trumpRank, noTrump,
    declaration, declarer, players, nonDeclarerPoints,
    tricksPlayed, phase, roundNumber, declarerTeam,
  } = state;

  const noTrumpReq = getNoTrumpRequirement(deckCount);
  const totalPoints = config.totalPoints;
  const winThreshold = config.winThreshold;
  const declarerTeamPlayers = players.filter(p => p.team === declarerTeam).map(p => p.name).join(' & ');
  const nonDeclarerTeamPlayers = players.filter(p => p.team !== declarerTeam).map(p => p.name).join(' & ');

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Game Info</div>

      <div style={sectionStyle}>
        <InfoRow label="Round" value={roundNumber} />
        <InfoRow label="Decks" value={`${deckCount} (${totalPoints} pts total)`} />
        <InfoRow label="Bottom" value={`${config.bottomCards} cards`} />
        <InfoRow label="Win Threshold" value={`${winThreshold} pts`} />
      </div>

      <div style={dividerStyle} />

      <div style={sectionStyle}>
        <InfoRow label="Trump Rank" value={trumpRank || '—'} />
        <InfoRow
          label="Trump Suit"
          value={noTrump ? 'No-Trump' : (trumpSuit || 'Undeclared')}
          highlight={!!trumpSuit || noTrump}
        />
        <InfoRow label="Declarer" value={players[declarer]?.name || '—'} />
        <InfoRow label="Declarer Team" value={declarerTeamPlayers} />
      </div>

      <div style={dividerStyle} />

      <div style={sectionStyle}>
        <InfoRow
          label="Non-Declarer Pts"
          value={`${nonDeclarerPoints} / ${winThreshold}`}
          highlight={nonDeclarerPoints >= winThreshold}
        />
        <InfoRow label="Tricks Played" value={tricksPlayed} />
      </div>

      <div style={dividerStyle} />

      <div style={sectionStyle}>
        <div style={subHeaderStyle}>Player Levels</div>
        {players.map((p, i) => (
          <InfoRow
            key={i}
            label={p.name}
            value={`Level ${p.level} (${getRankLabel(p.level)})`}
            highlight={i === declarer}
          />
        ))}
      </div>

      <div style={dividerStyle} />

      <div style={sectionStyle}>
        <div style={subHeaderStyle}>Rules Reference</div>
        <InfoRow label="No-Trump Req" value={noTrumpReq.description} small />
        <InfoRow label="Counter Sizes" value={`Up to ${deckCount} cards`} small />
        <InfoRow label="Level Increment" value={`+1 per ${config.levelIncrement} pts`} small />
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: small ? 11 : 13 }}>
      <span style={{ color: '#7f8c8d' }}>{label}:</span>
      <span style={{ fontWeight: highlight ? 'bold' : 'normal', color: highlight ? '#e74c3c' : '#2c3e50' }}>
        {value}
      </span>
    </div>
  );
}

function getRankLabel(level) {
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  if (level < 2) return '2';
  if (level > 14) return 'Winner!';
  return ranks[level - 2];
}

const panelStyle = {
  background: '#f8f9fa',
  border: '1px solid #dee2e6',
  borderRadius: 12,
  padding: 16,
  width: 260,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  flexShrink: 0,
  maxHeight: '100vh',
  overflowY: 'auto',
};

const headerStyle = {
  fontWeight: 'bold',
  fontSize: 16,
  color: '#2c3e50',
  textAlign: 'center',
  paddingBottom: 4,
};

const subHeaderStyle = {
  fontWeight: 'bold',
  fontSize: 12,
  color: '#7f8c8d',
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const dividerStyle = {
  borderBottom: '1px solid #eee',
  margin: '2px 0',
};

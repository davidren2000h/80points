import React from 'react';
import { calculateLevelChange } from '../game/rulesEngine.js';
import { countPoints } from '../game/cardUtils.js';

/**
 * Score board displayed at round end.
 */
export default function ScoreBoard({ state, onEndRound }) {
  const { players, nonDeclarerPoints, declarerPoints, deckCount, declarerTeam, config, trickPoints, bottom, lastTrickWinner } = state;

  const result = calculateLevelChange(nonDeclarerPoints, deckCount);
  const declarerTeamPlayers = players.filter(p => p.team === declarerTeam);
  const nonDeclarerTeamPlayers = players.filter(p => p.team !== declarerTeam);

  // Bottom card points are set aside during play. If declarer wins last trick,
  // these points are implicitly defended. Calculate for display:
  const bottomRawPts = countPoints(bottom);
  const lastWinnerTeam = players[lastTrickWinner]?.team;
  const declarerWonLast = lastWinnerTeam === declarerTeam;
  // Declarer's total: trick points + (bottom pts if they defended them)
  const declarerTotal = declarerPoints + (declarerWonLast ? bottomRawPts : 0);

  // Find bottom score from the last trick entry (if any)
  const lastTrickEntry = trickPoints[trickPoints.length - 1];
  const bottomScoreApplied = lastTrickEntry?.bottomScore || 0;

  return (
    <div style={overlayStyle}>
      <div style={boardStyle}>
        <h2 style={{ textAlign: 'center', margin: 0, color: '#2c3e50' }}>
          Round Complete
        </h2>

        <div style={resultStyle}>
          <div style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: result.declarerWins ? '#27ae60' : '#e74c3c',
          }}>
            {result.declarerWins ? '🏆 Declarer Team Wins!' : '🎯 Non-Declarer Team Wins!'}
          </div>
          <div style={{ fontSize: 14, color: '#7f8c8d' }}>
            Level advancement: +{result.levelChange}
          </div>
        </div>

        <div style={statsStyle}>
          <div style={statBoxStyle}>
            <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>Declarer Team</div>
            <div style={{ color: '#7f8c8d' }}>
              {declarerTeamPlayers.map(p => p.name).join(' & ')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#27ae60' }}>
              {declarerTotal} pts defended
            </div>
            {declarerWonLast && bottomRawPts > 0 && (
              <div style={{ fontSize: 11, color: '#95a5a6' }}>
                (incl. {bottomRawPts} pts in bottom)
              </div>
            )}
          </div>

          <div style={{ fontSize: 20, color: '#bdc3c7', padding: '0 16px' }}>vs</div>

          <div style={statBoxStyle}>
            <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>Non-Declarer Team</div>
            <div style={{ color: '#7f8c8d' }}>
              {nonDeclarerTeamPlayers.map(p => p.name).join(' & ')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#e74c3c' }}>
              {nonDeclarerPoints} pts captured
            </div>
            {bottomScoreApplied > 0 && (
              <div style={{ fontSize: 11, color: '#95a5a6' }}>
                (incl. {bottomScoreApplied} bottom score ×{state.lastTrickCardCount})
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#95a5a6', textAlign: 'center' }}>
          Win threshold: {config.winThreshold} pts | 
          {nonDeclarerPoints === 0 ? ' Clean Sweep (剃光头)! +3 levels' : ''}
        </div>

        <div style={trickSummaryStyle}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Trick History</div>
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            {trickPoints.map((t, i) => (
              <div key={i} style={{ fontSize: 11, color: '#7f8c8d', display: 'flex', justifyContent: 'space-between' }}>
                <span>Trick {i + 1}: {players[t.winner]?.name}</span>
                <span>{t.points > 0 ? `${t.points} pts` : '—'}{t.bottomScore > 0 ? ` + ${t.bottomScore} bottom` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {onEndRound && (
          <button style={continueBtn} onClick={onEndRound}>
            See Level Changes →
          </button>
        )}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const boardStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: 32,
  maxWidth: 540,
  width: '90%',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const resultStyle = {
  textAlign: 'center',
  padding: 12,
  background: '#f8f9fa',
  borderRadius: 8,
};

const statsStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const statBoxStyle = {
  textAlign: 'center',
  padding: 12,
  background: '#f8f9fa',
  borderRadius: 8,
  flex: 1,
};

const trickSummaryStyle = {
  padding: 8,
  background: '#f8f9fa',
  borderRadius: 8,
  fontSize: 12,
};

const continueBtn = {
  padding: '12px 32px',
  border: 'none',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(39,174,96,0.3)',
  alignSelf: 'center',
};

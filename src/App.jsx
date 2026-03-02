import React from 'react';
import useGameState from './hooks/useGameState.js';
import GameSetup from './components/GameSetup.jsx';
import GameBoard from './components/GameBoard.jsx';
import { PHASES } from './game/gameEngine.js';
import './App.css';

export default function App() {
  const { state, onAction } = useGameState();

  const isSetupPhase = state.phase === PHASES.SETUP && state.roundNumber === 1;

  return (
    <div className="app">
      {isSetupPhase ? (
        <GameSetup
          deckCount={state.deckCount}
          onDeckCountChange={(d) => onAction({ type: 'SET_DECK_COUNT', deckCount: d })}
          onStart={() => onAction({ type: 'START_GAME' })}
          onSetNames={(playerName, aiNames) => onAction({ type: 'SET_PLAYER_NAMES', playerName, aiNames })}
          players={state.players}
        />
      ) : (
        <GameBoard state={state} onAction={onAction} />
      )}
    </div>
  );
}

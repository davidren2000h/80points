import { useReducer, useCallback } from 'react';
import { createInitialState, dispatch as gameDispatch } from '../game/gameEngine.js';

/**
 * Hook that manages the full game state via the game engine's reducer.
 */
export default function useGameState() {
  const [state, rawDispatch] = useReducer(
    (state, action) => gameDispatch(state, action),
    null,
    createInitialState
  );

  const onAction = useCallback((action) => {
    rawDispatch(action);
  }, []);

  return { state, onAction };
}

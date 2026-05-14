import { useState } from 'react';
import Editor from './components/Editor';
import PlayBoard from './components/PlayBoard';
import { useGameState } from './hooks/useGameState';

export default function App() {
  const { gameState, ...hooks } = useGameState();
  const [mode, setMode] = useState<'editor' | 'play'>('editor');

  return (
    <div className="antialiased min-h-screen">
      {mode === 'editor' ? (
        <Editor 
          gameState={gameState} 
          hooks={hooks} 
          onPlay={() => setMode('play')} 
        />
      ) : (
        <PlayBoard 
          gameState={gameState} 
          hooks={hooks} 
          onEdit={() => setMode('editor')} 
        />
      )}
    </div>
  );
}


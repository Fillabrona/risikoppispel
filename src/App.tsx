import { useState, useEffect, useRef } from 'react';
import Editor from './components/Editor';
import PlayBoard from './components/PlayBoard';
import { useGameState } from './hooks/useGameState';
import { Volume2, VolumeX, Music } from 'lucide-react';

export default function App() {
  const { gameState, ...hooks } = useGameState();
  const [mode, setMode] = useState<'editor' | 'play'>('editor');
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('isMuted');
    return saved === null ? false : saved === 'true';
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    localStorage.setItem('isMuted', String(isMuted));
  }, [isMuted]);

  const allAnswered = gameState.categories.length > 0 && 
    gameState.categories.every(cat => cat.questions.length > 0 && cat.questions.every(q => q.isAnswered));

  useEffect(() => {
    if (audioRef.current && audioUnlocked) {
      let src = "";
      if (mode === 'editor') {
        src = "https://fillabrona.github.io/editingjeo.mp3";
      } else {
        src = allAnswered ? "https://fillabrona.github.io/victory.m4a" : "https://fillabrona.github.io/jeopardy.m4a";
      }

      // Use a more robust check for src
      const currentSrc = audioRef.current.src;
      if (!currentSrc || !currentSrc.endsWith(src.split('/').pop() || '')) {
        audioRef.current.src = src;
        audioRef.current.load();
        audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
      }
      
      audioRef.current.muted = isMuted;
      audioRef.current.loop = true;
      
      if (!isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [allAnswered, isMuted, mode, audioUnlocked]);

  const handleUnlockAudio = () => {
    setAudioUnlocked(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="antialiased min-h-screen bg-[#0f172a] selection:bg-cyan-500/30">
      <audio
        ref={audioRef}
        autoPlay
        loop
        muted={isMuted}
        className="hidden"
      />

      {!audioUnlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/50 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center transform transition-all animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Risiko Oppi Spel</h2>
            <p className="text-slate-400 mb-8 text-sm">Allow sound to experience the full Jeopardy atmosphere and background music.</p>
            <button
              onClick={handleUnlockAudio}
              className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl"
            >
              Enter with Sound
            </button>
            <button
              onClick={() => { setAudioUnlocked(true); setIsMuted(true); }}
              className="w-full mt-3 py-3 text-slate-500 font-medium text-xs uppercase tracking-widest hover:text-slate-300 transition-colors"
            >
              Enter Muted
            </button>
          </div>
        </div>
      )}

      {mode === 'editor' ? (
        <Editor 
          gameState={gameState} 
          hooks={hooks} 
          onPlay={() => setMode('play')}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
        />
      ) : (
        <PlayBoard 
          gameState={gameState} 
          hooks={hooks} 
          onEdit={() => setMode('editor')}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
        />
      )}
    </div>
  );
}


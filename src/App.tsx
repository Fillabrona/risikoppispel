import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Editor from './components/Editor';
import PlayBoard from './components/PlayBoard';
import BuzzerView from './components/BuzzerView';
import { useGameState } from './hooks/useGameState';
import { Volume2, VolumeX, Music, QrCode } from 'lucide-react';
import { auth, loginAnonymously, db } from './lib/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';

function HostView() {
  const { gameState, ...hooks } = useGameState();
  const [mode, setMode] = useState<'editor' | 'play'>('editor');
  const [gameId, setGameId] = useState('');
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('isMuted');
    return saved === null ? false : saved === 'true';
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Generate a new 4-character code every time if one doesn't exist
        // Use a ref to ensure we only generate ONCE per mount
        setGameId(prev => prev || Math.random().toString(36).substring(2, 6).toUpperCase());
      }
    });
    loginAnonymously();
    return () => unsubscribe();
  }, []);

  const playersRef = useRef(gameState.players);
  useEffect(() => {
    playersRef.current = gameState.players;
  }, [gameState.players]);

  // Sync Firestore Participants to GameState
  useEffect(() => {
    if (!gameId || !db) return;
    
    // Initialize game doc
    const gRef = doc(db, 'games', gameId);
    setDoc(gRef, { status: mode === 'play' ? 'playing' : 'editor' }, { merge: true });

    // Listen for participants
    const participantsRef = collection(db, 'games', gameId, 'participants');
    const unsubParticipants = onSnapshot(participantsRef, (snapshot) => {
      let playerWasRemoved = false;
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (change.type === 'added') {
          hooks.addPlayer(data.name, change.doc.id, data.voiceUri);
          if (data.score !== undefined) {
             hooks.setGameState((s: any) => ({
                 ...s,
                 players: s.players.map((p: any) => p.id === change.doc.id ? { ...p, score: data.score } : p)
             }));
          }
        } else if (change.type === 'modified') {
          // Sync score or name if they changed in Firestore (e.g. from Phone view)
          const currentPlayer = playersRef.current.find(p => p.id === change.doc.id);
          
          // Also sync voiceUri if it changed
          if (data.voiceUri) {
            hooks.setGameState((s: any) => ({
              ...s,
              players: s.players.map((p: any) => p.id === change.doc.id ? { ...p, voiceUri: data.voiceUri } : p)
            }));
          }

          if (currentPlayer) {
            if (data.score !== undefined && data.score !== currentPlayer.score) {
              // Direct absolute update to prevent desync
              hooks.setGameState((s: any) => ({
                ...s,
                players: s.players.map((p: any) => p.id === change.doc.id ? { ...p, score: data.score } : p)
              }));
            }
            if (data.name !== undefined && data.name !== currentPlayer.name) {
              hooks.updatePlayerName(change.doc.id, data.name);
            }
          }
        } else if (change.type === 'removed') {
          hooks.removePlayer(change.doc.id);
          playerWasRemoved = true;
        }
      });

      // Only auto-exit if a player was actually removed and now the room is empty
      if (mode === 'play' && playerWasRemoved && snapshot.docs.length === 0) {
           setMode('editor');
           sessionStorage.setItem('preferred_editor_tab', 'players');
      }
    });

    return () => unsubParticipants();
  }, [gameId, mode, db]); // gameState removed from dependency array to prevent resubscribe on every score change

  useEffect(() => {
    localStorage.setItem('isMuted', String(isMuted));
  }, [isMuted]);

  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const checkSize = () => setIsSmallScreen(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  if (isSmallScreen) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center text-white font-sans">
        <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-cyan-500/20">
          <QrCode className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black mb-4 tracking-tight uppercase">Buzzer Mode Only</h1>
        <p className="text-slate-400 max-w-xs mb-10 leading-relaxed font-medium">
          The game board and editor are designed for larger screens. Scan the QR code on the host's screen with your phone to join as a player!
        </p>
        <div className="w-full h-1 bg-slate-800 rounded-full mb-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 animate-[shimmer_2s_infinite]"></div>
        </div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Open on a laptop to host</p>
      </div>
    );
  }

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

      const audio = audioRef.current;
      
      // Use dataset to store the abstract src to avoid browser-absolute path issues
      if (audio.dataset.activeSrc !== src) {
        audio.dataset.activeSrc = src;
        audio.src = src;
        audio.load();
        
        if (!isMuted) {
          audio.play().catch(e => console.error("Audio playback failed:", e));
        }
      }
      
      audio.muted = isMuted;
      audio.loop = true;
      
      if (!isMuted && audio.paused) {
        audio.play().catch(() => {});
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
          gameId={gameId}
        />
      ) : (
        <PlayBoard 
          gameState={gameState} 
          hooks={hooks} 
          onEdit={() => setMode('editor')}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          gameId={gameId}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HostView />} />
      <Route path="/buzzer/:gameId" element={<BuzzerView />} />
    </Routes>
  );
}


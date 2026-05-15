import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth, loginAnonymously } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Mic, Square, Loader2, Trophy, Minus, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';

const getBuzzerColor = (id: string | undefined) => {
  if (!id) return '#ef4444'; // Default red
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#0ea5e9'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function BuzzerView() {
  const { gameId } = useParams();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [gameStatus, setGameStatus] = useState<any>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [myBuzz, setMyBuzz] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [scoreNotification, setScoreNotification] = useState<{ delta: number, type: 'plus' | 'minus' } | null>(null);
  
  const [recording, setRecording] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string>('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(user => {
      if (user) setIsAuth(true);
    });
    loginAnonymously();
    const pid = localStorage.getItem('participantId') || Math.random().toString(36).substring(2, 9);
    localStorage.setItem('participantId', pid);
    setParticipantId(pid);
    return () => unsubAuth();
  }, []);

  // Sync Participant Data (Score, etc)
  useEffect(() => {
    if (!gameId || !participantId || !joined) return;
    
    const pRef = doc(db, 'games', gameId, 'participants', participantId);
    const unsub = onSnapshot(pRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.score !== undefined) {
          if (data.score > myScore && joined) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: [getBuzzerColor(participantId), '#ffffff']
            });
            setScoreNotification({ delta: data.score - myScore, type: 'plus' });
          } else if (data.score < myScore && joined) {
            setScoreNotification({ delta: myScore - data.score, type: 'minus' });
          }
          setMyScore(data.score);
        }
      }
    });

    return () => unsub();
  }, [gameId, participantId, joined, myScore]);

  // Clear notification
  useEffect(() => {
    if (scoreNotification) {
      const timer = setTimeout(() => setScoreNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [scoreNotification]);

  // Handle cleanup on leave
  useEffect(() => {
    if (!gameId || !participantId || !joined) return;

    const cleanup = () => {
      const pRef = doc(db, 'games', gameId, 'participants', participantId);
      deleteDoc(pRef).catch(() => {});
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [gameId, participantId, joined]);

  useEffect(() => {
    if (!gameId || !isAuth) return;
    const unsub = onSnapshot(doc(db, 'games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameStatus(data);
        if (!data.activeQuestion) {
          setIsAnswering(false);
          setMyBuzz(false);
        } else if (data.firstBuzz?.participantId === participantId) {
          setMyBuzz(true);
        } else if (data.firstBuzz) {
          setIsAnswering(false); // Someone else buzzed
        }
      }
    });
    return () => unsub();
  }, [gameId, participantId, isAuth]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setVoiceUri(reader.result);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.current.start();
      setRecording(true);
      
      // Auto stop after 2 seconds
      setTimeout(() => {
        if (mediaRecorder.current?.state === 'recording') {
          stopRecording();
        }
      }, 2000);
      
    } catch (e) {
      console.error(e);
      alert('Microphone access denied or error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !gameId) return;
    
    // Generate avatar URL similar to existing app logic
    const avatarUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`;
    
    const pRef = doc(db, 'games', gameId, 'participants', participantId);
    await setDoc(pRef, {
      name,
      avatarUrl,
      voiceUri,
      joinedAt: new Date().toISOString(),
      score: 0
    });
    setJoined(true);
  };

  const buzzOut = async () => {
    if (!gameId || !gameStatus?.activeQuestion || gameStatus.firstBuzz || myBuzz) return;
    
    // Check timer locally just in case
    const qDetails = gameStatus.activeQuestion;
    if (qDetails.endTime && Date.now() > qDetails.endTime) {
      return; // Too late
    }

    setIsAnswering(true);
    setMyBuzz(true);
    
    const avatarUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`;
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      firstBuzz: {
        participantId,
        name,
        avatarUrl,
        voiceUri,
        time: new Date().toISOString(),
      }
    });
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl">
          <h1 className="text-3xl font-bold text-white text-center tracking-tight">Join Game</h1>
          <div className="space-y-4">
            <input 
              type="text"
              placeholder="Your Name (Nickname)"
              maxLength={12}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500 font-bold"
            />
            
            <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 flex flex-col items-center justify-center gap-3">
              <span className="text-sm font-medium text-slate-300 text-center">Record a short voice clip of your name (max 2s)</span>
              
              {!recording ? (
                <button 
                  onClick={startRecording}
                  className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-all text-slate-900"
                >
                  <Mic className="w-6 h-6" />
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center transition-all animate-pulse text-white"
                >
                  <Square className="w-5 h-5 fill-current" />
                </button>
              )}
              
              {voiceUri && !recording && (
                <div className="text-xs text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1 rounded-full">Recording Saved!</div>
              )}
            </div>
            
            <button 
              onClick={handleJoin}
              disabled={!name.trim() || !voiceUri || !isAuth}
              className="w-full bg-cyan-500 text-slate-900 font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all mt-4 flex items-center justify-center gap-2"
            >
              {!isAuth && <Loader2 className="w-4 h-4 animate-spin" />}
              {isAuth ? 'Enter Lobby' : 'Connecting...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isBuzzerActive = gameStatus?.activeQuestion && !gameStatus?.firstBuzz;
  // If timer exceeded, they shouldn't be able to buzz
  let expired = false;
  if (isBuzzerActive && gameStatus.activeQuestion.endTime) {
    expired = Date.now() > gameStatus.activeQuestion.endTime;
  }
  const canBuzz = isBuzzerActive && !expired;
  
  const iWonBuzz = gameStatus?.firstBuzz?.participantId === participantId;
  const someoneElseWon = gameStatus?.firstBuzz && !iWonBuzz;

  const buzzerColor = getBuzzerColor(participantId);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-between p-6 select-none overflow-hidden touch-manipulation relative">
      <AnimatePresence>
        {scoreNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none`}
          >
            <div className={`px-12 py-6 rounded-full font-black text-6xl shadow-2xl ${scoreNotification.type === 'plus' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'} border-4 border-white/20`}>
              {scoreNotification.type === 'plus' ? '+' : '-'}{scoreNotification.delta}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Bar */}
      <div className="w-full max-w-sm flex items-center justify-between bg-white/5 border border-white/10 rounded-3xl p-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 overflow-hidden border border-white/20">
            <img 
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`} 
              alt={name} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Contestant</span>
            <span className="text-white text-xl font-black tracking-tight">{name}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-amber-500/50 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Total Score</span>
          <span className="text-amber-400 text-3xl font-black tabular-nums">{myScore}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {!gameStatus?.activeQuestion ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
              <Trophy className="w-10 h-10 text-amber-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-white tracking-widest uppercase">Waiting...</h2>
              <p className="text-slate-400 font-medium tracking-wide">Host is selecting the next card</p>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={buzzOut}
            disabled={!canBuzz}
            style={{ backgroundColor: canBuzz ? buzzerColor : undefined }}
            className={`w-[85vw] max-w-sm aspect-square rounded-full transition-all transform active:scale-90 flex items-center justify-center select-none touch-none border-[12px] border-black/20
              ${iWonBuzz ? 'bg-emerald-500 border-white/20' : 
              someoneElseWon ? 'bg-slate-800 opacity-50 border-white/5' : 
              canBuzz ? 'hover:brightness-110 active:brightness-90' : 
              'bg-slate-800 opacity-50 border-white/5'}`}
          >
            <div className="flex flex-col items-center justify-center">
              <span className="text-4xl sm:text-5xl text-white font-black tracking-tighter uppercase drop-shadow-md text-center px-6">
                {iWonBuzz ? 'YOUR TURN' : someoneElseWon ? 'TOO SLOW' : canBuzz ? 'BUZZ' : 'TIME UP'}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full flex justify-center py-4">
        <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
          Game: {gameId}
        </div>
      </div>
    </div>
  );
}


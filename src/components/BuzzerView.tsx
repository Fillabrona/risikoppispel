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

    // Use a stable participantId from localStorage
    let pid = localStorage.getItem('participantId');
    if (!pid) {
      pid = 'p-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
      localStorage.setItem('participantId', pid);
    }
    setParticipantId(pid);

    const savedName = localStorage.getItem('participantName');
    const savedVoice = localStorage.getItem('participantVoice');
    if (savedName) setName(savedName);
    if (savedVoice) setVoiceUri(savedVoice);

    return () => unsubAuth();
  }, []);

  // Auto-join logic
  useEffect(() => {
    if (isAuth && gameId && participantId && !joined) {
      const savedName = localStorage.getItem('participantName');
      if (savedName) {
        const pRef = doc(db, 'games', gameId, 'participants', participantId);
        getDoc(pRef).then(snap => {
          if (snap.exists()) {
            setJoined(true);
          }
        }).catch(err => console.error("Auto-join check failed:", err));
      }
    }
  }, [isAuth, gameId, participantId, joined]);

  // Sync Participant Data & Lifecycle
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
      } else {
         // If host removed us, we should drop back to join screen
         setJoined(false);
      }
    });

    const cleanup = () => {
      deleteDoc(pRef).catch(() => {});
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      unsub();
      window.removeEventListener('beforeunload', cleanup);
    };
  }, [gameId, participantId, joined, myScore]);

  // Game rules & buzzer sync
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
          setIsAnswering(false); 
        }
      }
    });
    return () => unsub();
  }, [gameId, participantId, isAuth]);

  // Clear score notification
  useEffect(() => {
    if (scoreNotification) {
      const timer = setTimeout(() => setScoreNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [scoreNotification]);

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

  const handleJoin = async (overrideName?: string, overrideVoice?: string) => {
    const n = overrideName || name;
    const v = overrideVoice || voiceUri;

    if (!n.trim() || !gameId || !participantId) return;
    
    // Save to session
    localStorage.setItem('participantName', n);
    localStorage.setItem('participantVoice', v || '');

    try {
      // Generate avatar URL
      const avatarUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(n)}&backgroundColor=transparent`;
      
      const pRef = doc(db, 'games', gameId, 'participants', participantId);
      await setDoc(pRef, {
        name: n,
        avatarUrl,
        voiceUri: v || '',
        joinedAt: new Date().toISOString(),
        score: myScore || 0
      }, { merge: true });
      
      setJoined(true);
    } catch (err) {
      console.error("Join failed:", err);
      alert("Failed to join. Please try again.");
    }
  };

  const buzzOut = async () => {
    if (!gameId || !gameStatus?.activeQuestion || gameStatus.firstBuzz || myBuzz) return;
    
    // Check if I already buzzed wrong
    if (gameStatus?.wrongBuzzes?.includes(participantId)) return;
    // Check if answer is revealed
    if (gameStatus?.showAnswer) return;

    // Check timer locally just in case
    const qDetails = gameStatus.activeQuestion;
    if (qDetails.endTime && Date.now() > qDetails.endTime) {
      return; // Too late
    }

    setIsAnswering(true);
    setMyBuzz(true);
    
    const avatarName = localStorage.getItem('participantName') || name;
    const avatarUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarName)}&backgroundColor=transparent`;
    
    const gameRef = doc(db, 'games', gameId);
    await setDoc(gameRef, {
      firstBuzz: {
        participantId,
        name: avatarName,
        avatarUrl,
        voiceUri,
        time: new Date().toISOString(),
      }
    }, { merge: true });
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
              onClick={() => handleJoin()}
              disabled={!name.trim() || !isAuth}
              className="w-full bg-cyan-500 text-slate-900 font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all mt-4 flex items-center justify-center gap-2"
            >
              {!isAuth && <Loader2 className="w-5 h-5 animate-spin" />}
              {isAuth ? (localStorage.getItem('participantName') ? `Enter Lobby as ${localStorage.getItem('participantName')}` : 'Enter Lobby') : 'Connecting...'}
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
  
  const wasWrong = gameStatus?.wrongBuzzes?.includes(participantId);
  const isAnswerShown = gameStatus?.showAnswer;
  const canBuzz = isBuzzerActive && !expired && !wasWrong && !isAnswerShown;
  
  const iWonBuzz = gameStatus?.firstBuzz?.participantId === participantId;
  const someoneElseWon = gameStatus?.firstBuzz && !iWonBuzz;

  const buzzerColor = getBuzzerColor(participantId);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-between p-6 select-none overflow-hidden touch-manipulation relative">
      <AnimatePresence mode="wait">
        {scoreNotification && (
          <motion.div
            key={Date.now()} // Fresh animation for each change
            initial={{ opacity: 0, y: 100, scale: 0.3, rotate: -15 }}
            animate={{ opacity: 1, y: -20, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -150, scale: 1.5, rotate: 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none`}
          >
            <div className={`px-14 py-8 rounded-[3rem] font-black text-7xl ${scoreNotification.type === 'plus' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'} border-[6px] border-white/30 uppercase flex flex-col items-center gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]`}>
               <span className="text-2xl opacity-80">{scoreNotification.type === 'plus' ? 'AWESOME!' : 'OUCH!'}</span>
               <div className="flex items-center gap-3">
                 {scoreNotification.type === 'plus' ? <Plus className="w-12 h-12" /> : <Minus className="w-12 h-12" />}
                 {scoreNotification.delta}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Bar */}
      <div className="w-full max-w-sm flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 overflow-hidden border border-white/10">
            <img 
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`} 
              alt={name} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Player</span>
            <span className="text-white text-lg font-black tracking-tight line-clamp-1">{name}</span>
          </div>
        </div>
        <div className="flex flex-col items-end pl-4 border-l border-white/10">
          <span className="text-amber-500/50 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Score</span>
          <span className="text-amber-400 text-2xl font-black tabular-nums leading-none">{myScore}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {!gameStatus?.activeQuestion ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 shadow-inner">
               <motion.div
                 animate={{ rotate: [0, 10, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
               >
                 <Trophy className="w-10 h-10 text-amber-500/80" />
               </motion.div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white/90 tracking-[0.2em] uppercase">Ready</h2>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Waiting for host to pick a card...</p>
            </div>
          </motion.div>
        ) : (
          <div className="relative group">
            {/* Visual indicator of "can buzz" state without outer glow */}
            <button
              onClick={buzzOut}
              disabled={!canBuzz}
              style={{ backgroundColor: canBuzz ? buzzerColor : undefined }}
              className={`w-[80vw] max-w-[320px] aspect-square rounded-full transition-all duration-300 transform active:scale-95 flex items-center justify-center select-none touch-none border-[12px] border-black/30 shadow-none
                ${iWonBuzz ? 'bg-emerald-500 border-white/10' : 
                someoneElseWon ? 'bg-slate-800 opacity-20 border-transparent saturate-0' : 
                canBuzz ? 'brightness-100 scale-100' : 
                'bg-slate-800 opacity-20 border-transparent saturate-0 scale-95'}`}
            >
              <div className="flex flex-col items-center justify-center">
                <span className={`text-3xl sm:text-4xl text-white font-black tracking-tighter uppercase text-center px-8 leading-tight transition-all ${!canBuzz ? 'opacity-40' : 'opacity-100'}`}>
                  {iWonBuzz ? 'YOUR TURN' : someoneElseWon ? 'TOO SLOW' : canBuzz ? 'BUZZ' : 'WAIT'}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full flex justify-center py-4" />
    </div>
  );
}


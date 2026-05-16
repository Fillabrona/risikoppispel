import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth, loginAnonymously } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, getDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { Mic, Square, Loader2, Trophy, Minus, Plus, Gamepad2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from '../hooks/useSound';

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
  const [myScore, setMyScore] = useState<number | null>(null);
  const [scoreNotification, setScoreNotification] = useState<{ delta: number, type: 'plus' | 'minus' } | null>(null);
  
  const [recording, setRecording] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string>('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [isAuth, setIsAuth] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isSendingBuzz, setIsSendingBuzz] = useState(false);
  const [localHasClicked, setLocalHasClicked] = useState(false);
  const { playSound } = useSound(false);
  const wakeLockRef = useRef<any>(null);

  // Wake Lock Implementation
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.error(`${err.name}, ${err.message}`);
        }
      }
    };

    if (joined) {
      requestWakeLock();
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [joined]);

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
          if (myScore !== null && data.score !== myScore && joined) {
            const diff = data.score - myScore;
            // Only trigger if difference is non-zero
            if (diff !== 0) {
              setScoreNotification({ delta: Math.abs(diff), type: diff > 0 ? 'plus' : 'minus' });
              if (diff > 0) {
                playSound('award');
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: [getBuzzerColor(participantId), '#ffffff']
                });
              } else {
                playSound('penalize');
              }
            }
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
  }, [gameId, participantId, joined, myScore, playSound]);

  // Game rules & buzzer sync
  useEffect(() => {
    if (!gameId || !isAuth) return;
    const unsub = onSnapshot(doc(db, 'games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Reset localHasClicked if question is cleared, or if someone else buzzed
        if (!data.activeQuestion || (data.firstBuzz && data.firstBuzz.participantId !== participantId)) {
          setLocalHasClicked(false);
        }

        setGameStatus(data);
      }
    });
    return () => unsub();
  }, [gameId, participantId, isAuth, gameStatus?.firstBuzz?.participantId, playSound]);

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

  const playPreview = () => {
    if (voiceUri) {
      const audio = new Audio(voiceUri);
      audio.play().catch(e => console.error("Preview failed:", e));
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 1024 * 1024) { // 1MB limit for safety
      alert("File too large. Please keep it under 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setVoiceUri(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleJoin = async (overrideName?: string, overrideVoice?: string) => {
    if (isJoining) return;
    const n = overrideName || name;
    const v = overrideVoice || voiceUri;

    if (!n.trim()) {
      alert("Please enter a name");
      return;
    }

    if (!gameId) {
      alert("Game ID missing from URL");
      return;
    }

    setIsJoining(true);
    
    // Check if lobby exists
    try {
      const gSnap = await getDoc(doc(db, 'games', gameId));
      if (!gSnap.exists()) {
        alert("This lobby does not exist. Please check the code or ask the host for a new one.");
        setIsJoining(false);
        return;
      }
    } catch (e) {
      console.error("Lobby check failed:", e);
    }
    
    if (!participantId) {
      // Regenerate if lost
      const pid = 'p-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
      localStorage.setItem('participantId', pid);
      setParticipantId(pid);
    }

    // Ensure auth is ready
    if (!isAuth) {
      try {
        await loginAnonymously();
        setIsAuth(true);
      } catch (e) {
        alert("Authentication failed. Please check your internet connection.");
        setIsJoining(false);
        return;
      }
    }
    
    // Save to session
    localStorage.setItem('participantName', n);
    localStorage.setItem('participantVoice', v || '');

    try {
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
      alert("Failed to join. Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsJoining(false);
    }
  };

  const buzzOut = async () => {
    if (!gameId || !gameStatus?.activeQuestion || gameStatus.firstBuzz || isSendingBuzz || localHasClicked) return;
    
    // Safety check: only buzz if typing is finished
    if (!gameStatus.typingFinished) return;

    // Check if I already buzzed wrong
    if (gameStatus?.wrongBuzzes?.includes(participantId)) return;
    // Check if answer is revealed
    if (gameStatus?.showAnswer) return;

    // Check timer locally just in case
    const qDetails = gameStatus.activeQuestion;
    if (qDetails.endTime && Date.now() > qDetails.endTime) {
      return; // Too late
    }
    
    setIsSendingBuzz(true);
    setLocalHasClicked(true);
    
    const avatarName = localStorage.getItem('participantName') || name;
    
    // Play buzzing local feedback instantly, even before server responds. 
    // This gives them instant satisfaction that they clicked.
    if (voiceUri) {
      const audio = new Audio(voiceUri);
      audio.play().catch(() => playSound('reveal'));
    } else {
      playSound('reveal');
    }

    const avatarUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarName)}&backgroundColor=transparent`;
    
    try {
      await runTransaction(db, async (transaction) => {
        const gRef = doc(db, 'games', gameId);
        const gSnap = await transaction.get(gRef);
        
        if (!gSnap.exists()) throw new Error("Game does not exist");
        const data = gSnap.data();
        
        if (data.firstBuzz) {
          // Someone already buzzed
          setLocalHasClicked(false);
          return;
        }

        transaction.update(gRef, {
          firstBuzz: {
            participantId,
            name: avatarName,
            avatarUrl,
            voiceUri,
            time: new Date().toISOString(),
            serverTime: new Date().toISOString(), // We could use serverTimestamp, but ISOString sorts well enough for client tracking
          }
        });
      });
    } catch (e) {
      console.error("Buzz transaction failed:", e);
      setLocalHasClicked(false);
    } finally {
      setIsSendingBuzz(false);
    }
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
            
            <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 flex flex-col items-center justify-center gap-4">
              <span className="text-sm font-medium text-slate-300 text-center">Your buzzer sound (Record or Upload)</span>
              
              <div className="flex items-center gap-4">
                {!recording ? (
                  <button 
                    onClick={startRecording}
                    className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-all text-slate-900 shadow-lg shadow-cyan-500/20"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                ) : (
                  <button 
                    onClick={stopRecording}
                    className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center transition-all animate-pulse text-white shadow-lg shadow-rose-500/20"
                  >
                    <Square className="w-5 h-5 fill-current" />
                  </button>
                )}

                <label className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-all cursor-pointer text-white">
                  <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                  <Plus className="w-6 h-6" />
                </label>
              </div>
              
              {voiceUri && !recording && (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1 rounded-full uppercase tracking-wider">Voice Clip Ready</div>
                  <button 
                    onClick={playPreview}
                    className="text-xs text-white/60 hover:text-white font-bold underline"
                  >
                    Preview Sound
                  </button>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => handleJoin()}
              disabled={!name.trim() || isJoining}
              className="w-full bg-cyan-500 text-slate-900 font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all mt-4 flex items-center justify-center gap-2"
            >
              {(isJoining || (!isAuth && name.trim())) && <Loader2 className="w-5 h-5 animate-spin" />}
              {isJoining ? 'Joining...' : (isAuth ? (localStorage.getItem('participantName') ? `Enter Lobby as ${localStorage.getItem('participantName')}` : 'Enter Lobby') : (name.trim() ? 'Connecting...' : 'Enter Name to Start'))}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isBuzzerActive = gameStatus?.activeQuestion && !gameStatus?.firstBuzz && gameStatus?.typingFinished;
  // If timer exceeded, they shouldn't be able to buzz
  let expired = false;
  if (isBuzzerActive && gameStatus.activeQuestion.endTime) {
    expired = Date.now() > gameStatus.activeQuestion.endTime;
  }
  
  const wasWrong = gameStatus?.wrongBuzzes?.includes(participantId);
  const isAnswerShown = gameStatus?.showAnswer;
  const canBuzz = isBuzzerActive && !expired && !wasWrong && !isAnswerShown && !localHasClicked;
  
  const iWonBuzz = gameStatus?.firstBuzz?.participantId === participantId || localHasClicked;
  const someoneElseWon = gameStatus?.firstBuzz && gameStatus.firstBuzz.participantId !== participantId;

  const buzzerColor = getBuzzerColor(participantId);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-between p-6 select-none overflow-hidden touch-manipulation relative">
      <AnimatePresence mode="wait">
        {scoreNotification && (
          <motion.div
            key={Date.now()}
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ exit: { duration: 0.2 } }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-6"
          >
            <motion.div 
              initial={{ rotate: -5 }}
              animate={{ rotate: 0 }}
              className={`relative overflow-hidden rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-4 border-white/20 p-1 bg-slate-900`}
            >
              <div className={`px-10 py-12 rounded-[2.2rem] flex flex-col items-center gap-4 ${scoreNotification.type === 'plus' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
                <div className="bg-white/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white">
                  {scoreNotification.type === 'plus' ? 'Point Scored' : 'Point Deducted'}
                </div>
                <div className="flex items-center gap-2 text-white text-7xl font-black tabular-nums">
                  {scoreNotification.type === 'plus' ? <Plus className="w-12 h-12" /> : <Minus className="w-12 h-12" />}
                  {scoreNotification.delta}
                </div>
                <div className="text-white/80 font-bold uppercase tracking-widest text-xs">
                  {scoreNotification.type === 'plus' ? 'Keep it up!' : 'Nice try!'}
                </div>
              </div>
              
              {/* Glass reflection effect */}
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            </motion.div>
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
        <div className="flex items-center bg-white/5 border border-white/10 p-2 rounded-xl">
          <div className="flex flex-col items-center px-4 py-1">
            <span className="text-amber-500/50 text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1">Score</span>
            <span className="text-amber-400 text-3xl font-black tabular-nums leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">{myScore ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {!gameStatus?.activeQuestion ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 bg-slate-800/80 rounded-[2rem] flex items-center justify-center mx-auto border border-white/5 shadow-inner">
                 <Gamepad2 className="w-10 h-10 text-slate-500/80" />
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
              onPointerDown={(e) => {
                e.preventDefault(); // Prevent double firing mouse/touch events
                buzzOut();
              }}
              disabled={!canBuzz && !localHasClicked}
              style={{ backgroundColor: canBuzz ? buzzerColor : undefined }}
              className={`w-[80vw] max-w-[320px] aspect-square rounded-full transition-all duration-300 transform active:scale-95 flex items-center justify-center select-none touch-none border-[12px] border-black/30 shadow-none
                ${iWonBuzz ? 'bg-emerald-500 border-white/10' : 
                someoneElseWon ? 'bg-slate-800 opacity-20 border-transparent saturate-0' : 
                canBuzz ? 'brightness-100 scale-100' : 
                'bg-slate-800 opacity-20 border-transparent saturate-0 scale-95'}`}
            >
              <div className="flex flex-col items-center justify-center">
                <span className={`text-3xl sm:text-4xl text-white font-black tracking-tighter uppercase text-center px-8 leading-tight transition-all ${!canBuzz && !iWonBuzz ? 'opacity-40' : 'opacity-100'}`}>
                  {iWonBuzz ? (localHasClicked && gameStatus?.firstBuzz?.participantId !== participantId ? 'BUZZED!' : 'YOUR TURN') : someoneElseWon ? 'TOO SLOW' : canBuzz ? 'BUZZ' : 'WAIT'}
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


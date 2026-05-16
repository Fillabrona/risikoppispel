import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth, loginAnonymously } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, getDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { Mic, Square, Loader2, Trophy, Minus, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactConfetti from 'react-confetti';
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
  const [cachedLeaderboard, setCachedLeaderboard] = useState<any[] | null>(null);
  const [kickReason, setKickReason] = useState<string | null>(null);
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
         if (joined) {
           setKickReason("You were removed by the host.");
         }
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

        if (data.status === 'leaderboard' && data.players) {
           setCachedLeaderboard(data.players);
        } else if (data.status === 'editor') {
           setCachedLeaderboard(null);
        }

        setGameStatus(data);
      } else {
        setGameStatus(null);
        // If host deleted the game, we will fallback to cachedLeaderboard if it exists
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
      
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const channelData = audioBuffer.getChannelData(0);
          let startOffset = 0;
          let endOffset = channelData.length;
          
          // Find first non-silent sample
          for (let i = 0; i < channelData.length; i++) {
            if (Math.abs(channelData[i]) > 0.05) {
              startOffset = i;
              break;
            }
          }
          
          // Pad start softly
          startOffset = Math.max(0, startOffset - Math.floor(audioContext.sampleRate * 0.05));
          
          for (let i = channelData.length - 1; i >= 0; i--) {
            if (Math.abs(channelData[i]) > 0.05) {
              endOffset = i + 1;
              break;
            }
          }
          
          endOffset = Math.min(channelData.length, endOffset + Math.floor(audioContext.sampleRate * 0.05));
          
          const trimmedLength = endOffset - startOffset;
          if (trimmedLength > 0 && startOffset < endOffset) {
            const trimmedBuffer = audioContext.createBuffer(
              audioBuffer.numberOfChannels,
              trimmedLength,
              audioBuffer.sampleRate
            );
            
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
              trimmedBuffer.copyToChannel(audioBuffer.getChannelData(i).slice(startOffset, endOffset), i);
            }
            
            const numOfChan = trimmedBuffer.numberOfChannels;
            const length = trimmedBuffer.length * numOfChan * 2 + 44;
            const buffer = new ArrayBuffer(length);
            const view = new DataView(buffer);
            
            const writeString = (view: DataView, offset: number, string: string) => {
              for (let i = 0; i < string.length; i++){
                view.setUint8(offset + i, string.charCodeAt(i));
              }
            };
            
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + trimmedBuffer.length * numOfChan * 2, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, numOfChan, true);
            view.setUint32(24, trimmedBuffer.sampleRate, true);
            view.setUint32(28, trimmedBuffer.sampleRate * 2 * numOfChan, true);
            view.setUint16(32, numOfChan * 2, true);
            view.setUint16(34, 16, true);
            writeString(view, 36, 'data');
            view.setUint32(40, trimmedBuffer.length * numOfChan * 2, true);
            
            let offset = 44;
            for (let i = 0; i < trimmedBuffer.length; i++) {
              for (let channel = 0; channel < numOfChan; channel++) {
                let sample = trimmedBuffer.getChannelData(channel)[i];
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
              }
            }
            
            const trimmedBlob = new Blob([view], { type: 'audio/wav' });
            const reader = new FileReader();
            reader.readAsDataURL(trimmedBlob);
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                setVoiceUri(reader.result);
              }
            };
          } else {
             const reader = new FileReader();
             reader.readAsDataURL(audioBlob);
             reader.onloadend = () => {
               if (typeof reader.result === 'string') setVoiceUri(reader.result);
             };
          }
        } catch (e) {
           console.error("Audio trim failed:", e);
           const reader = new FileReader();
           reader.readAsDataURL(audioBlob);
           reader.onloadend = () => {
             if (typeof reader.result === 'string') setVoiceUri(reader.result);
           };
        }
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
    playSound('reveal');

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

  if (cachedLeaderboard) {
    const sorted = [...cachedLeaderboard].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.id === participantId) + 1;
    const myInfo = sorted.find(p => p.id === participantId);

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 space-y-8 select-none">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-black text-white uppercase tracking-widest text-center text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-yellow-600">Game Over</h1>
          {myRank > 0 && <span className="text-white/60 font-medium">You finished in #{myRank} place!</span>}
        </div>

        <div className="w-full max-w-sm space-y-3">
          {sorted.slice(0, 3).map((p, i) => (
            <div key={p.id} className={`flex items-center gap-4 p-4 rounded-2xl ${p.id === participantId ? 'bg-cyan-500/20 border border-cyan-500/50' : 'bg-white/5 border border-white/5'}`}>
               <div className="flex-none font-black text-xl text-white/40 w-6 text-center">{i + 1}</div>
               <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(p.name)}`} alt="" className="w-10 h-10 rounded-full bg-slate-800" />
               <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{p.name}</div>
               </div>
               <div className="font-black text-xl text-white tabular-nums">{p.score}</div>
            </div>
          ))}
        </div>
        <button 
          onClick={async () => {
            setJoined(false);
            setCachedLeaderboard(null);
            if (gameId && participantId) {
              const pRef = doc(db, 'games', gameId, 'participants', participantId);
              await deleteDoc(pRef).catch(() => {});
            }
          }}
          className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all text-sm uppercase tracking-wider"
        >
          Exit Room
        </button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        {kickReason && (
          <div className="w-full max-w-sm mb-4 bg-red-500/10 border border-red-500/50 text-red-500 text-center font-bold px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-4">
            {kickReason}
          </div>
        )}
        <div className="bg-slate-800 p-8 rounded-[2rem] w-full max-w-sm space-y-8 shadow-2xl border border-white/5">
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-black text-white uppercase tracking-tight">Join Game</h1>
            <p className="text-slate-400 font-medium text-sm">Enter the lobby to start playing!</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">Nickname</label>
              <input 
                type="text"
                placeholder="ex. QuizMaster"
                maxLength={12}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-900/50 text-white rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-cyan-500 font-bold border border-slate-700/50 placeholder:text-slate-600 transition-all"
              />
            </div>
            
            <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center z-10">Buzzer Sound (Optional)</span>
              
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
                    className="px-4 py-2 mt-1 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center shadow-md border border-slate-600"
                  >
                    Preview Sound
                  </button>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => handleJoin()}
              disabled={!name.trim() || isJoining}
              className="w-full bg-cyan-500 text-slate-900 font-black py-4 rounded-2xl disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-cyan-400 hover:shadow-cyan-500/30"
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
  const wasTimedOut = gameStatus?.timedOutPlayers?.includes(participantId);
  const isAnswerShown = gameStatus?.showAnswer;
  const canBuzz = isBuzzerActive && !expired && !wasWrong && !isAnswerShown && !localHasClicked;
  
  const iWonBuzz = gameStatus?.firstBuzz?.participantId === participantId;
  const someoneElseWon = gameStatus?.firstBuzz && gameStatus.firstBuzz.participantId !== participantId;
  const isPendingBuzz = localHasClicked && !gameStatus?.firstBuzz;
  const isSkipped = isAnswerShown && !gameStatus?.firstBuzz;

  const buzzerColor = getBuzzerColor(participantId);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-between p-6 select-none overflow-hidden touch-manipulation relative">
      <AnimatePresence>
        {scoreNotification && (
          <motion.div
            key={Date.now()}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-32 left-0 right-0 z-[100] flex items-center justify-center pointer-events-none px-6"
          >
            <motion.div 
              className={`relative overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border-4 border-white/10 p-1 bg-slate-900`}
            >
              <div className={`px-8 py-5 rounded-[1.3rem] flex items-stretch gap-6 ${scoreNotification.type === 'plus' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
                <div className="flex flex-col justify-center">
                  <div className="bg-white/20 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-white w-fit mb-1">
                    {scoreNotification.type === 'plus' ? 'Score' : 'Penalty'}
                  </div>
                  <div className="text-white font-bold uppercase tracking-widest text-[10px] opacity-80">
                    {scoreNotification.type === 'plus' ? 'Keep it up!' : (wasTimedOut ? 'Too slow!' : 'Nice try!')}
                  </div>
                </div>
                
                <div className="w-px bg-white/20 my-1" />
                
                <div className="flex items-center gap-1 text-white text-5xl font-black tabular-nums">
                  {scoreNotification.type === 'plus' ? <Plus className="w-8 h-8" /> : <Minus className="w-8 h-8" />}
                  {scoreNotification.delta}
                </div>
              </div>
              
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

      <div className="flex-1 flex flex-col items-center justify-center w-full relative">
        {/* Rear Confetti Layer */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <AnimatePresence>
            {scoreNotification && scoreNotification.type === 'plus' && (
              <ReactConfetti 
                width={window.innerWidth}
                height={window.innerHeight}
                numberOfPieces={150}
                recycle={false}
                gravity={0.1}
                colors={[buzzerColor, '#ffffff', '#ffd700']}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="relative group z-10">
          {/* Visual indicator of "can buzz" state without outer glow */}
          <button
            onPointerDown={(e) => {
              e.preventDefault(); // Prevent double firing mouse/touch events
              buzzOut();
            }}
            disabled={!canBuzz && !localHasClicked}
            style={{ backgroundColor: (canBuzz || !gameStatus?.activeQuestion) ? buzzerColor : undefined }}
            className={`w-[80vw] max-w-[320px] aspect-square rounded-full transition-all duration-300 transform active:scale-95 flex items-center justify-center select-none touch-none border-[12px] border-black/30 shadow-none
              ${iWonBuzz ? 'bg-emerald-500 border-white/10' : 
              someoneElseWon ? 'bg-slate-800 opacity-20 border-transparent saturate-0' : 
              wasTimedOut ? 'bg-rose-900 border-rose-500/50 scale-95' :
              isSkipped ? 'bg-slate-800 opacity-40 border-transparent saturate-0 scale-95' :
              isPendingBuzz ? 'bg-slate-700 opacity-50 border-white/5 saturate-0 scale-95' :
              (!gameStatus?.activeQuestion) ? 'brightness-100 scale-100 opacity-80' :
              canBuzz ? 'brightness-100 scale-100' : 
              'bg-slate-800 opacity-20 border-transparent saturate-0 scale-95'}`}
          >
            <div className="flex flex-col items-center justify-center">
              <span className={`text-3xl sm:text-4xl text-white font-black tracking-tighter uppercase text-center px-8 leading-tight transition-all ${(!canBuzz && !iWonBuzz && !isPendingBuzz && !isSkipped && gameStatus?.activeQuestion) ? 'opacity-40' : 'opacity-100'}`}>
                {!gameStatus?.activeQuestion ? 'WAITING...' : iWonBuzz ? 'YOUR TURN' : someoneElseWon ? 'TOO SLOW' : wasTimedOut ? 'TIMED OUT (BLOCKED)' : isSkipped ? 'SKIPPED!' : isPendingBuzz ? 'BUZZED!' : canBuzz ? 'BUZZ' : 'WAIT'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full flex justify-center py-4" />
    </div>
  );
}


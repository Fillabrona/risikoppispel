import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db, loginAnonymously } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { Mic, Square } from 'lucide-react';

export default function BuzzerView() {
  const { gameId } = useParams();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [gameStatus, setGameStatus] = useState<any>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [myBuzz, setMyBuzz] = useState(false);
  
  const [recording, setRecording] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string>('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    loginAnonymously();
    const pid = localStorage.getItem('participantId') || Math.random().toString(36).substring(2, 9);
    localStorage.setItem('participantId', pid);
    setParticipantId(pid);
  }, []);

  useEffect(() => {
    if (!gameId) return;
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
  }, [gameId, participantId]);

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
              disabled={!name.trim() || !voiceUri}
              className="w-full bg-cyan-500 text-slate-900 font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all mt-4"
            >
              Enter Lobby
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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 select-none overflow-hidden touch-manipulation">
      {!gameStatus?.activeQuestion ? (
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-white tracking-widest uppercase">Lobby</h2>
          <p className="text-slate-400 font-medium">Waiting for host to select question...</p>
        </div>
      ) : (
        <button
          onClick={buzzOut}
          disabled={!canBuzz}
          className={`w-[85vw] max-w-sm aspect-square rounded-full shadow-2xl transition-all transform active:scale-90 flex items-center justify-center select-none touch-none
            ${iWonBuzz ? 'bg-emerald-500 shadow-emerald-500/50' : 
            someoneElseWon ? 'bg-slate-700 opacity-50 shadow-none' : 
            canBuzz ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/50 active:shadow- rose-500/20 active:bg-rose-600' : 
            'bg-slate-700 opacity-50 shadow-none'}`}
        >
          <div className="flex flex-col items-center justify-center">
            <span className="text-4xl sm:text-5xl text-white font-black tracking-tighter uppercase drop-shadow-md">
              {iWonBuzz ? 'YOUR TURN' : someoneElseWon ? 'TOO SLOW' : canBuzz ? 'BUZZ' : 'TIME UP'}
            </span>
          </div>
        </button>
      )}
    </div>
  );
}

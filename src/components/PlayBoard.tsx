import { useState, useEffect, useRef } from 'react';
import { GameState, Question } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Minimize, Settings, X, Volume2, VolumeX, Trophy, Medal, Award, QrCode, ZoomIn, ZoomOut } from 'lucide-react';
import React from 'react';
import { useSound } from '../hooks/useSound';
import Confetti from 'react-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, loginAnonymously } from '../lib/firebase';

interface PlayBoardProps {
  gameState: GameState;
  hooks: any;
  onEdit: () => void;
  isMuted: boolean;
  setIsMuted: (val: boolean | ((p: boolean) => boolean)) => void;
  gameId?: string;
}

const TypewriterText = ({ text, onComplete }: { text: string; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, 35);
    return () => clearInterval(interval);
  }, [text]);

  return <>{displayedText}</>;
};

const SmartHeader = ({ text }: { text: string }) => {
  const getFontSize = (str: string) => {
    if (str.length < 12) return 'text-xl sm:text-2xl lg:text-3xl';
    if (str.length < 18) return 'text-lg sm:text-xl lg:text-2xl';
    if (str.length < 25) return 'text-base sm:text-lg lg:text-xl';
    return 'text-sm sm:text-base lg:text-lg';
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-2 text-center overflow-hidden">
      <h2 className={`font-black uppercase tracking-widest leading-[1.1] ${getFontSize(text)} break-words max-w-full drop-shadow-sm`}>
        {text}
      </h2>
    </div>
  );
};

export default function PlayBoard({ gameState, hooks, onEdit, isMuted, setIsMuted, gameId }: PlayBoardProps) {
  const [activeQuestion, setActiveQuestion] = useState<{
    catId: string;
    question: Question;
  } | null>(null);
  const [displayStage, setDisplayStage] = useState<'bonus_intro' | 'question' | 'answer'>('question');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { playSound } = useSound(isMuted);
  const [timerValue, setTimerValue] = useState<number | null>(null);
  const [triggeredBonusIds, setTriggeredBonusIds] = useState<Set<string>>(new Set());
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Hosted Game Logic
  // const [gameId, setGameId] = useState<string>('');
  const [showQR, setShowQR] = useState(false);
  const [boardScale, setBoardScale] = useState(1);
  const [hostParams, setHostParams] = useState<any>(null);
  const firstBuzzRef = useRef<any>(null);

  // Hosted Game Logic - Run once on gameId initialization
  useEffect(() => {
    if (!gameId) return;
    const gRef = doc(db, 'games', gameId);
    // Ensure game status is playing when board is first mounted
    setDoc(gRef, { status: 'playing', activeQuestion: null, firstBuzz: null }, { merge: true });
  }, [gameId]);

  // Handle Host Updates & Buzzes
  useEffect(() => {
    if (!gameId) return;
    const gRef = doc(db, 'games', gameId);

    const unsub = onSnapshot(gRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHostParams(data);
        
        // Handle new buzzes
        if (data.firstBuzz && (!firstBuzzRef.current || firstBuzzRef.current.time !== data.firstBuzz.time)) {
          firstBuzzRef.current = data.firstBuzz;
          if (data.firstBuzz.voiceUri) {
            const audio = new Audio(data.firstBuzz.voiceUri);
            audio.play().catch(e => console.error("Voice playback failed:", e));
          } else {
            playSound('award'); // fallback if no voice
          }
        } else if (!data.firstBuzz) {
          firstBuzzRef.current = null;
        }
      }
    });
    return () => unsub();
  }, [gameId, playSound]);

  const allAnswered = gameState.categories.length > 0 && gameState.categories.every(cat => cat.questions.length > 0 && cat.questions.every(q => q.isAnswered));

  // Timer logic
  useEffect(() => {
    if (activeQuestion && displayStage === 'question' && gameState.settings?.timerEnabled && timerValue !== null && timerValue > 0) {
      const interval = setInterval(() => {
        setTimerValue((t) => (t !== null && t > 0 ? t - 1 : t));
      }, 1000);
      return () => clearInterval(interval);
    } else if (activeQuestion && displayStage === 'question' && gameState.settings?.timerEnabled && timerValue === 0) {
      // If someone has buzzed but didn't answer, penalize them
      if (hostParams?.firstBuzz) {
        handleDeductPoints(hostParams.firstBuzz.participantId, activeQuestion.question.bonusPoints || activeQuestion.question.points);
      } else {
        playSound('penalize');
        // No one answered, just reveal answer or wait
      }
    }
  }, [activeQuestion, displayStage, timerValue, gameState.settings?.timerEnabled, playSound, hostParams?.firstBuzz, handleDeductPoints]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        playSound('click');
        setIsMuted(m => !m);
        return;
      }

      if (activeQuestion) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (displayStage === 'bonus_intro') {
            playSound('reveal');
            setDisplayStage('question');
          } else if (displayStage === 'question') {
            playSound('reveal');
            setDisplayStage('answer');
          }
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          playSound('click');
          closeQuestion();
        }
        
        if (displayStage === 'answer') {
          const playerIndex = parseInt(e.key) - 1;
          if (playerIndex >= 0 && playerIndex < gameState.players.length) {
            handleAwardPoints(gameState.players[playerIndex].id, activeQuestion.question.bonusPoints || activeQuestion.question.points);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestion, displayStage, gameState.players]);

  const toggleFullscreen = () => {
    playSound('click');
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const openQuestion = async (catId: string, question: Question) => {
    if (question.isAnswered) return;
    playSound('select');
    setActiveQuestion({ catId, question });
    setDisplayStage(question.isBonus ? 'bonus_intro' : 'question');
    
    if (gameState.settings?.timerEnabled) {
      setTimerValue(gameState.settings.timerDuration);
    } else {
      setTimerValue(null);
    }

    if (gameId) {
      const gRef = doc(db, 'games', gameId);
      await updateDoc(gRef, {
        activeQuestion: { 
          id: question.id, 
          endTime: gameState.settings?.timerEnabled ? Date.now() + gameState.settings.timerDuration * 1000 : null 
        },
        firstBuzz: null,
        typingFinished: false
      });
    }
  };

  async function closeQuestion() {
    if (activeQuestion) {
      hooks.setQuestionAnswered(activeQuestion.catId, activeQuestion.question.id, true);
    }
    setActiveQuestion(null);
    setDisplayStage('question');

    if (gameId) {
      const gRef = doc(db, 'games', gameId);
      await setDoc(gRef, { activeQuestion: null, firstBuzz: null, showAnswer: false, wrongBuzzes: [], typingFinished: false }, { merge: true });
    }
  }

  function handleAwardPoints(playerId: string, points: number) {
    playSound('award');
    
    // Sync to Firestore for BuzzerView notification. 
    // The host's local state will be updated by the listener in App.tsx to avoid doubling.
    if (gameId) {
      const pRef = doc(db, 'games', gameId, 'participants', playerId);
      const currentPlayer = gameState.players.find(p => p.id === playerId);
      const newScore = (currentPlayer?.score || 0) + points;
      setDoc(pRef, { score: newScore }, { merge: true });
    }

    closeQuestion();
  }

  function handleDeductPoints(playerId: string, points: number) {
    playSound('penalize');
    
    if (gameId) {
       // Sync to Firestore
       const pRef = doc(db, 'games', gameId, 'participants', playerId);
       const currentPlayer = gameState.players.find(p => p.id === playerId);
       const newScore = (currentPlayer?.score || 0) - points;
       setDoc(pRef, { score: newScore }, { merge: true });

       // Clear the buzz to let someone else try, but track who got it wrong
       const gRef = doc(db, 'games', gameId);
       getDoc(gRef).then(snap => {
         const data = snap.data();
         const wrong = data?.wrongBuzzes || [];
         if (!wrong.includes(playerId)) wrong.push(playerId);
         setDoc(gRef, { firstBuzz: null, wrongBuzzes: wrong }, { merge: true });
       });
    }
  }

  const gridCategories = React.useMemo(() => {
    return gameState.categories.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => !q.isBonus)
    }));
  }, [gameState.categories]);

  const catsCount = gridCategories.length;
  const maxQuestionsPerRow = Math.max(
    ...gridCategories.map((c) => c.questions.length),
    1
  );

  const [triggerCheckQueue, setTriggerCheckQueue] = useState<{catId: string, question: Question}[]>([]);

  useEffect(() => {
    if (activeQuestion) return;
    
    if (triggerCheckQueue.length > 0) {
      const nextQ = triggerCheckQueue[0];
      setTriggerCheckQueue(q => q.slice(1));
      setTimeout(() => {
        playSound('select');
        setActiveQuestion({ catId: nextQ.catId, question: nextQ.question });
        setDisplayStage('bonus_intro');
      }, 500);
      return;
    }

    // Row Clear Logic
    let clearedRowsCount = 0;
    for (let r = 0; r < maxQuestionsPerRow; r++) {
      let isRowCleared = true;
      let hasQuestionsInRow = false;
      for (const cat of gridCategories) {
        const q = cat.questions[r];
        if (q) {
          hasQuestionsInRow = true;
          if (!q.isAnswered) {
            isRowCleared = false;
            break;
          }
        }
      }
      if (hasQuestionsInRow && isRowCleared) {
        clearedRowsCount++;
      }
    }

    const rowClearBonuses = gameState.categories.flatMap(c => 
      c.questions.filter(q => q.isBonus && q.bonusTrigger === 'row_clear' && !triggeredBonusIds.has(q.id))
      .map(q => ({catId: c.id, question: q}))
    );
    
    const totalRowClearBonusesForThisState = gameState.categories.flatMap(c => 
      c.questions.filter(q => q.isBonus && q.bonusTrigger === 'row_clear')
    ).length;

    const answeredRowClearCount = gameState.categories.flatMap(c => 
      c.questions.filter(q => q.isBonus && q.bonusTrigger === 'row_clear' && q.isAnswered)
    ).length;

    if (clearedRowsCount > answeredRowClearCount && rowClearBonuses.length > 0) {
      const toTrigger = rowClearBonuses[0];
      setTriggeredBonusIds(prev => new Set(prev).add(toTrigger.question.id));
      setTriggerCheckQueue(q => [...q, toTrigger]);
      return;
    }

    // Check all_clear
    const isAllCleared = gridCategories.every(cat => cat.questions.every(q => q.isAnswered));
    if (isAllCleared) {
      const allClearBonuses = gameState.categories.flatMap(c => 
        c.questions.filter(q => q.isBonus && q.bonusTrigger === 'all_clear' && !triggeredBonusIds.has(q.id))
        .map(q => ({catId: c.id, question: q}))
      );
      if (allClearBonuses.length > 0) {
        setTriggeredBonusIds(prev => new Set(prev).add(allClearBonuses[0].question.id));
        setTriggerCheckQueue(q => [...q, allClearBonuses[0]]);
      }
    }
  }, [gameState.categories, activeQuestion, triggerCheckQueue, maxQuestionsPerRow, gridCategories, playSound, triggeredBonusIds]);

  useEffect(() => {
    if (allAnswered && gameId && !activeQuestion) {
       setDoc(doc(db, 'games', gameId), { 
         status: 'finished', 
         players: gameState.players 
       }, { merge: true });
    }
  }, [allAnswered, gameId, activeQuestion, gameState.players]);

  return (
    <div 
      ref={containerRef}
      className="w-screen h-screen overflow-hidden flex flex-col font-display selection:bg-white/30 relative"
      style={{ 
        background: gameState.theme.boardBg,
        '--color-cell-bg': gameState.theme.cellBg,
        '--color-cell-bg-answered': gameState.theme.cellBgAnswered,
        '--color-cell-text': gameState.theme.cellText,
        '--color-header-bg': gameState.theme.headerBg,
        '--color-header-text': gameState.theme.headerText,
        '--color-active-bg': gameState.theme.activeBg,
        '--color-active-text': gameState.theme.activeText,
      } as React.CSSProperties}
    >
      {/* Top Bar Navigation */}
      <div className="absolute top-0 right-0 p-4 flex gap-2 z-50 opacity-30 hover:opacity-100 transition-opacity duration-300">
        <button onClick={() => { playSound('click'); setBoardScale(s => Math.min(s + 0.1, 2)); }} className="bg-black/30 hover:bg-black/50 p-2.5 rounded-xl text-white transition-all">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => { playSound('click'); setBoardScale(s => Math.max(s - 0.1, 0.5)); }} className="bg-black/30 hover:bg-black/50 p-2.5 rounded-xl text-white transition-all">
          <ZoomOut className="w-5 h-5" />
        </button>
        <button onClick={() => { playSound('click'); setShowQR(v => !v); }} className="bg-black/30 hover:bg-black/50 p-2.5 rounded-xl text-white transition-all">
          <QrCode className="w-5 h-5" />
        </button>
        <button onClick={() => { playSound('click'); setIsMuted(m => !m); }} className="bg-black/30 hover:bg-black/50 p-2.5 rounded-xl text-white transition-all">
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <button onClick={toggleFullscreen} className="bg-black/30 hover:bg-black/50 p-2.5 rounded-xl text-white transition-all">
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
        <button onClick={() => { playSound('click'); onEdit(); }} className="bg-black/30 hover:bg-black/50 p-2.5 rounded-xl text-white transition-all">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ ease: "easeOut", duration: 0.2 }}
              className="bg-slate-900 p-12 rounded-[2.5rem] border border-slate-700/50 flex flex-col items-center relative shadow-2xl"
            >
              <button 
                onClick={() => setShowQR(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest text-center">Join Lobby</h2>
              <div className="p-4 bg-white rounded-2xl shadow-xl">
                <QRCodeSVG 
                  value={`${window.location.origin}${window.location.pathname}#/buzzer/${gameId}`} 
                  size={260} 
                  level="H"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hostParams?.firstBuzz && activeQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[80] bg-emerald-500 rounded-3xl p-6 shadow-2xl flex items-center gap-6 border-4 border-white/20"
          >
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-emerald-900/20 border-2 border-white/30 shrink-0">
              <img 
                src={hostParams.firstBuzz.avatarUrl || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(hostParams.firstBuzz.name)}&backgroundColor=transparent`} 
                alt="" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col text-white mr-4">
              <span className="text-emerald-100 font-bold tracking-widest uppercase text-sm mb-1">First to Buzz</span>
              <span className="text-4xl font-black tracking-tight">{hostParams.firstBuzz.name}</span>
            </div>
            
            <div className="flex gap-2 border-l-2 border-emerald-400 pl-6 ml-2">
               <button
                 onClick={() => {
                   // Ensure player exists in local state
                   if (!gameState.players.find(p => p.id === hostParams.firstBuzz.participantId)) {
                     hooks.addPlayer(hostParams.firstBuzz.name, hostParams.firstBuzz.participantId);
                   }
                   setTimeout(() => {
                     const pId = hostParams.firstBuzz.participantId;
                     handleAwardPoints(pId, activeQuestion.question.bonusPoints || activeQuestion.question.points);
                   }, 100);
                 }}
                 className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all"
               >
                 Correct (+{activeQuestion.question.bonusPoints || activeQuestion.question.points})
               </button>
               <button
                 onClick={() => {
                   if (!gameState.players.find(p => p.id === hostParams.firstBuzz.participantId)) {
                     hooks.addPlayer(hostParams.firstBuzz.name, hostParams.firstBuzz.participantId);
                   }
                   setTimeout(() => {
                     const pId = hostParams.firstBuzz.participantId;
                     handleDeductPoints(pId, activeQuestion.question.bonusPoints || activeQuestion.question.points);
                   }, 100);
                 }}
                 className="bg-rose-700 hover:bg-rose-600 active:scale-95 text-white font-bold py-3 px-6 rounded-xl transition-all"
               >
                 Incorrect
               </button>
               <button
                 onClick={() => {
                   playSound('penalize');
                   if (gameId) {
                     const gRef = doc(db, 'games', gameId);
                     const pId = hostParams.firstBuzz.participantId;
                     const wrong = hostParams.wrongBuzzes || [];
                     if (!wrong.includes(pId)) wrong.push(pId);
                     setDoc(gRef, { firstBuzz: null, wrongBuzzes: wrong }, { merge: true });
                   }
                 }}
                 className="bg-black/30 hover:bg-black/50 active:scale-95 text-white font-bold py-3 px-6 rounded-xl transition-all"
               >
                 Skip
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Title Display */}
      {gameState.title && (
        <div className="w-full flex-none flex items-center justify-center h-16 pointer-events-none z-10 border-b border-white/5 bg-black/10 backdrop-blur-sm">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-widest uppercase text-white/90 drop-shadow-md leading-none mt-[2px]">
            {gameState.title}
          </h1>
        </div>
      )}

      {/* Main Board Area */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 flex items-stretch justify-center min-h-0 z-10 mb-2 mt-4 relative overflow-hidden">
        <div 
          className="w-full h-full grid gap-2 sm:gap-3 transition-transform duration-300 origin-center" 
          style={{ 
            gridTemplateColumns: `repeat(${catsCount}, 1fr)`,
            gridTemplateRows: `auto repeat(${maxQuestionsPerRow}, 1fr)`,
            transform: `scale(${boardScale})`
          }}
        >
          {/* Headers */}
          {gridCategories.map((cat) => (
              <div 
                key={cat.id} 
                className="flex items-center justify-center rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden h-16 sm:h-20 lg:h-24"
                style={{ background: 'var(--color-header-bg)', color: 'var(--color-header-text)' }}
              >
                <SmartHeader text={cat.name} />
              </div>
          ))}

          {/* Grid Cells (Questions) */}
          {Array.from({ length: maxQuestionsPerRow }).map((_, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {gridCategories.map((cat) => {
                const q = cat.questions[rowIndex];
                if (!q) return <div key={`empty-${cat.id}-${rowIndex}`} />;
                
                return (
                    <button
                    key={q.id}
                    tabIndex={-1}
                    onMouseEnter={() => playSound('click')}
                    onClick={() => openQuestion(cat.id, q)}
                    disabled={q.isAnswered}
                    className="relative flex items-center justify-center p-2 rounded-xl transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-white/50 group overflow-hidden border border-white/10"
                    style={{ 
                      background: q.isAnswered ? 'var(--color-cell-bg-answered)' : 'var(--color-cell-bg)',
                      color: 'var(--color-cell-text)',
                      opacity: q.isAnswered ? 0.3 : 1,
                    }}
                  >
                    {!q.isAnswered && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />}
                    <span className={`font-extrabold text-3xl sm:text-4xl lg:text-5xl xl:text-6xl tracking-tight z-10 drop-shadow-md ${q.isAnswered ? 'opacity-0' : 'opacity-100'}`}>
                      {q.points}
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Players Scoreboard Area */}
      <div className="h-auto min-h-[140px] px-6 py-6 flex gap-4 overflow-x-auto no-scrollbar items-end justify-center z-10">
        {gameState.players.map((player, idx) => (
          <div 
            key={player.id}
            className="flex-1 max-w-sm flex flex-col items-center justify-center bg-black/60 border border-white/10 rounded-2xl p-4 text-white relative group overflow-hidden transition-all backdrop-blur-md"
          >
            {/* Background Avatar Layer */}
            <div className="absolute inset-0 pointer-events-none opacity-40 group-hover:opacity-20 transition-opacity mix-blend-lighten overflow-hidden rounded-2xl">
              <img 
                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=transparent`} 
                alt="" 
                className="absolute -right-2 bottom-0 h-full object-contain object-right-bottom drop-shadow-lg" 
              />
            </div>
            
            {/* Gradient Overlay for Fade to Black */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
            
            <div className="z-10 relative pt-2 text-sm sm:text-base lg:text-lg font-bold uppercase tracking-widest w-full text-center mb-1 text-slate-100 line-clamp-1 drop-shadow-sm">
              {player.name}
            </div>
            <div className="z-10 relative text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums tracking-tighter text-amber-400 drop-shadow-md">
              {player.score}
            </div>
            
            {/* Quick adjusters overlay */}
            <div className="absolute inset-0 bg-slate-900/95 z-20 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
               <button onClick={() => { 
                 playSound('award'); 
                 if (gameId) {
                   const pRef = doc(db, 'games', gameId, 'participants', player.id);
                   setDoc(pRef, { score: (player.score || 0) + 100 }, { merge: true });
                 }
               }} className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg hover:bg-emerald-400 active:scale-95 transition-all text-emerald-950">+100</button>
               <button onClick={() => { 
                 playSound('penalize'); 
                 if (gameId) {
                   const pRef = doc(db, 'games', gameId, 'participants', player.id);
                   setDoc(pRef, { score: (player.score || 0) - 100 }, { merge: true });
                 }
               }} className="w-14 h-14 bg-rose-500 rounded-full flex items-center justify-center font-bold text-lg hover:bg-rose-400 active:scale-95 transition-all text-rose-950">-100</button>
            </div>
          </div>
        ))}
      </div>

      {/* Active Question Modal */}
      <AnimatePresence>
        {activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex flex-col p-6 sm:p-12 lg:p-20 backdrop-blur-3xl"
            style={{ 
              background: 'var(--color-active-bg)',
              color: 'var(--color-active-text)'
            }}
          >
            <button 
              onClick={() => { playSound('click'); closeQuestion(); }}
              className="absolute top-8 right-8 p-3 rounded-full bg-black/20 hover:bg-black/40 border border-white/10 transition-all z-20 active:scale-95 text-white"
            >
              <X className="w-8 h-8" />
            </button>

            {gameState.settings?.timerEnabled && timerValue !== null && displayStage === 'question' && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-black/40 border border-white/10 rounded-2xl flex items-center gap-4 shadow-xl z-20 backdrop-blur-md">
                <span className={`text-4xl font-mono font-black tabular-nums tracking-widest ${timerValue <= 5 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                  {timerValue.toString().padStart(2, '0')}
                </span>
              </div>
            )}

            <div 
              className="flex-1 flex items-center justify-center z-10" 
              onClick={() => {
                if (displayStage === 'bonus_intro') {
                  playSound('reveal');
                  setDisplayStage('question');
                } else if (displayStage === 'question') {
                  playSound('reveal');
                  setDisplayStage('answer');
                  if (gameId) {
                    setDoc(doc(db, 'games', gameId), { showAnswer: true }, { merge: true });
                  }
                }
              }}
            >
              <div className="text-center w-full max-w-7xl mx-auto px-4 cursor-pointer group flex flex-col items-center">
                  <motion.div 
                    key={displayStage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="font-bold tracking-tight uppercase leading-tight text-center"
                    style={{
                      fontSize: displayStage === 'bonus_intro' ? '' : 
                        activeQuestion.question[displayStage === 'answer' ? 'answerText' : 'questionText'].length > 150 ? 'clamp(1rem, 3vw, 2.2rem)' :
                        activeQuestion.question[displayStage === 'answer' ? 'answerText' : 'questionText'].length > 100 ? 'clamp(1.5rem, 4vw, 3.2rem)' :
                        activeQuestion.question[displayStage === 'answer' ? 'answerText' : 'questionText'].length > 60 ? 'clamp(2rem, 5vw, 4.8rem)' :
                        'clamp(2.5rem, 7vw, 8rem)'
                    }}
                  >
                  {displayStage === 'bonus_intro' ? (
                    <div className="flex flex-col items-center justify-center space-y-8 bg-white text-black px-12 py-16 sm:px-24 sm:py-24 rounded-3xl" style={{ boxShadow: 'inset 0 0 0 8px currentColor' }}>
                      <span className="text-7xl sm:text-9xl lg:text-[11rem] font-sans font-black tracking-tighter leading-none text-black">
                        BONUS
                      </span>
                      <div className="px-8 py-3 border-4 border-black font-mono font-black text-4xl sm:text-6xl text-black flex items-center justify-center pointer-events-none">
                        +{activeQuestion.question.bonusPoints || activeQuestion.question.points * 2}
                      </div>
                    </div>
                  ) : displayStage === 'answer' ? (
                    <span className="text-amber-300 drop-shadow-lg">
                      <TypewriterText text={activeQuestion.question.answerText} />
                    </span>
                  ) : (
                    <span className="drop-shadow-lg">
                      <TypewriterText 
                        text={activeQuestion.question.questionText} 
                        onComplete={() => {
                          if (gameId) {
                            setDoc(doc(db, 'games', gameId), { typingFinished: true }, { merge: true });
                          }
                        }}
                      />
                    </span>
                  )}
                </motion.div>
                
                {displayStage !== 'answer' && (
                  <div className="mt-16 flex flex-col items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="px-6 py-2 border border-white/20 rounded-xl bg-white/5 backdrop-blur-md font-mono text-sm tracking-widest font-bold shadow-[0_4px_0_rgba(255,255,255,0.1)] group-hover:shadow-[0_2px_0_rgba(255,255,255,0.1)] group-hover:translate-y-[2px] transition-all">
                      SPACE
                    </div>
                    <p className="text-white/50 uppercase tracking-[0.2em] text-xs font-bold">
                      Reveal {displayStage === 'bonus_intro' ? 'Question' : 'Answer'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Judging Area (Below question/answer) */}
            {displayStage === 'answer' && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="w-full max-w-screen-2xl mx-auto grid mt-8 gap-4 z-10"
                style={{ gridTemplateColumns: `repeat(${gameState.players.length + 1}, 1fr)` }}
              >
                {gameState.players.map((player) => (
                  <div key={player.id} className="flex flex-col gap-3 group/judge">
                     <button
                      onClick={() => handleAwardPoints(player.id, activeQuestion.question.bonusPoints || activeQuestion.question.points)}
                      className="w-full py-6 sm:py-8 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xl sm:text-2xl lg:text-3xl rounded-2xl active:translate-y-1 transition-all uppercase tracking-wider relative overflow-hidden shadow-xl"
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/judge:opacity-100 transition-opacity"></div>
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {player.name} <span className="text-emerald-900/50">+</span>
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeductPoints(player.id, activeQuestion.question.bonusPoints || activeQuestion.question.points)}
                      className="w-full py-4 bg-black/40 hover:bg-rose-500/80 text-rose-200 hover:text-white font-bold text-base sm:text-lg rounded-xl border border-white/10 transition-all uppercase tracking-widest overflow-hidden shadow-lg"
                    >
                      Penalize (-{activeQuestion.question.bonusPoints || activeQuestion.question.points})
                    </button>
                  </div>
                ))}
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { playSound('click'); closeQuestion(); }}
                    className="w-full h-full min-h-[120px] bg-slate-700 hover:bg-slate-600 text-slate-200 font-black text-xl sm:text-2xl rounded-2xl active:translate-y-1 transition-all uppercase tracking-wider flex items-center justify-center overflow-hidden shadow-xl"
                  >
                    <span>Nobody <br/><span className="text-base opacity-50">/ Skip</span></span>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory Screen */}
      <AnimatePresence>
        {allAnswered && !activeQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-8 backdrop-blur-3xl bg-slate-900/90 text-white"
          >
            <Confetti 
              width={window.innerWidth}
              height={window.innerHeight}
              numberOfPieces={600} 
              recycle={false} 
              gravity={0.15}
            />
            <div className="max-w-4xl w-full flex flex-col items-center">
              <h1 className="text-6xl sm:text-8xl font-black mb-16 text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-yellow-600 drop-shadow-sm uppercase tracking-widest text-center">
                Victory
              </h1>
              <div className="flex flex-col sm:flex-row items-end justify-center gap-6 w-full h-[400px]">
                {gameState.players
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3)
                  .map((player, index) => {
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;
                    
                    let heightClass = "h-48";
                    if (isFirst) heightClass = "h-72";
                    if (isThird) heightClass = "h-32";

                    let colorClass = "bg-gradient-to-t from-yellow-400 to-amber-600";
                    if (isSecond) colorClass = "bg-gradient-to-t from-slate-300 to-slate-500 scale-95 origin-bottom";
                    if (isThird) colorClass = "bg-gradient-to-t from-orange-500 to-red-700 scale-90 origin-bottom";
                    
                    // Display order: 2nd, 1st, 3rd
                    let orderClass = "order-2";
                    if (isSecond) orderClass = "order-1";
                    if (isThird) orderClass = "order-3";

                    return (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.2 + 0.5, type: 'spring' }}
                        className={`relative flex flex-col items-center justify-end w-48 ${heightClass} ${colorClass} rounded-3xl overflow-visible pt-16 ${orderClass} mb-8`}
                      >
                        <div className="absolute -top-16 mb-4">
                          <div className={`rounded-2xl border-2 border-slate-700 bg-slate-800 overflow-hidden ${isFirst ? 'w-32 h-32' : isSecond ? 'w-24 h-24' : 'w-20 h-20'}`}>
                            <img 
                              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(player.name)}`} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {isFirst && (
                            <div className="absolute -top-6 -right-5 transform rotate-12 drop-shadow-md">
                              <Trophy className="w-12 h-12 fill-yellow-400 text-yellow-600" />
                            </div>
                          )}
                          {isSecond && (
                            <div className="absolute -top-5 -right-4 transform rotate-12 drop-shadow-md">
                              <Medal className="w-10 h-10 fill-slate-300 text-slate-500" />
                            </div>
                          )}
                          {isThird && (
                            <div className="absolute -top-4 -right-3 transform rotate-12 drop-shadow-md">
                              <Award className="w-8 h-8 fill-orange-400 text-orange-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center pb-6 text-center w-full px-2">
                          <div className={`font-extrabold uppercase tracking-widest text-slate-950 mb-1 line-clamp-1 w-full truncate ${isFirst ? 'text-xl' : 'text-lg'}`}>{player.name}</div>
                          <div className={`font-black text-white drop-shadow-md ${isFirst ? 'text-4xl' : 'text-3xl'}`}>{player.score}</div>
                        </div>
                      </motion.div>
                    )
                  })}
              </div>
              <div className="flex flex-col items-center gap-6 mt-16 z-20">
                <button 
                  onClick={() => { playSound('click'); hooks.resetBoard(); }} 
                  className="px-10 py-4 bg-white text-black hover:bg-slate-100 rounded-2xl font-black text-lg uppercase tracking-widest transition-all active:scale-95 shadow-lg border border-black/10"
                >
                  Play Again
                </button>
                <button 
                  onClick={() => { playSound('click'); hooks.resetBoard(); onEdit(); }} 
                  className="px-6 py-2 text-white/40 hover:text-white transition-colors uppercase tracking-widest text-xs font-bold"
                >
                  Exit to Editor
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

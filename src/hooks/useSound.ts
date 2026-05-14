import { useCallback } from 'react';

// Use a singleton AudioContext so we don't hit the browser limit of mostly 6 simultaneous contexts
let audioCtx: AudioContext | null = null;

export function useSound(isMuted: boolean = false) {
  const initAudio = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const playSound = useCallback((type: 'select' | 'reveal' | 'award' | 'penalize' | 'click') => {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;

      if (type === 'select' || type === 'reveal' || type === 'click') {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = type === 'reveal' ? 'triangle' : 'sine';
        const freqStart = type === 'select' ? 400 : (type === 'reveal' ? 300 : 600);
        const freqEnd = type === 'select' ? 800 : (type === 'reveal' ? 900 : 600);
        const duration = type === 'click' ? 0.05 : 0.3;
        
        osc.frequency.setValueAtTime(freqStart, now);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
      } else if (type === 'award') {
        // Modern, soft success chime (major third interval) - Louder
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNodeChime = audioCtx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now);
        
        osc1.connect(gainNodeChime);
        osc2.connect(gainNodeChime);
        gainNodeChime.connect(audioCtx.destination);
        
        gainNodeChime.gain.setValueAtTime(0.0, now);
        gainNodeChime.gain.linearRampToValueAtTime(0.9, now + 0.03); 
        gainNodeChime.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
      } else if (type === 'penalize') {
         // Deep, soft 'thud' error sound - Louder
         const oscP = audioCtx.createOscillator();
         const gainNodeP = audioCtx.createGain();
 
         oscP.type = 'sine'; 
         oscP.frequency.setValueAtTime(150, now);
         oscP.frequency.exponentialRampToValueAtTime(110, now + 0.2);
         
         oscP.connect(gainNodeP);
         gainNodeP.connect(audioCtx.destination);
 
         gainNodeP.gain.setValueAtTime(0.0, now);
         gainNodeP.gain.linearRampToValueAtTime(0.9, now + 0.02);
         gainNodeP.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
         
         oscP.start(now);
         oscP.stop(now + 0.3);
      }
    } catch (e) {
      // Ignore audio errors
    }
  }, [isMuted]);

  return { playSound };
}

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
        // Modern, bouncy, bubbly success chime
        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNodeChime = audioCtx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.linearRampToValueAtTime(659.25, now + 0.1); // C5 to E5 pitch rise
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now); // G5
        osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // G5 to C6 pitch rise
        
        osc1.connect(gainNodeChime);
        osc2.connect(gainNodeChime);
        gainNodeChime.connect(audioCtx.destination);
        
        gainNodeChime.gain.setValueAtTime(0.0, now);
        gainNodeChime.gain.linearRampToValueAtTime(0.7, now + 0.05); // Clean, bouncy attack
        gainNodeChime.gain.exponentialRampToValueAtTime(0.01, now + 0.5); // Smooth decay
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
      } else if (type === 'penalize') {
         // Distinctive, discordant error tone (modern/complex)
         const now = audioCtx.currentTime;
         const osc1 = audioCtx.createOscillator();
         const osc2 = audioCtx.createOscillator();
         const gainNodeP = audioCtx.createGain();
 
         osc1.type = 'sine';
         osc1.frequency.setValueAtTime(220, now); // A3
         osc2.type = 'sine';
         osc2.frequency.setValueAtTime(207.65, now); // G#3 (Smoother discordance)
         
         osc1.connect(gainNodeP);
         osc2.connect(gainNodeP);
         gainNodeP.connect(audioCtx.destination);
 
         gainNodeP.gain.setValueAtTime(0.0, now);
         gainNodeP.gain.linearRampToValueAtTime(0.6, now + 0.05); // Softer attack
         gainNodeP.gain.exponentialRampToValueAtTime(0.01, now + 0.5); // Smoother decay
         
         osc1.start(now);
         osc2.start(now);
         osc1.stop(now + 0.5);
         osc2.stop(now + 0.5);
      } else if (type === 'click') {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now); // Slightly higher pitch for a crisp click
        gainNode.gain.setValueAtTime(1.0, now); // Louder click
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      // Ignore audio errors
    }
  }, [isMuted]);

  return { playSound };
}

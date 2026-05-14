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
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'select') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'reveal') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'award') {
        // Sophisticated, warm chime arpeggio
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        frequencies.forEach((freq, i) => {
          const o = audioCtx!.createOscillator();
          const g = audioCtx!.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.06);
          g.gain.setValueAtTime(0.15, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.6);
          o.connect(g);
          g.connect(audioCtx!.destination);
          o.start(now + i * 0.06);
          o.stop(now + i * 0.06 + 0.6);
        });
      } else if (type === 'penalize') {
        // Soft but firm "wrong" sound, avoiding harsh buzzers
        const freq = 110; // A2
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.8, now + 0.5);
        
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 1.05, now); // Slight dissonance
        osc2.frequency.linearRampToValueAtTime(freq * 0.85, now + 0.5);
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        gain2.gain.setValueAtTime(0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.5);
        gain2.stop(now + 0.5);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.4, now);
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

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
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'reveal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'award') {
        // More sophisticated chime
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        frequencies.forEach((freq, i) => {
          const o = audioCtx!.createOscillator();
          const g = audioCtx!.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.05);
          g.gain.setValueAtTime(0.1, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.4);
          o.connect(g);
          g.connect(audioCtx!.destination);
          o.start(now + i * 0.05);
          o.stop(now + i * 0.05 + 0.4);
        });
      } else if (type === 'penalize') {
        // Modern "wrong" sound: deeper, cleaner pulse
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.4);
        
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(145, now);
        osc2.frequency.linearRampToValueAtTime(75, now + 0.4);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        gain2.gain.setValueAtTime(0.3, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.4);
        osc2.stop(now + 0.4);
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

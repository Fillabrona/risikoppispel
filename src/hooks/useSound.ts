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
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'reveal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'award') {
        // High quality "ding-ding" chime
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); // C6
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now); // E5
        osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.1); // E6
        
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        gain2.gain.setValueAtTime(0.3, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.5);
        osc2.stop(now + 0.5);
      } else if (type === 'penalize') {
        // Classic buzzer sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        
        const mod = audioCtx.createOscillator();
        mod.type = 'square';
        mod.frequency.value = 60;
        const modGain = audioCtx.createGain();
        modGain.gain.value = 40;
        mod.connect(modGain);
        modGain.connect(osc.frequency);
        
        gainNode.gain.setValueAtTime(0.6, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.4);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        
        mod.start(now);
        osc.start(now);
        mod.stop(now + 0.6);
        osc.stop(now + 0.6);
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

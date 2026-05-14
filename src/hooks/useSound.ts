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
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'reveal') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'award') {
        // High quality "ding" chime - multi-tone major chord with harmonics
        const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
        freqs.forEach((f, i) => {
          const o = audioCtx!.createOscillator();
          const g = audioCtx!.createGain();
          o.type = i === 0 ? 'sine' : 'triangle'; // Mix of sine and triangle for richness
          o.frequency.setValueAtTime(f, now + (i * 0.015));
          
          // Slight pitch envelope for that "ping"
          o.frequency.exponentialRampToValueAtTime(f * 1.01, now + 0.05);
          o.frequency.exponentialRampToValueAtTime(f, now + 0.1);

          g.gain.setValueAtTime(0, now + (i * 0.015));
          g.gain.linearRampToValueAtTime(0.15 / (i + 1), now + (i * 0.015) + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          
          o.connect(g);
          g.connect(audioCtx!.destination);
          
          o.start(now + (i * 0.015));
          o.stop(now + 1.2);
        });

        // Add a soft noise burst for the impact
        const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 5000;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.05, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);
      } else if (type === 'penalize') {
        // Thick game-show buzzer using detuned saws
        const fundamental = 110; // A2
        [0, 5, -5, 12].forEach((detune, i) => {
          const o = audioCtx!.createOscillator();
          const g = audioCtx!.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(fundamental + detune, now);
          
          // Vibrato / Wobble
          const lfo = audioCtx!.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = 30 + i;
          const lfoGain = audioCtx!.createGain();
          lfoGain.gain.value = 10;
          lfo.connect(lfoGain);
          lfoGain.connect(o.frequency);
          lfo.start(now);
          lfo.stop(now + 0.6);

          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.15, now + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          
          const filter = audioCtx!.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2000, now);
          filter.frequency.exponentialRampToValueAtTime(500, now + 0.6);
          
          o.connect(filter);
          filter.connect(g);
          g.connect(audioCtx!.destination);
          
          o.start(now);
          o.stop(now + 0.6);
        });
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {
      // Ignore audio errors
    }
  }, [isMuted]);

  return { playSound };
}

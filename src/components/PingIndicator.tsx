import React, { useState, useEffect, useRef } from 'react';
import { Activity, Info } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';

export const PingIndicator = () => {
  const [ping, setPing] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    
    const pingDb = async () => {
      if (!auth.currentUser) return;
      const start = performance.now();
      try {
        await setDoc(doc(db, 'games', `_ping_${auth.currentUser.uid}`), {
          t: serverTimestamp()
        });
        if (mounted) {
          setPing(Math.round(performance.now() - start));
        }
      } catch (err) {
        if (mounted) setPing(-1);
      }
    };

    pingDb(); // Immediate ping on mount
    const interval = setInterval(pingDb, 3000); // Ping every 3 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPingColor = () => {
    if (ping === null) return 'text-slate-500 bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20';
    if (ping === -1) return 'text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20';
    if (ping < 150) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20';
    if (ping < 400) return 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20';
  };

  const getPingStatus = () => {
    if (ping === null) return 'Connecting...';
    if (ping === -1) return 'Disconnected';
    if (ping < 150) return 'Good Connection';
    if (ping < 400) return 'Slow Connection';
    return 'Poor Connection';
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors shadow-none font-bold ${getPingColor()}`}
        title={getPingStatus()}
      >
        <Activity className="w-4 h-4" />
        <span className="text-xs font-mono tracking-widest uppercase">
          {ping === null ? '---' : ping === -1 ? 'ERR' : `${ping}ms`}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-72 right-0 bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-xl z-50 text-left"
          >
            <div className="flex items-center gap-3 border-b border-slate-700/50 pb-3 mb-3">
              <div className={`p-2 rounded-lg ${getPingColor()}`}>
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200 text-sm">{getPingStatus()}</h4>
                <p className="font-mono text-xs text-slate-400">Database Latency: {ping === null ? '...' : ping === -1 ? 'Error' : `${ping}ms`}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300 leading-relaxed">
                This indicates the delay between the game and the database server.
              </p>
              
              <ul className="text-xs space-y-2 text-slate-400">
                 <li className="flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                   <span><strong>&lt; 150ms:</strong> Optimal. Buzzes and score updates feel instant.</span>
                 </li>
                 <li className="flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                   <span><strong>150ms - 400ms:</strong> Actionable but noticeable delay. Players might complain about lag.</span>
                 </li>
                 <li className="flex gap-2">
                   <div className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                   <span><strong>&gt; 400ms:</strong> Poor. Expect a couple seconds delay on everything. Connect to faster WiFi/Hotspot.</span>
                 </li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import { Category, GameState, presetThemes, Theme } from '../types';
import { Settings, Play, Plus, Trash2, Edit2, RotateCcw, LayoutDashboard, Users, Palette, CheckCircle2, Copy, Download, Upload, Wand2, Loader2, ChevronDown, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { motion, AnimatePresence } from 'motion/react';

interface EditorProps {
  gameState: GameState;
  hooks: any;
  onPlay: () => void;
  isMuted: boolean;
  setIsMuted: (val: boolean | ((p: boolean) => boolean)) => void;
}

function CustomSelect({ value, onChange, options, label }: { value: string, onChange: (val: string) => void, options: {value: string, label: string}[], label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative" ref={ref}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 hover:border-purple-500/50 rounded-xl text-white font-medium text-sm outline-none flex items-center justify-between transition-colors shadow-sm"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl backdrop-blur-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value 
                  ? 'bg-purple-500/20 text-purple-300 font-bold' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomColorPicker({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 280);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-10 h-8 shrink-0 rounded-xl overflow-hidden border border-slate-700/50 p-1 bg-slate-900/50 hover:border-cyan-500/30 transition-all shadow-inner"
      >
        <div 
          className="w-full h-full rounded-lg shadow-lg border border-white/5" 
          style={{ backgroundColor: value }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 10 : -10 }}
            className={`absolute z-[60] p-3 bg-slate-900 border border-slate-700/50 rounded-3xl shadow-2xl origin-center backdrop-blur-xl ${
              openUpwards ? 'bottom-full mb-3' : 'top-full mt-3'
            }`}
          >
            <HexColorPicker color={value} onChange={onChange} />
            <div className="mt-3 flex items-center justify-between gap-3">
               <div className="flex-1 px-3 py-1.5 bg-slate-950 rounded-xl text-[10px] font-mono text-slate-400 border border-slate-800 uppercase text-center">
                 {value}
               </div>
               <button 
                 onClick={() => setIsOpen(false)}
                 className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-xl transition-colors uppercase"
               >
                 Done
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Editor({ gameState, hooks, onPlay, isMuted, setIsMuted }: EditorProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'settings' | 'theme' | 'players'>('categories');
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategoryCount, setAiCategoryCount] = useState<number | ''>(5);
  const [aiQuestionsPerCat, setAiQuestionsPerCat] = useState<number | ''>(5);
  const [aiPointProgression, setAiPointProgression] = useState('100, 200, 300, 400, 500');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('groq_api_key') || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiBonusEnabled, setAiBonusEnabled] = useState(false);
  const [aiBonusTrigger, setAiBonusTrigger] = useState('row_clear');
  const [aiBonusPoints, setAiBonusPoints] = useState('500');

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('groq_api_key', val);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt && !aiBonusEnabled) {
      setModal({ title: "Beskrywing Benodig", message: "Voer asseblief 'n beskrywing in vir die speletjie-inhoud." });
      return;
    }
    setIsGenerating(true);
    try {
      const keyToUse = apiKey || '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';
      
      const systemPrompt = `You are a trivia game generator. Output ONLY valid JSON, with no HTML or markdown formatting at all. The entire response must be parsable by JSON.parse().
The JSON must follow this exact structure:
{
  "title": "Title based on prompt",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        {
          "questionText": "The question...?",
          "answerText": "The answer",
          "points": 100
        }
      ]
    }
  ]
}
Generate exactly ${aiCategoryCount} categories, each with exactly ${aiQuestionsPerCat} questions.
The points for questions in each category MUST correspond to these values in order: ${aiPointProgression}.
${aiBonusEnabled ? `Include bonus mechanics described as: Award bonus on ${aiBonusTrigger}, worth ${aiBonusPoints === 'ai' ? 'randomly determined' : aiBonusPoints} points. Add a bonus question appropriately based on existing game data.` : ''}
Make it engaging and accurate!`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API Error:", errText);
        throw new Error('API Fout');
      }
      const data = await response.json();
      let content = data.choices[0].message.content;
      
      // Strip markdown block if the AI happens to wrap it
      content = content.replace(/^```(json)?/mi, '').replace(/```$/mi, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        console.error("AI response:", content);
        throw new Error("Die AI het nie die antwoord korrek geformateer nie.");
      }
      
      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error("AI het nie behoorlike kategorieë gegenereer nie.");
      }
      
      const newCategories = parsed.categories.map((c: any, i: number) => ({
        id: `cat-ai-${Date.now()}-${i}`,
        name: c.name,
        questions: c.questions.map((q: any, j: number) => ({
          id: `q-ai-${Date.now()}-${i}-${j}`,
          questionText: q.questionText,
          answerText: q.answerText,
          points: q.points || (j+1)*100,
          isAnswered: false
        }))
      }));
      
      hooks.setGameState({
        ...gameState,
        title: parsed.title || 'AI Generated Game',
        categories: newCategories
      });
      setActiveTab('categories');
      setAiPrompt('');
    } catch(e: any) {
      setModal({ title: "Gegenereer Fout", message: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAIBonus = async (categoryId: string) => {
    setIsGenerating(true);
    try {
      const keyToUse = apiKey || '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';
      const category = gameState.categories.find(c => c.id === categoryId);
      if (!category) throw new Error("Category not found");
      
      const gameDataSlice = gameState.categories.slice(0, 10).map(c => ({
        name: c.name,
        questions: c.questions.slice(0, 10).map(q => ({ q: q.questionText, a: q.answerText, p: q.points }))
      }));

      let maxPoints = 0;
      for (const q of category.questions) {
        if (q.points > maxPoints) maxPoints = q.points;
      }
      const suggestedPoints = maxPoints > 0 ? maxPoints + (maxPoints >= 500 ? 500 : 100) : 500;

      const systemPrompt = `You are a trivia game generator. The user wants to generate 1 bonus question for a specific category in their game.
Current game context (max 10 categories, 10 questions each):
${JSON.stringify(gameDataSlice)}

Generate 1 additional bonus question for the category "${category.name}". The question should be challenging and fit the theme but stand out as a bonus.
Output ONLY valid JSON, no markdown formatting.
{
  "questionText": "The question...?",
  "answerText": "The answer",
  "points": ${suggestedPoints}
}`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate a bonus question.' }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API Error:", errText);
        throw new Error('API Error: ' + errText);
      }
      const data = await response.json();
      let content = data.choices[0].message.content;
      
      content = content.replace(/^```(json)?/mi, '').replace(/```$/mi, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error("The AI didn't format the response properly.");
      }
      
      if (!parsed.questionText || !parsed.answerText) {
        throw new Error("AI did not generate proper question properties.");
      }

      const newCategories = gameState.categories.map(c => {
        if (c.id === categoryId) {
          const newQuestion = {
            id: `q-ai-bonus-${Date.now()}`,
            questionText: parsed.questionText,
            answerText: parsed.answerText,
            points: parsed.points || suggestedPoints,
            isAnswered: false,
            isBonus: true,
            bonusTrigger: aiBonusTrigger,
            bonusPoints: parsed.points || suggestedPoints
          };
          return { ...c, questions: [...c.questions, newQuestion] };
        }
        return c;
      });
      
      hooks.setGameState({
        ...gameState,
        categories: newCategories
      });
    } catch(e: any) {
      setModal({ title: "Bonus Fout", message: "Kon nie bonusvraagnote genereer nie: " + e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "jeopardy-game.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        hooks.setGameState(json);
      } catch (err) {
        console.error("Error parsing JSON:", err);
        setModal({ title: "Invoer Fout", message: "Kon nie die speletjie invoer nie. Maak seker dit is 'n geldige JSON-lêer." });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canPlay = gameState.players.length > 0 && 
    gameState.categories.length > 0 && 
    gameState.categories.some(c => c.questions.length > 0);

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
      {/* Custom Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-[2.5rem] p-10 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 mx-auto ring-1 ring-amber-500/20">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{modal.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-10">{modal.message}</p>
              <button
                onClick={() => setModal(null)}
                className="w-full py-4 bg-white text-slate-900 font-black text-sm uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-xl hover:bg-slate-100"
              >
                Verstaan
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight leading-tight">
            Risiko oppi Spel
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">Game Editor</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 relative">
          {[
            { id: 'categories', icon: LayoutDashboard, label: 'Categories & Board' },
            { id: 'settings', icon: Settings, label: 'Game Settings & AI' },
            { id: 'players', icon: Users, label: 'Players' },
            { id: 'theme', icon: Palette, label: 'Theme & Styling' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative group ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-blue-600/10 ring-1 ring-blue-500/20 rounded-xl z-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`w-5 h-5 relative z-10 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}

          <div className="pt-6 px-1">
            <div className="bg-slate-950/20 rounded-2xl p-4 border border-slate-800/40 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Audio Mode</span>
              </div>
              <button
                onClick={() => setIsMuted(m => !m)}
                className={`w-full flex items-center justify-center space-x-3 px-4 py-2 rounded-xl border transition-all duration-300 group ${
                    isMuted 
                      ? 'bg-slate-800 border-slate-700/50 text-slate-500' 
                      : 'bg-slate-800/40 border-slate-700/30 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span className="text-[11px] font-bold uppercase tracking-tight">{isMuted ? 'Muted' : 'Playing'}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <button
            onClick={hooks.resetBoard}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 hover:border-slate-600"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Board</span>
          </button>
          <button
            onClick={() => {
              if (!canPlay) {
                if (gameState.players.length === 0) {
                  setModal({ title: "Speler Benodig", message: "Voeg asseblief ten minste een speler by voordat jy begin." });
                } else {
                  setModal({ title: "Geen Vrae", message: "Die speletjie moet ten minste een kategorie met 'n vraag hê." });
                }
                return;
              }
              onPlay();
            }}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-bold rounded-xl transition-all transform ${
              canPlay 
                ? 'text-slate-900 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 hover:-translate-y-0.5' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START GAME</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay"></div>
        
        <div className="max-w-[1400px] mx-auto p-8 relative z-10">
          <header className="mb-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
             <div className="flex flex-col">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2">Game Title</label>
               <input
                 type="text"
                 value={gameState.title}
                 onChange={(e) => hooks.updateTitle(e.target.value)}
                 className="text-4xl font-extrabold bg-transparent text-white border-0 focus:ring-0 p-0 placeholder-slate-700 outline-none w-full max-w-xl"
                 placeholder="Enter Game Title"
               />
             </div>
             <div className="flex items-center gap-3">
               <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 font-bold text-sm">
                 <Upload className="w-4 h-4" /> Import
               </button>
               <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 font-bold text-sm">
                 <Download className="w-4 h-4" /> Export
               </button>
             </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative"
            >
              {activeTab === 'categories' && (
                <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
                  <h2 className="text-xl font-bold flex items-center gap-3">
                    <LayoutDashboard className="w-6 h-6 text-blue-400" /> 
                    Categories
                    <span className="bg-slate-700 text-slate-300 text-xs px-2.5 py-0.5 rounded-full">{gameState.categories.length}</span>
                  </h2>
                  <button
                    onClick={hooks.addCategory}
                    className="flex items-center space-x-2 text-sm font-bold text-white bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 px-4 py-2 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Category</span>
                  </button>
                </div>

                <div className="grid gap-8">
                  {gameState.categories.map((category) => (
                    <div key={category.id} className="bg-slate-800/40 border border-slate-700 rounded-3xl overflow-hidden backdrop-blur-xl shadow-xl transition-all hover:border-slate-600">
                      <div className="bg-slate-900/50 px-6 py-4 flex justify-between items-center border-b border-slate-700/50">
                        <div className="flex items-center space-x-4 flex-1">
                          <input
                            type="text"
                            value={category.name}
                            onChange={(e) => hooks.updateCategory(category.id, { name: e.target.value })}
                            className="w-full max-w-sm bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none text-xl font-bold text-white placeholder-slate-600 px-1 py-1 transition-colors outline-none"
                            placeholder="Category Name"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateAIBonus(category.id)}
                            className={`text-slate-500 hover:text-purple-400 p-2 hover:bg-purple-500/10 rounded-xl transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Generate AI Bonus Question"
                            disabled={isGenerating}
                          >
                            <Wand2 className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
                          </button>
                          <button
                            onClick={() => hooks.duplicateCategory(category.id)}
                            className="text-slate-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-xl transition-colors"
                            title="Duplicate Category"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => hooks.removeCategory(category.id)}
                            className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-colors"
                            title="Remove Category"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="space-y-4">
                          {category.questions.map((q, qIndex) => (
                            <div key={q.id} className="bg-slate-900/80 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 shadow-lg relative group transition-colors">
                              <div className="flex flex-col gap-2 sm:w-24 shrink-0">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Points</span>
                                <input
                                  type="number"
                                  value={q.points}
                                  onChange={(e) => hooks.updateQuestion(category.id, q.id, { points: parseInt(e.target.value) || 0 })}
                                  className="w-full text-left px-3 py-2.5 font-mono font-bold text-amber-400 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                <div className="mt-2 flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden w-full">
                                  <label className="relative flex flex-col items-center cursor-pointer group mb-1">
                                    <input 
                                      type="checkbox" 
                                      className="sr-only peer" 
                                      checked={q.isBonus || false} 
                                      onChange={(e) => hooks.updateQuestion(category.id, q.id, { isBonus: e.target.checked })} 
                                    />
                                    <div className="w-8 h-8 rounded border-2 border-slate-700 bg-slate-900 peer-checked:bg-purple-500 peer-checked:border-purple-500 transition-all flex items-center justify-center shadow-inner group-hover:border-purple-400">
                                      <svg className={`w-5 h-5 text-white pointer-events-none transition-transform ${q.isBonus ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                      </svg>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Bonus</span>
                                  </label>
                                </div>
                                <button
                                  onClick={() => hooks.removeQuestion(category.id, q.id)}
                                  className="mt-auto text-slate-600 hover:text-red-400 py-2.5 hover:bg-red-500/10 rounded-xl transition-colors self-start sm:self-auto flex items-center justify-center w-full"
                                  title="Remove Question"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex-1 flex flex-col gap-4">
                                <div className="flex-1 flex flex-col sm:flex-row gap-4">
                                  <div className="flex-1 relative z-10 border border-slate-700 focus-within:border-blue-500/50 rounded-xl bg-slate-950 transition-all flex flex-col">
                                    <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/50 rounded-t-xl">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest">Question {qIndex + 1}</span>
                                      </div>
                                      {q.isBonus && <span className="text-[10px] font-bold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1"><Wand2 className="w-3 h-3" /> BONUS</span>}
                                    </div>
                                    <textarea
                                      value={q.questionText}
                                      onChange={(e) => hooks.updateQuestion(category.id, q.id, { questionText: e.target.value })}
                                      className="w-full flex-1 px-4 py-3 text-sm text-slate-200 bg-transparent border-0 focus:ring-0 min-h-[4rem] resize-y outline-none transition-all placeholder-slate-700"
                                      placeholder="Enter the prompt..."
                                    />
                                  </div>
                                  <div className="flex-1 relative z-10 border border-slate-700 focus-within:border-emerald-500/50 rounded-xl bg-slate-950 transition-all flex flex-col">
                                    <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50 rounded-t-xl">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                      <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">Answer {qIndex + 1}</span>
                                    </div>
                                    <textarea
                                      value={q.answerText}
                                      onChange={(e) => hooks.updateQuestion(category.id, q.id, { answerText: e.target.value })}
                                      className="w-full flex-1 px-4 py-3 text-sm text-slate-200 bg-transparent border-0 focus:ring-0 min-h-[4rem] resize-y outline-none transition-all placeholder-slate-700"
                                      placeholder="Enter the answer..."
                                    />
                                  </div>
                                </div>
                                {q.isBonus && (
                                  <div className="grid grid-cols-2 gap-4 bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl">
                                    <CustomSelect 
                                      label="Bonus Trigger"
                                      value={q.bonusTrigger || 'row_clear'}
                                      onChange={(val) => hooks.updateQuestion(category.id, q.id, { bonusTrigger: val })}
                                      options={[
                                        { value: 'row_clear', label: 'When a row clears' },
                                        { value: 'all_clear', label: 'Final round (All cleared)' },
                                        { value: 'random', label: 'Random (Manual Card)' }
                                      ]}
                                    />
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Bonus Points / Wager Max</label>
                                      <input 
                                        type="number"
                                        value={q.bonusPoints || q.points * 2}
                                        onChange={(e) => hooks.updateQuestion(category.id, q.id, { bonusPoints: parseInt(e.target.value) || 0 })}
                                        className="w-full text-left px-4 py-3 text-sm font-bold text-amber-400 bg-slate-950 border border-slate-700 rounded-xl focus:border-purple-500 outline-none transition-all shadow-sm"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => hooks.addQuestion(category.id)}
                          className="mt-6 w-full flex items-center justify-center space-x-2 text-sm font-bold text-slate-300 bg-slate-900 border border-slate-700 border-dashed hover:border-slate-500 hover:text-white px-4 py-4 rounded-xl transition-all"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Add Question to Category</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8 max-w-6xl pb-10">
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-xl">
                  <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
                    <Settings className="w-6 h-6 text-indigo-400" />
                    Gameplay Settings
                  </h2>
                  <div className="grid gap-6">
                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                      <div>
                        <h3 className="font-bold text-white text-lg">Enable Timer</h3>
                        <p className="text-sm text-slate-400 mt-1">Adds a countdown timer when viewing a question.</p>
                      </div>
                      <label className="relative flex items-center p-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={gameState.settings?.timerEnabled || false} 
                          onChange={(e) => hooks.updateSettings({ timerEnabled: e.target.checked })} 
                        />
                        <div className="w-8 h-8 rounded border-2 border-slate-700 bg-slate-900 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center shadow-inner group-hover:border-indigo-400">
                          <svg 
                            className={`w-5 h-5 text-white pointer-events-none transition-transform ${gameState.settings?.timerEnabled ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} 
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      </label>
                    </div>
                    {gameState.settings?.timerEnabled && (
                      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <div>
                          <h3 className="font-bold text-white text-lg">Timer Duration</h3>
                          <p className="text-sm text-slate-400 mt-1">Seconds to answer before the buzzer.</p>
                        </div>
                        <input type="number" 
                          value={gameState.settings?.timerDuration || 30} 
                          onChange={e => hooks.updateSettings({ timerDuration: parseInt(e.target.value) || 30 })}
                          className="w-24 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:border-indigo-500 outline-none text-white text-center font-bold text-xl drop-shadow-md" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-8 rounded-3xl border border-purple-500/20 backdrop-blur-xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
                   
                  <h2 className="text-2xl font-black flex items-center gap-3 mb-2 relative z-10 text-white">
                    <Wand2 className="w-7 h-7 text-purple-400" />
                    AI Game Generator
                  </h2>
                  <p className="text-purple-200/60 mb-8 relative z-10">Describe the topic and parameters, and we'll instantly generate a full game board.</p>
                  
                  <div className="space-y-6 relative z-10">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Categories</label>
                        <input type="number" 
                          value={aiCategoryCount} 
                          onChange={e => setAiCategoryCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder="e.g. 5"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl text-white font-bold text-lg outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Questions per category</label>
                        <input type="number" 
                          value={aiQuestionsPerCat} 
                          onChange={e => setAiQuestionsPerCat(e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder="e.g. 5"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl text-white font-bold text-lg outline-none" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Point Progression</label>
                        <input type="text" 
                          value={aiPointProgression} 
                          onChange={e => setAiPointProgression(e.target.value)}
                          placeholder="e.g. 50, 100, 200..."
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl text-white font-bold text-lg outline-none" 
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Groq API Key <span className="text-slate-500 font-normal lowercase">(optional)</span></label>
                        <input type="password" 
                          value={apiKey} 
                          onChange={handleApiKeyChange}
                          placeholder="gsk_..."
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl text-white font-bold text-lg outline-none" 
                        />
                      </div>
                    </div>

                    <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                           <h3 className="font-bold text-white text-md">Generate AI Bonus Mechanics</h3>
                           <p className="text-xs text-slate-400 mt-1">Let AI create a bonus element with the game.</p>
                        </div>
                        <label className="relative flex items-center p-2 cursor-pointer group">
                          <input type="checkbox" className="sr-only peer" checked={aiBonusEnabled} onChange={(e) => setAiBonusEnabled(e.target.checked)} />
                          <div className="w-8 h-8 rounded border-2 border-slate-700 bg-slate-950 peer-checked:bg-purple-500 peer-checked:border-purple-500 transition-all flex items-center justify-center shadow-inner group-hover:border-purple-400">
                            <svg className={`w-5 h-5 text-white pointer-events-none transition-transform ${aiBonusEnabled ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </div>
                        </label>
                      </div>
                      
                      {aiBonusEnabled && (
                        <div className="grid grid-cols-2 gap-4 mt-2 pt-4 border-t border-slate-800/50">
                          <CustomSelect 
                            label="Bonus Trigger"
                            value={aiBonusTrigger}
                            onChange={setAiBonusTrigger}
                            options={[
                              { value: 'row_clear', label: 'When a row clears' },
                              { value: 'all_clear', label: 'Final round (All cleared)' },
                              { value: 'random', label: 'Random (Manual Card)' }
                            ]}
                          />
                          <CustomSelect 
                            label="Bonus Points"
                            value={aiBonusPoints}
                            onChange={setAiBonusPoints}
                            options={[
                              { value: 'ai', label: 'Let AI Choose' },
                              { value: '2500', label: '2500' },
                              { value: '5000', label: '5000' },
                              { value: '10000', label: '10000' }
                            ]}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Describe your game</label>
                      <textarea 
                        value={aiPrompt} 
                        onChange={e => setAiPrompt(e.target.value)} 
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl text-white outline-none resize-none" 
                        rows={5} 
                        placeholder="E.g., A trivia game about 90s action movies, dinosaurs, world geography, European history, and fast food." 
                      />
                    </div>
                    
                    <button 
                      onClick={handleGenerateAI} 
                      disabled={isGenerating || !aiPrompt || !aiCategoryCount || !aiQuestionsPerCat} 
                      className={`w-full py-4 rounded-xl font-bold flex text-lg items-center justify-center gap-3 transition-all ${
                        isGenerating || !aiPrompt ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02]'
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" /> Generating Magic...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" /> Generate Board
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'players' && (
              <div className="space-y-6 max-w-6xl">
                <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
                  <h2 className="text-xl font-bold flex items-center gap-3">
                    <Users className="w-6 h-6 text-purple-400" /> 
                    Contestants
                  </h2>
                  <button
                    onClick={hooks.addPlayer}
                    className="flex items-center space-x-2 text-sm font-bold text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 px-4 py-2 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Player</span>
                  </button>
                </div>

                <div className="grid gap-4">
                  {gameState.players.map((player, idx) => (
                    <div key={player.id} className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700 shadow-lg backdrop-blur-xl group hover:border-slate-600 transition-colors">
                      <div className="flex items-center justify-center shrink-0">
                         <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(player.name)}`} alt="Avatar" className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-xl" />
                      </div>
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => hooks.updatePlayerName(player.id, e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 text-lg font-bold text-white placeholder-slate-600 outline-none transition-all"
                        placeholder="Player Name"
                      />
                      <div className="flex items-center space-x-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 shrink-0">
                        <span className="text-xs uppercase tracking-widest font-bold text-amber-500/70">Score</span>
                        <input
                          type="number"
                          value={player.score}
                          onChange={(e) => hooks.updatePlayerScore(player.id, parseInt(e.target.value) - player.score || 0)}
                          className="w-24 text-right font-mono font-bold text-xl text-amber-400 bg-transparent focus:outline-none focus:text-amber-300 transition-colors"
                        />
                      </div>
                      <button
                        onClick={() => hooks.removePlayer(player.id)}
                        className="text-slate-500 hover:text-red-400 p-3 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-8 max-w-6xl pb-10">
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-xl">
                  <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
                    <Palette className="w-6 h-6 text-pink-400" /> 
                    Preset Themes
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(presetThemes).map(([key, preset]) => {
                      const isActive = gameState.theme.presetName === preset.presetName;
                      return (
                        <button
                          key={key}
                          onClick={() => hooks.updateTheme(preset)}
                          className={`relative p-5 rounded-2xl border-2 text-left transition-all overflow-hidden group ${
                            isActive ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-800'
                          }`}
                        >
                          <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity" style={{ background: preset.boardBg }}></div>
                          <div className="relative z-10 flex justify-between items-center drop-shadow-md">
                            <h3 className="font-bold text-lg text-white">{preset.presetName}</h3>
                            {isActive && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-xl">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                      <Settings className="w-6 h-6 text-slate-400" /> 
                      Advanced Customization
                    </h2>
                    <p className="text-sm text-slate-400 mt-2">Fine-tune the individual colors of your board. Supports HEX, RGB/RGBA, and CSS gradients.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                    {(Object.keys(gameState.theme) as Array<keyof Theme>).filter(k => k !== 'presetName').map((key) => {
                      const val = String((gameState.theme as any)[key] || '');
                      const isHex = val.startsWith('#') && (val.length === 4 || val.length === 7);
                      return (
                        <div key={key} className="flex flex-col gap-2.5 group/color">
                           <div className="flex items-center justify-between">
                             <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] break-words">
                               {key.replace(/([A-Z])/g, ' $1').trim()}
                             </label>
                             <div className="flex gap-1.5">
                               {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#ffffff', '#000000'].map(swatch => (
                                 <button 
                                   key={swatch}
                                   onClick={() => hooks.updateTheme({ [key]: swatch })}
                                   className="w-3.5 h-3.5 rounded-full border border-white/5 hover:scale-125 transition-all shadow-sm active:scale-90"
                                   style={{ backgroundColor: swatch }}
                                 />
                               ))}
                             </div>
                           </div>
                           <div className="flex space-x-2 items-stretch">
                            {isHex && (
                              <CustomColorPicker 
                                value={val}
                                onChange={(newVal) => hooks.updateTheme({ [key]: newVal })}
                              />
                            )}
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => hooks.updateTheme({ [key]: e.target.value })}
                            className="flex-1 px-4 py-2 bg-slate-950/40 border border-slate-700/40 rounded-2xl focus:ring-1 focus:ring-cyan-500/30 font-mono text-[11px] text-white placeholder-slate-800 outline-none transition-all shadow-inner"
                            placeholder="#HEX"
                          />
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
    </div>
  );
}

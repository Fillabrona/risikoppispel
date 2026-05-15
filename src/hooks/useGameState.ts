import { useEffect, useState } from 'react';
import { GameState, defaultTheme, Category, Player, Question, presetThemes } from '../types';

const STORAGE_KEY = 'risiko_oppi_spel_state';

const defaultCategories: Category[] = Array.from({ length: 5 }).map((_, cIdx) => ({
  id: `cat-${cIdx}`,
  name: `Category ${cIdx + 1}`,
  questions: Array.from({ length: 5 }).map((_, qIdx) => ({
    id: `q-${cIdx}-${qIdx}`,
    questionText: `Question ${qIdx + 1} for Category ${cIdx + 1}`,
    answerText: `Answer ${qIdx + 1}`,
    points: (qIdx + 1) * 100,
    isAnswered: false,
  })),
}));

const defaultPlayers: Player[] = [
  { id: 'p1', name: 'Player 1', score: 0 },
  { id: 'p2', name: 'Player 2', score: 0 },
  { id: 'p3', name: 'Player 3', score: 0 },
];

const defaultState: GameState = {
  title: 'Risiko oppi Spel',
  categories: defaultCategories,
  players: defaultPlayers,
  theme: defaultTheme,
  settings: {
    timerEnabled: false,
    timerDuration: 30,
  }
};

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed) {
        if (!parsed.settings) {
          parsed.settings = { timerEnabled: false, timerDuration: 30 };
        }
        return parsed;
      }
      return defaultState;
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  }, [gameState]);

  const updateTitle = (title: string) => setGameState((s) => ({ ...s, title }));
  
  const updateSettings = (settings: Partial<GameState['settings']>) => 
    setGameState((s) => ({ ...s, settings: { ...s.settings, timerEnabled: false, timerDuration: 30, ...settings } }));
  
  const updateTheme = (theme: Partial<GameState['theme']>) => 
    setGameState((s) => ({ ...s, theme: { ...s.theme, ...theme } }));

  const updateCategory = (catId: string, updates: Partial<Category>) => {
    setGameState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === catId ? { ...c, ...updates } : c)),
    }));
  };

  const updateQuestion = (catId: string, qId: string, updates: Partial<Question>) => {
    setGameState((s) => ({
      ...s,
      categories: s.categories.map((c) => 
        c.id === catId 
          ? { ...c, questions: c.questions.map((q) => (q.id === qId ? { ...q, ...updates } : q)) }
          : c
      ),
    }));
  };

  const setQuestionAnswered = (catId: string, qId: string, isAnswered: boolean) => {
    updateQuestion(catId, qId, { isAnswered });
  };

  const addQuestion = (catId: string) => {
    setGameState((s) => ({
      ...s,
      categories: s.categories.map((c) =>
        c.id === catId
          ? {
              ...c,
              questions: [
                ...c.questions,
                {
                  id: `q-${Date.now()}`,
                  questionText: 'New Question',
                  answerText: 'Answer',
                  points: (c.questions.length + 1) * 100,
                  isAnswered: false,
                },
              ],
            }
          : c
      ),
    }));
  };

  const removeQuestion = (catId: string, qId: string) => {
    setGameState((s) => ({
      ...s,
      categories: s.categories.map((c) =>
        c.id === catId
          ? { ...c, questions: c.questions.filter((q) => q.id !== qId) }
          : c
      ),
    }));
  };

  const resetBoard = () => {
    setGameState((s) => ({
      ...s,
      players: s.players.map((p) => ({ ...p, score: 0 })),
      categories: s.categories.map((c) => ({
        ...c,
        questions: c.questions.map((q) => ({ ...q, isAnswered: false })),
      })),
    }));
  };

  const updatePlayerScore = (playerId: string, delta: number) => {
    setGameState((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, score: p.score + delta } : p)),
    }));
  };

  const addCategory = () => {
    setGameState((s) => ({
      ...s,
      categories: [
        ...s.categories,
        {
          id: `cat-${Date.now()}`,
          name: 'New Category',
          questions: Array.from({ length: 5 }).map((_, qIdx) => ({
            id: `q-${Date.now()}-${qIdx}`,
            questionText: 'New Question',
            answerText: 'Answer',
            points: (qIdx + 1) * 100,
            isAnswered: false,
          })),
        },
      ],
    }));
  };

  const removeCategory = (catId: string) => {
    setGameState((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== catId),
    }));
  };

  const duplicateCategory = (catId: string) => {
    setGameState((s) => {
      const catToCopy = s.categories.find(c => c.id === catId);
      if (!catToCopy) return s;
      
      const newCategory = {
        ...catToCopy,
        id: `cat-${Date.now()}`,
        name: `${catToCopy.name} (Copy)`,
        questions: catToCopy.questions.map(q => ({
          ...q,
          id: `q-${Date.now()}-${Math.random().toString(36).substring(2,9)}`,
          isAnswered: false,
        }))
      };

      return {
        ...s,
        categories: [...s.categories, newCategory]
      };
    });
  };

  const addPlayer = (name?: any, id?: any) => {
    setGameState((s) => {
      const playerName = typeof name === 'string' ? name : `Player ${s.players.length + 1}`;
      const playerId = typeof id === 'string' ? id : `p-${Date.now()}`;
      const newPlayer = {
        id: playerId,
        name: playerName,
        score: 0
      };
      return {
        ...s,
        players: [...s.players, newPlayer],
      };
    });
  };

  const removePlayer = (playerId: string) => {
    setGameState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== playerId),
    }));
  };
  
  const updatePlayerName = (playerId: string, name: string) => {
    setGameState((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, name } : p)),
    }));
  };

  const loadDemoState = () => setGameState(defaultState);

  return {
    gameState,
    setGameState,
    updateTitle,
    updateSettings,
    updateTheme,
    updateCategory,
    updateQuestion,
    setQuestionAnswered,
    addQuestion,
    removeQuestion,
    resetBoard,
    updatePlayerScore,
    addCategory,
    removeCategory,
    duplicateCategory,
    addPlayer,
    removePlayer,
    updatePlayerName,
    loadDemoState
  };
}

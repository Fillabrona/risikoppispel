export type Player = {
  id: string;
  name: string;
  score: number;
  voiceUri?: string;
};

export type Question = {
  id: string;
  questionText: string;
  answerText: string;
  points: number;
  isAnswered: boolean;
  isBonus?: boolean;
  bonusTrigger?: string;
  bonusPoints?: number;
};

export type Category = {
  id: string;
  name: string;
  questions: Question[];
};

export type Theme = {
  presetName?: string;
  boardBg: string; // The background of the entire grid area (can be linear-gradient)
  headerBg: string; // Category header background (rgba or hex)
  headerText: string; // Category header text color
  cellBg: string; // Unanswered question background
  cellBgAnswered: string; // Answered question background
  cellText: string; // Question points text color
  activeBg: string; // Fullscreen question background
  activeText: string; // Fullscreen shared text color
  questionText: string; // Fullscreen question text color
  answerText: string; // Fullscreen answer text color
};

export type GameSettings = {
  timerEnabled: boolean;
  timerDuration: number;
  timerOnBuzzOnly?: boolean;
};

export type GameState = {
  title: string;
  categories: Category[];
  players: Player[];
  theme: Theme;
  settings?: GameSettings;
};

export const presetThemes: Record<string, Theme> = {
  classic: {
    presetName: 'Classic Jeopardy',
    boardBg: '#050a30',
    headerBg: 'rgba(0, 0, 0, 0.5)',
    headerText: '#ffffff',
    cellBg: 'rgba(30, 58, 138, 0.95)',
    cellBgAnswered: 'rgba(23, 37, 84, 0.7)',
    cellText: '#fbbf24', 
    activeBg: 'rgba(30, 64, 175, 0.95)',
    activeText: '#ffffff',
    questionText: '#ffffff',
    answerText: '#fbbf24',
  },
  neon: {
    presetName: 'Neon Cyberpunk',
    boardBg: '#09090b',
    headerBg: 'rgba(217, 70, 239, 0.15)',
    headerText: '#f0abfc',
    cellBg: 'rgba(6, 182, 212, 0.2)',
    cellBgAnswered: 'rgba(9, 9, 11, 0.8)',
    cellText: '#22d3ee',
    activeBg: 'rgba(0, 0, 0, 0.9)',
    activeText: '#f0abfc',
    questionText: '#f0abfc',
    answerText: '#22d3ee',
  },
  glass: {
    presetName: 'Vibrant Glass',
    boardBg: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
    headerBg: 'rgba(255, 255, 255, 0.2)',
    headerText: '#ffffff',
    cellBg: 'rgba(255, 255, 255, 0.25)',
    cellBgAnswered: 'rgba(255, 255, 255, 0.1)',
    cellText: '#ffffff',
    activeBg: 'rgba(30, 27, 75, 0.85)',
    activeText: '#ffffff',
    questionText: '#ffffff',
    answerText: '#fde047',
  },
  darkGlass: {
    presetName: 'Dark Glass',
    boardBg: 'linear-gradient(to top right, #000000, #1a1a2e)',
    headerBg: 'rgba(255, 255, 255, 0.1)',
    headerText: '#e2e8f0',
    cellBg: 'rgba(255, 255, 255, 0.15)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.6)',
    cellText: '#38bdf8',
    activeBg: 'rgba(15, 23, 42, 0.85)',
    activeText: '#ffffff',
    questionText: '#ffffff',
    answerText: '#38bdf8',
  },
  synthwave: {
    presetName: 'Synthwave',
    boardBg: 'linear-gradient(to bottom, #2d1b4e, #000000)',
    headerBg: 'rgba(255, 6, 119, 0.3)',
    headerText: '#00ffff',
    cellBg: 'rgba(57, 18, 128, 0.8)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.7)',
    cellText: '#fce411',
    activeBg: 'rgba(20, 5, 45, 0.9)',
    activeText: '#00ffff',
    questionText: '#00ffff',
    answerText: '#fce411',
  },
  royal: {
    presetName: 'Royal Velvet',
    boardBg: 'linear-gradient(135deg, #1e0b2b 0%, #4a0d3e 100%)',
    headerBg: 'rgba(212, 175, 55, 0.25)',
    headerText: '#d4af37',
    cellBg: 'rgba(107, 33, 84, 0.6)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.5)',
    cellText: '#fcd34d',
    activeBg: 'rgba(30, 11, 43, 0.9)',
    activeText: '#d4af37',
    questionText: '#d4af37',
    answerText: '#fcd34d',
  },
  ocean: {
    presetName: 'Deep Ocean',
    boardBg: 'linear-gradient(to bottom, #0ea5e9, #0369a1)',
    headerBg: 'rgba(255, 255, 255, 0.2)',
    headerText: '#ffffff',
    cellBg: 'rgba(255, 255, 255, 0.1)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.2)',
    cellText: '#ecfeff',
    activeBg: 'rgba(8, 47, 73, 0.9)',
    activeText: '#38bdf8',
    questionText: '#ffffff',
    answerText: '#ecfeff',
  },
  forest: {
    presetName: 'Mystic Forest',
    boardBg: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)',
    headerBg: 'rgba(0, 0, 0, 0.3)',
    headerText: '#a7f3d0',
    cellBg: 'rgba(16, 185, 129, 0.2)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.4)',
    cellText: '#6ee7b7',
    activeBg: 'rgba(2, 44, 34, 0.9)',
    activeText: '#a7f3d0',
    questionText: '#a7f3d0',
    answerText: '#6ee7b7',
  },
  sunset: {
    presetName: 'Desert Sunset',
    boardBg: 'linear-gradient(to bottom, #f97316, #be123c)',
    headerBg: 'rgba(255, 255, 255, 0.2)',
    headerText: '#fff1f2',
    cellBg: 'rgba(0, 0, 0, 0.25)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.5)',
    cellText: '#fde047',
    activeBg: 'rgba(67, 20, 7, 0.9)',
    activeText: '#fde047',
    questionText: '#fff1f2',
    answerText: '#fde047',
  },
  hacker: {
    presetName: 'Matrix Hacker',
    boardBg: '#000000',
    headerBg: 'rgba(34, 197, 94, 0.15)',
    headerText: '#4ade80',
    cellBg: 'rgba(0, 50, 0, 0.5)',
    cellBgAnswered: 'rgba(0, 0, 0, 0.8)',
    cellText: '#22c55e',
    activeBg: 'rgba(0, 10, 0, 0.95)',
    activeText: '#86efac',
    questionText: '#86efac',
    answerText: '#22c55e',
  },
  dracula: {
    presetName: 'Dracula',
    boardBg: '#282a36',
    headerBg: 'rgba(68, 71, 90, 0.8)',
    headerText: '#ff79c6',
    cellBg: '#44475a',
    cellBgAnswered: '#21222c',
    cellText: '#f1fa8c',
    activeBg: 'rgba(40, 42, 54, 0.95)',
    activeText: '#8be9fd',
    questionText: '#8be9fd',
    answerText: '#f1fa8c',
  },
  retro: {
    presetName: 'Retro Arcade',
    boardBg: '#222222',
    headerBg: 'rgba(255, 0, 0, 0.8)',
    headerText: '#ffffff',
    cellBg: '#0000ff',
    cellBgAnswered: '#111111',
    cellText: '#ffff00',
    activeBg: 'rgba(34, 34, 34, 0.95)',
    activeText: '#00ff00',
    questionText: '#ffffff',
    answerText: '#00ff00',
  },
  bubblegum: {
    presetName: 'Bubblegum Pop',
    boardBg: 'linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)',
    headerBg: '#be185d',
    headerText: '#fdf2f8',
    cellBg: '#fce7f3',
    cellBgAnswered: '#db2777',
    cellText: '#9d174d',
    activeBg: 'rgba(253, 242, 248, 0.95)',
    activeText: '#be185d',
    questionText: '#be185d',
    answerText: '#db2777',
  }
};

export const defaultTheme: Theme = presetThemes.classic;

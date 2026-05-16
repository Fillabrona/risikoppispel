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
  activeText: string; // Fullscreen question/answer text color
};

export type GameSettings = {
  timerEnabled: boolean;
  timerDuration: number;
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
  },
  minimal: {
    presetName: 'Minimal Light',
    boardBg: '#f8fafc',
    headerBg: 'rgba(226, 232, 240, 0.8)',
    headerText: '#0f172a',
    cellBg: '#ffffff',
    cellBgAnswered: '#f1f5f9',
    cellText: '#334155',
    activeBg: 'rgba(255, 255, 255, 0.95)',
    activeText: '#0f172a',
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
  }
};

export const defaultTheme: Theme = presetThemes.classic;

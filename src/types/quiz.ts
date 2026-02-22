/**
 * QuizState types for Apologia Sancta Live
 * 
 * This typed state object will later be fed by SSE backend.
 * The UI renders purely from this state with no internal business logic.
 */

/** Quiz phase controlled by server */
export type QuizPhase = "OPEN" | "LOCKED" | "REVEAL";

/** Connection status for SSE */
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

/** Answer choice */
export interface Choice {
  id: string;
  label: string; // A, B, C, D
  text: string;
}

/** Question data */
export interface Question {
  text: string;
  choices: Choice[];
  /** Only present when phase === "REVEAL" */
  correctId?: string;
}

/** Scorer entry in leaderboard */
export interface Scorer {
  rank: number;
  name: string;
  score: number;
}

/** Streaker entry in leaderboard */
export interface Streaker {
  rank: number;
  name: string;
  streak: number;
}

/** Leaderboard data */
export interface Leaderboard {
  topScorers: Scorer[];
  topStreaks: Streaker[];
}

/** Teaching moment content */
export interface Teaching {
  title: string;
  body: string;
  refs: string[];
  isOpenByDefault?: boolean;
}

/** Ticker bar content */
export interface Ticker {
  items: string[];
}

/**
 * Main QuizState - the single source of truth for UI rendering.
 * 
 * Server sends this over SSE. The UI maintains only:
 * - selectedId (client-local selection)
 * - connectionStatus (client-local)
 * - Previous leaderboard for diffing (client-local)
 */
export interface QuizState {
  /** Current quiz phase */
  phase: QuizPhase;
  
  /** Unix timestamp (ms) when current phase ends */
  endsAtMs: number;
  
  /** Current question index (0-based) */
  questionIndex: number;
  
  /** Total questions in quiz */
  totalQuestions: number;
  
  /** Theme/topic title */
  themeTitle: string;
  
  /** Current question data */
  question: Question;
  
  /** Leaderboard data */
  leaderboard: Leaderboard;
  
  /** Teaching moment (shown after reveal) */
  teaching?: Teaching;
  
  /** Ticker bar content */
  ticker?: Ticker;
}

/**
 * Client-side state extension.
 * These fields are managed locally, not from server.
 */
export interface ClientState {
  /** User's selected answer ID */
  selectedId?: string;
  
  /** SSE connection status */
  connectionStatus: ConnectionStatus;
}

/**
 * Scorer with change tracking for animation.
 * Used internally after diffing.
 */
export interface ScorerWithChange extends Scorer {
  changed?: boolean;
}

/**
 * Streaker with change tracking for animation.
 * Used internally after diffing.
 */
export interface StreakerWithChange extends Streaker {
  changed?: boolean;
}

/**
 * Leaderboard with change tracking for animation.
 */
export interface LeaderboardWithChanges {
  topScorers: ScorerWithChange[];
  topStreaks: StreakerWithChange[];
}

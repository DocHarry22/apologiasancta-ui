/**
 * QuizState types for Apologia Sancta Live
 * 
 * This typed state object will later be fed by SSE backend.
 * The UI renders purely from this state with no internal business logic.
 */

/** Quiz phase controlled by server */
export type QuizPhase = "OPEN" | "LOCKED" | "REVEAL";

/** Leaderboard time windows */
export type LeaderboardPeriod = "daily" | "weekly" | "all-time";

/** Leaderboard scope */
export type LeaderboardScope = "room" | "global";

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
  scope?: LeaderboardScope;
  period?: LeaderboardPeriod;
  roomId?: string;
  roomName?: string;
  snapshotAtMs?: number;
}

/** Room summary shown in room lists and selectors */
export interface RoomSummary {
  roomId: string;
  name: string;
  isActive: boolean;
  playerCount: number;
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
 * Player identity info returned by engine in personalized SSE streams.
 * Available when connecting with ?userId=... parameter.
 */
export interface PlayerInfo {
  userId: string;
  username: string;
  totalPoints: number;
  streak: number;
  rank: number;
  distanceToTop10?: number;
  roomId?: string;
  roomName?: string;
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

  /** Current room identity */
  roomId?: string;

  /** Current room name */
  roomName?: string;
  
  /** Current question data */
  question: Question;
  
  /** Leaderboard data */
  leaderboard: Leaderboard;
  
  /** Teaching moment (shown after reveal) */
  teaching?: Teaching;
  
  /** Ticker bar content */
  ticker?: Ticker;
  
  /** Personalized player info (only present when connected with userId) */
  me?: PlayerInfo;
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
 * Per-user score data for Score Feedback HUD.
 * This data is derived client-side from the leaderboard
 * until engine provides per-user events.
 */
export interface LocalPlayerData {
  /** Player name (from localStorage) */
  playerName: string | null;
  
  /** Player's total points (from leaderboard lookup) */
  totalPoints: number;
  
  /** Previous total points (for delta calculation) */
  previousPoints: number;
  
  /** Points awarded in the last question (calculated as delta) */
  lastAwardedPoints: number;
  
  /** Current streak count */
  streak: number;
  
  /** Player's rank in scorers list (undefined if not in top scorers) */
  rank?: number;
  
  /** Points needed to reach 10th place */
  distanceToTop10?: number;
}

/**
 * Future: Per-user event data that engine may provide.
 * When engine supports this, we can use it directly instead
 * of computing from leaderboard deltas.
 * 
 * To plug in engine-side lastAwardedPoints:
 * 1. Add lastAwardedPoints to the SSE event payload 
 *    (e.g., in the REVEAL phase data)
 * 2. Include player identification (playerName or session token)
 * 3. Update useLocalPlayer hook to use these values directly
 *    when available, falling back to delta calculation otherwise
 */
export interface EnginePlayerEvent {
  playerName: string;
  totalPoints: number;
  lastAwardedPoints: number;
  streak: number;
  rank?: number;
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
  scope?: LeaderboardScope;
  period?: LeaderboardPeriod;
  roomId?: string;
  roomName?: string;
  snapshotAtMs?: number;
}

// ============== Topic Completion Types ==============

/** Summary statistics for a completed topic */
export interface TopicSummaryStats {
  /** Average correct percentage across all participants */
  averageCorrectPct: number;
  /** Total number of participants who answered at least one question */
  totalParticipants: number;
  /** Highest score achieved in this topic */
  maxScore: number;
  /** Total questions in the topic */
  questionCount: number;
}

/** Scorer entry with streak info for topic summary */
export interface TopicScorerSummary extends Scorer {
  streak: number;
}

/** Top streak entry for topic summary */
export interface TopicStreakSummary {
  rank: number;
  name: string;
  streak: number;
  score: number;
}

/** Full topic completion summary data */
export interface TopicSummary {
  /** Leaders list (top scorers) */
  leaders: TopicScorerSummary[];
  /** Top streaks with scores */
  topStreaks: TopicStreakSummary[];
  /** Aggregate stats */
  stats: TopicSummaryStats;
}

/** Topic complete event payload received via SSE */
export interface TopicCompleteEvent {
  type: "topicComplete";
  /** Topic ID that was just completed */
  topicId: string;
  /** Topic display title */
  topicTitle: string;
  /** Summary data for display */
  summary: TopicSummary;
  /** Next topic ID (null if series complete) */
  nextTopicId: string | null;
  /** Next topic display title (null if series complete) */
  nextTopicTitle: string | null;
  /** Time (ms) until auto-advance to next topic (0 = manual only) */
  autoAdvanceMs: number;
  /** Whether this is the last topic in the series */
  isSeriesComplete: boolean;
}

/** Series complete event payload (shown when all topics are done) */
export interface SeriesCompleteEvent {
  type: "seriesComplete";
  /** All topics in the series */
  completedTopics: string[];
  /** Option to restart from beginning */
  canRestart: boolean;
}

/** Topic start event payload received via SSE when a new topic begins */
export interface TopicStartEvent {
  type: "topicStart";
  /** Topic ID that is starting */
  topicId: string;
  /** Topic display title */
  topicTitle: string;
  /** Index in the sequence (0-based) */
  topicIndex: number;
  /** Total topics in sequence */
  totalTopics: number;
}

/** Topic countdown event payload received via SSE before topic starts */
export interface TopicCountdownEvent {
  type: "topicCountdown";
  /** Topic ID that will start */
  topicId: string;
  /** Topic display title */
  topicTitle: string;
  /** Countdown duration in seconds */
  countdownSeconds: number;
  /** Unix timestamp (ms) when countdown ends */
  endsAtMs: number;
}

/** Congrats event payload received via SSE after topic completes */
export interface CongratsEvent {
  type: "congrats";
  /** Topic ID that was just completed */
  topicId: string;
  /** Topic display title */
  topicTitle: string;
  /** Summary data for display */
  summary: TopicSummary;
  /** Congrats display duration (ms) */
  displayDurationMs: number;
  /** Unix timestamp (ms) when congrats ends */
  endsAtMs: number;
  /** Next topic ID (null if series complete) */
  nextTopicId: string | null;
  /** Next topic display title (null if series complete) */
  nextTopicTitle: string | null;
  /** Whether this is the last topic in the series */
  isSeriesComplete: boolean;
}

/** Union type for all SSE event types */
export type SSEEvent = QuizState | TopicCompleteEvent | SeriesCompleteEvent | TopicStartEvent | TopicCountdownEvent | CongratsEvent;

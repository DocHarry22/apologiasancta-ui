"use client";

import { Suspense, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Layout,
  TopBar,
  CountdownRing,
  QuestionCard,
  AnswerList,
  TeachingMomentCard,
  LeaderboardColumn,
  TickerBar,
  AdminDrawer,
  YourScoreCard,
  JoinGameModal,
  RoomSelectionModal,
  TopicSummaryPanel,
  TopicCountdown,
  CongratsOverlay,
  FloatingLeaderboardButton,
  MobileLeaderboardDrawer,
  ScoreBurst,
  StreakToast,
} from "@/components/mobile";
import type { LeaderboardMode } from "@/components/mobile/LeaderboardColumn";
import { useLeaderboardDiff } from "@/hooks/useLeaderboardDiff";
import { useQuizSSE } from "@/hooks/useQuizSSE";
import { useLocalPlayer } from "@/hooks/useLocalPlayer";
import { useScoreDeltaAnimation } from "@/hooks/useScoreDeltaAnimation";
import { useRoomRegistration } from "@/hooks/useRoomRegistration";
import { useRoomSelectionBootstrap } from "@/hooks/useRoomSelectionBootstrap";
import { getEngineUrl } from "@/lib/publicEnv";
import { hapticSuccess, hapticError, hapticLight, keepAwake, allowSleep } from "@/lib/native";
import { getAnswerRejectionNotice, isAnswerWindowLocallyOpen } from "@/lib/answerSubmission";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import {
  getMobileOnboardingState,
  getPhaseCopy,
  type AnswerSubmissionState,
} from "@/lib/mobileUx";
import type { Leaderboard, QuizState, QuizPhase, TopicStartEvent, RoomSummary } from "@/types/quiz";

// Backend URL from environment (optional)
const ENGINE_URL = getEngineUrl();
const LEADERBOARD_REFRESH_MS = 15000;

// Duration for countdown timer (seconds)
const QUESTION_DURATION = 30;

// Mock QuizState - used when no backend URL is configured
function createMockQuizState(phase: QuizPhase = "OPEN"): QuizState {
  return {
    phase,
    endsAtMs: Date.now() + QUESTION_DURATION * 1000,
    questionIndex: 3, // 0-based
    totalQuestions: 12,
    themeTitle: "CHRISTOLOGY",
    question: {
      text: "Which council affirmed the divinity of Christ?",
      choices: [
        { id: "a", label: "A", text: "Council of Nicaea" },
        { id: "b", label: "B", text: "Council of Ephesus" },
        { id: "c", label: "C", text: "Council of Chalcedon" },
        { id: "d", label: "D", text: "Council of Trent" },
      ],
      // Only included when phase === "REVEAL"
      ...(phase === "REVEAL" ? { correctId: "a" } : {}),
    },
    leaderboard: {
      topScorers: [
        { rank: 1, name: "John", score: phase === "REVEAL" ? 70 : 60 },
        { rank: 2, name: "Sarah", score: 55 },
        { rank: 3, name: "Adam", score: 50 },
        { rank: 4, name: "Lisa", score: 45 },
        { rank: 5, name: "David", score: 40 },
        { rank: 6, name: "James", score: 35 },
        { rank: 7, name: "Emily", score: 30 },
        { rank: 8, name: "Michael", score: 25 },
        { rank: 9, name: "Robert", score: 25 },
        { rank: 10, name: "Emma", score: 20 },
      ],
      topStreaks: [
        { rank: 1, name: "Peter", streak: 6 },
        { rank: 2, name: "Gloria", streak: phase === "REVEAL" ? 5 : 4 },
        { rank: 3, name: "Paul", streak: 3 },
        { rank: 4, name: "Julia", streak: 3 },
        { rank: 5, name: "Mark", streak: 2 },
      ],
    },
    teaching: {
      title: "Teaching Moment",
      body: 'The Council of Nicaea in 325 AD affirmed that Jesus is "True God from True God," defining the doctrine of the Trinity.',
      refs: ["Nicene Creed", "CCC 465", "St. Athanasius"],
      isOpenByDefault: phase === "REVEAL",
    },
    ticker: {
      items: ["Fastest: Paul - 3.2s", "Streak: Gloria +4", "Leader: John (60)"],
    },
  };
}

function createWaitingQuizState(connectionStatus: "connecting" | "connected" | "reconnecting" | "polling" | "disconnected"): QuizState {
  const statusLabel =
    connectionStatus === "disconnected"
      ? "The engine is unreachable right now. The app will keep retrying."
      : connectionStatus === "reconnecting"
        ? "Trying to reconnect to the live room..."
        : connectionStatus === "polling"
          ? "Using polling fallback for live updates..."
          : "Connecting to the live room...";

  return {
    phase: "LOCKED",
    endsAtMs: 0,
    questionIndex: 0,
    totalQuestions: 0,
    themeTitle: "LIVE ROOM",
    question: {
      text: statusLabel,
      choices: [],
    },
    leaderboard: {
      topScorers: [],
      topStreaks: [],
      scope: "room",
      period: "all-time",
      snapshotAtMs: Date.now(),
    },
    ticker: {
      items: ["Waiting for engine", "Room state will appear automatically", "You can still switch rooms"],
    },
  };
}

/**
 * Hook that wraps SSE or mock state based on environment
 */
function useQuizState(userId: string | null, roomId: string | null, onTopicStart?: (event: TopicStartEvent) => void) {
  // SSE connection (pass ENGINE_URL or null, with optional userId for personalized stream)
  const sseResult = useQuizSSE(ENGINE_URL || null, { userId, roomId, onTopicStart });
  
  // Mock state (fallback when no ENGINE_URL)
  const [mockQuizState, setMockQuizState] = useState<QuizState>(() => 
    createMockQuizState("OPEN")
  );

  // Use SSE state if available, otherwise fall back to mock
  const isUsingSSE = Boolean(ENGINE_URL);
  const quizState = isUsingSSE
    ? sseResult.state || createWaitingQuizState(sseResult.connectionStatus)
    : mockQuizState;

  return {
    quizState,
    connectionStatus: sseResult.connectionStatus,
    setMockQuizState,
    isUsingSSE,
    topicCompleteEvent: sseResult.topicCompleteEvent,
    topicCountdownEvent: sseResult.topicCountdownEvent,
    congratsEvent: sseResult.congratsEvent,
    answerResultEvent: sseResult.answerResultEvent,
    clearTopicComplete: sseResult.clearTopicComplete,
    clearTopicCountdown: sseResult.clearTopicCountdown,
    clearCongrats: sseResult.clearCongrats,
    clearAnswerResult: sseResult.clearAnswerResult,
  };
}

export default function MobilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-(--mobile-bg) p-4 text-(--mobile-text)">Loading mobile quiz...</div>}>
      <MobilePageContent />
    </Suspense>
  );
}

function MobilePageContent() {
  const searchParams = useSearchParams();
  const {
    roomId,
    roomName,
    roomNotice,
    applyRoomSelection,
  } = useRoomSelectionBootstrap(searchParams);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("room-all-time");
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [remoteLeaderboard, setRemoteLeaderboard] = useState<Leaderboard | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const {
    userId,
    username,
    joinToken,
    isRegistered,
    isCheckingRegistration,
    handleJoined,
  } = useRoomRegistration({
    engineUrl: ENGINE_URL,
    roomId,
  });
  const [mePreviousPoints, setMePreviousPoints] = useState(0);
  const [meLastAwardedPoints, setMeLastAwardedPoints] = useState(0);
  const meSnapshotPointsRef = useRef(0);
  const mePhaseRef = useRef<QuizPhase>("OPEN");
  const meInitializedRef = useRef(false);
  const previousEffectScoreRef = useRef(0);
  const previousEffectStreakRef = useRef(0);
  const [scoreBurstKey, setScoreBurstKey] = useState(0);
  const [scoreBurstPoints, setScoreBurstPoints] = useState(0);
  const [streakToastKey, setStreakToastKey] = useState(0);
  const [answerSubmissionState, setAnswerSubmissionState] = useState<AnswerSubmissionState>("idle");
  const [answerNotice, setAnswerNotice] = useState<string | null>(null);

  const handleRoomSelected = useCallback((room: RoomSummary) => {
    applyRoomSelection(room.roomId, room.name);
    setIsRoomPickerOpen(false);
    setLeaderboardMode("room-all-time");
    setRemoteLeaderboard(null);
    setLeaderboardError(null);
    setSelectedId(undefined);
    setAnswerSubmissionState("idle");
    setAnswerNotice(null);
  }, [applyRoomSelection]);

  const handleSwitchRoom = useCallback(() => {
    setIsRoomPickerOpen(true);
  }, []);
  
  // Client-local state (never overwritten from server)
  const [selectedId, setSelectedId] = useState<string | undefined>();
  
  // Answer selection tracking refs - defined early so handleTopicStart can reset them
  const lastOpenRoundKeyRef = useRef<string>("");
  const answeredRoundKeyRef = useRef<string>("");
  const submittingRoundKeyRef = useRef<string>("");
  const lastQuestionSignatureRef = useRef<string>("");
  const lastResetQuestionRef = useRef<number>(-1);
  const selectedIdAtAnswerRef = useRef<string | undefined>(undefined);
  
  // Handle topic start event - reset all personal scores and answer state for new topic
  const handleTopicStart = useCallback(() => {
    console.log("[MobilePage] Topic start - resetting all state for new topic");
    setMePreviousPoints(0);
    setMeLastAwardedPoints(0);
    meSnapshotPointsRef.current = 0;
    meInitializedRef.current = false;
    // Reset all answer-related state for new topic
    setSelectedId(undefined);
    setAnswerSubmissionState("idle");
    setAnswerNotice(null);
    lastOpenRoundKeyRef.current = "";
    answeredRoundKeyRef.current = "";
    submittingRoundKeyRef.current = "";
    lastQuestionSignatureRef.current = "";
    lastResetQuestionRef.current = -1;
    selectedIdAtAnswerRef.current = undefined;
  }, []);
  
  const { 
    quizState, 
    connectionStatus, 
    setMockQuizState, 
    isUsingSSE,
    topicCompleteEvent,
    topicCountdownEvent,
    congratsEvent,
    answerResultEvent,
    clearTopicComplete,
    clearTopicCountdown,
    clearCongrats,
    clearAnswerResult,
  } = useQuizState(userId, roomId, handleTopicStart);
  
  // Admin drawer state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Reduced motion preference for accessibility
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);
  
  // Score history
  const { saveSession } = useScoreHistory();

  // Save score when a topic finishes
  useEffect(() => {
    if (!topicCompleteEvent || !roomId) return;
    void saveSession({
      date: new Date().toISOString(),
      roomId: roomId ?? "",
      topicId: topicCompleteEvent.topicId,
      score: meSnapshotPointsRef.current,
      correct: 0, // approximate — detailed tracking not available here
      total: topicCompleteEvent.summary.stats.questionCount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicCompleteEvent]);

  // Reset personal score display when topic completes and new topic starts
  const handleTopicSummaryDismiss = useCallback(() => {
    // Reset personal score tracking for new topic
    setMePreviousPoints(0);
    setMeLastAwardedPoints(0);
    meSnapshotPointsRef.current = 0;
    meInitializedRef.current = false;
    clearTopicComplete();
  }, [clearTopicComplete]);

  useEffect(() => {
    if (!ENGINE_URL || !isUsingSSE) {
      setRemoteLeaderboard(null);
      setLeaderboardError(null);
      setLeaderboardLoading(false);
      return;
    }

    if (leaderboardMode === "room-all-time") {
      setRemoteLeaderboard(null);
      setLeaderboardError(null);
      setLeaderboardLoading(false);
      return;
    }

    const buildUrl = () => {
      if (leaderboardMode === "global-all-time") {
        return `${ENGINE_URL}/leaderboard?period=all-time`;
      }

      if (!roomId) {
        return null;
      }

      if (leaderboardMode === "room-daily") {
        return `${ENGINE_URL}/rooms/${encodeURIComponent(roomId)}/leaderboard?period=daily`;
      }

      return `${ENGINE_URL}/rooms/${encodeURIComponent(roomId)}/leaderboard?period=weekly`;
    };

    const url = buildUrl();
    if (!url) {
      setRemoteLeaderboard(null);
      setLeaderboardError(null);
      setLeaderboardLoading(false);
      return;
    }

    let cancelled = false;

    const fetchLeaderboard = async () => {
      setLeaderboardLoading(true);

      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setLeaderboardError(data.error || `Failed to load leaderboard (${response.status})`);
          setRemoteLeaderboard(null);
          return;
        }

        setRemoteLeaderboard(data.leaderboard as Leaderboard);
        setLeaderboardError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLeaderboardError(error instanceof Error ? error.message : "Failed to load leaderboard");
        setRemoteLeaderboard(null);
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    };

    void fetchLeaderboard();
    const intervalId = window.setInterval(() => {
      void fetchLeaderboard();
    }, LEADERBOARD_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isUsingSSE, leaderboardMode, roomId, leaderboardRefreshKey]);

  const leaderboardState = useMemo(() => {
    return remoteLeaderboard ?? quizState.leaderboard;
  }, [remoteLeaderboard, quizState.leaderboard]);
  
  // Diff leaderboard for change animations
  const leaderboardWithChanges = useLeaderboardDiff(leaderboardState);

  // Local player data (score tracking, streak, rank) - fallback when 'me' not available
  const localPlayer = useLocalPlayer(quizState.leaderboard, quizState.phase);
  
  // Use 'me' data from SSE when available, otherwise fall back to local tracking
  const playerData = useMemo(() => {
    const me = quizState.me;
    if (me) {
      return {
        playerName: me.username,
        totalPoints: me.totalPoints,
        previousPoints: mePreviousPoints,
        lastAwardedPoints: meLastAwardedPoints,
        streak: me.streak,
        rank: me.rank,
        distanceToTop10: me.distanceToTop10,
      };
    }
    // Fallback to locally tracked data
    return {
      playerName: username || localPlayer.playerName,
      totalPoints: localPlayer.totalPoints,
      previousPoints: localPlayer.previousPoints,
      lastAwardedPoints: localPlayer.lastAwardedPoints,
      streak: localPlayer.streak,
      rank: localPlayer.rank,
      distanceToTop10: localPlayer.distanceToTop10,
    };
  }, [quizState.me, username, localPlayer, mePreviousPoints, meLastAwardedPoints]);

  useEffect(() => {
    const previousScore = previousEffectScoreRef.current;
    if (playerData.totalPoints > previousScore) {
      setScoreBurstPoints(playerData.lastAwardedPoints || playerData.totalPoints - previousScore);
      setScoreBurstKey((key) => key + 1);
    }
    previousEffectScoreRef.current = playerData.totalPoints;
  }, [playerData.lastAwardedPoints, playerData.totalPoints]);

  useEffect(() => {
    const previousStreak = previousEffectStreakRef.current;
    if (playerData.streak > previousStreak && playerData.streak > 1) {
      setStreakToastKey((key) => key + 1);
    }
    previousEffectStreakRef.current = playerData.streak;
  }, [playerData.streak]);

  const leaderboardPulseKey = useMemo(() => {
    const changedScore = leaderboardWithChanges.topScorers.find((scorer) => scorer.changed);
    const changedStreak = leaderboardWithChanges.topStreaks.find((streaker) => streaker.changed);
    return [
      leaderboardState.snapshotAtMs ?? quizState.questionIndex,
      changedScore?.name ?? "",
      changedScore?.rankDelta ?? "",
      changedStreak?.name ?? "",
      changedStreak?.rankDelta ?? "",
    ].join(":");
  }, [leaderboardState.snapshotAtMs, leaderboardWithChanges.topScorers, leaderboardWithChanges.topStreaks, quizState.questionIndex]);

  // Compute score delta from personalized SSE (`me`) when available
  useEffect(() => {
    const me = quizState.me;
    if (!me) return;

    if (!meInitializedRef.current) {
      meSnapshotPointsRef.current = me.totalPoints;
      setMePreviousPoints(me.totalPoints);
      setMeLastAwardedPoints(0);
      mePhaseRef.current = quizState.phase;
      meInitializedRef.current = true;
      return;
    }

    const wasNotReveal = mePhaseRef.current !== "REVEAL";
    const isNowReveal = quizState.phase === "REVEAL";
    const wasNotOpen = mePhaseRef.current !== "OPEN";
    const isNowOpen = quizState.phase === "OPEN";

    if (wasNotReveal && isNowReveal) {
      const prevPoints = meSnapshotPointsRef.current;
      const delta = Math.max(0, me.totalPoints - prevPoints);
      setMePreviousPoints(prevPoints);
      setMeLastAwardedPoints(delta);
    } else if (wasNotOpen && isNowOpen) {
      meSnapshotPointsRef.current = me.totalPoints;
      setMeLastAwardedPoints(0);
    }

    mePhaseRef.current = quizState.phase;
  }, [quizState.phase, quizState.me]);
  
  // Score delta animation system
  const { sourceRef, targetRef, triggerAnimation, AnimationPortal } = useScoreDeltaAnimation();
  const pendingRevealAnimationQuestionRef = useRef<number | null>(null);
  const interactionPhaseRef = useRef<QuizPhase>(quizState.phase);
  
  // Track previous phase/question to detect transitions
  const prevPhaseRef = useRef<QuizPhase>(quizState.phase);
  const prevQuestionIndexRef = useRef<number>(quizState.questionIndex);
  // Note: answer-related refs (lastOpenRoundKeyRef, answeredRoundKeyRef, etc.) 
  // are defined earlier so handleTopicStart can reset them

  // Reset selected answer when entering a NEW question (questionIndex changes) or new OPEN phase
  useEffect(() => {
    const isNewQuestion = quizState.questionIndex !== lastResetQuestionRef.current;
    if (isNewQuestion && quizState.phase === "OPEN") {
      console.log(`[MobilePage] New question detected (Q${quizState.questionIndex + 1}), resetting selection`);
      setSelectedId(undefined);
      setAnswerSubmissionState("idle");
      setAnswerNotice(null);
      clearAnswerResult();
      selectedIdAtAnswerRef.current = undefined;
      answeredRoundKeyRef.current = "";
      submittingRoundKeyRef.current = "";
      lastResetQuestionRef.current = quizState.questionIndex;
    }
  }, [quizState.questionIndex, quizState.phase, clearAnswerResult]);

  // Defensive reset when transitioning back into OPEN.
  // This avoids stale round lock refs from blocking answer selection on subsequent rounds.
  useEffect(() => {
    const previousPhase = interactionPhaseRef.current;

    if (quizState.phase === "OPEN" && previousPhase !== "OPEN") {
      setSelectedId(undefined);
      setAnswerSubmissionState("idle");
      setAnswerNotice(null);
      selectedIdAtAnswerRef.current = undefined;
      answeredRoundKeyRef.current = "";
      submittingRoundKeyRef.current = "";
    }

    if (quizState.phase !== "OPEN") {
      submittingRoundKeyRef.current = "";
    }

    interactionPhaseRef.current = quizState.phase;
  }, [quizState.phase]);

  // Hard reset selection for each new OPEN window, even if index/text are unchanged
  useEffect(() => {
    if (quizState.phase !== "OPEN") {
      return;
    }

    const openRoundKey = `${quizState.questionIndex}:${quizState.endsAtMs}`;
    
    // Always reset if the round key changed (or on first run with empty key)
    if (lastOpenRoundKeyRef.current !== openRoundKey) {
      console.log(`[MobilePage] New OPEN window detected (${openRoundKey}), ensuring selection is reset`);
      setSelectedId(undefined);
      setAnswerSubmissionState("idle");
      setAnswerNotice(null);
      selectedIdAtAnswerRef.current = undefined;
      answeredRoundKeyRef.current = "";
      submittingRoundKeyRef.current = "";
      lastResetQuestionRef.current = quizState.questionIndex;
      lastQuestionSignatureRef.current = "";
      lastOpenRoundKeyRef.current = openRoundKey;
    }
  }, [quizState.phase, quizState.questionIndex, quizState.endsAtMs]);

  // Also reset selection when question payload changes at same index (e.g. import + new pool)
  useEffect(() => {
    const choiceSignature = quizState.question.choices
      .map((choice) => `${choice.id}:${choice.text}`)
      .join("|");
    const signature = `${quizState.questionIndex}::${quizState.question.text}::${choiceSignature}`;

    // Reset if signature changed and we're in OPEN phase
    if (signature !== lastQuestionSignatureRef.current && quizState.phase === "OPEN") {
      console.log(`[MobilePage] Question content changed, resetting selection`);
      setSelectedId(undefined);
      setAnswerSubmissionState("idle");
      setAnswerNotice(null);
      selectedIdAtAnswerRef.current = undefined;
      answeredRoundKeyRef.current = "";
      submittingRoundKeyRef.current = "";
      lastResetQuestionRef.current = quizState.questionIndex;
    }

    lastQuestionSignatureRef.current = signature;
  }, [quizState.questionIndex, quizState.question.text, quizState.question.choices, quizState.phase]);

  // Capture selection when user picks an answer (before phase changes)
  useEffect(() => {
    if (selectedId && quizState.phase === "OPEN") {
      selectedIdAtAnswerRef.current = selectedId;
    }
  }, [selectedId, quizState.phase]);
  
  // Reset captured selection when new question starts
  useEffect(() => {
    selectedIdAtAnswerRef.current = undefined;
  }, [quizState.questionIndex]);

  // Trigger score delta animation when entering REVEAL phase
  useEffect(() => {
    const wasNotReveal = prevPhaseRef.current !== "REVEAL";
    const isNowReveal = quizState.phase === "REVEAL";
    const correctId = quizState.question.correctId;
    // Use snapshotted selection or current selection for animation
    const effectiveSelectedId = selectedIdAtAnswerRef.current || selectedId;
    const isCorrectSelection = Boolean(
      effectiveSelectedId &&
        correctId &&
        effectiveSelectedId.toLowerCase() === correctId.toLowerCase()
    );
    
    // Fire animation when transitioning into REVEAL
    if (
      wasNotReveal &&
      isNowReveal &&
      playerData.playerName &&
      effectiveSelectedId
    ) {
      if (isCorrectSelection) {
        void hapticSuccess();
        // Correct answers should animate with positive delta; if delta has not arrived yet,
        // defer until the `me`/local delta state updates.
        if (playerData.lastAwardedPoints > 0) {
          triggerAnimation(playerData.lastAwardedPoints);
        } else {
          pendingRevealAnimationQuestionRef.current = quizState.questionIndex;
        }
      } else {
        void hapticError();
        // Wrong answer feedback still animates as +0
        triggerAnimation(0);
      }
    }
    
    // Update refs for next comparison
    prevPhaseRef.current = quizState.phase;
    prevQuestionIndexRef.current = quizState.questionIndex;
  }, [quizState.phase, quizState.questionIndex, quizState.question.correctId, playerData.playerName, playerData.lastAwardedPoints, selectedId, triggerAnimation]);

  // Keep screen awake while a round is active; allow sleep on IDLE
  useEffect(() => {
    const active = quizState.phase === "OPEN" || quizState.phase === "LOCKED" || quizState.phase === "REVEAL";
    if (active) {
      void keepAwake();
    } else {
      void allowSleep();
    }
    return () => { void allowSleep(); };
  }, [quizState.phase]);

  // Flush deferred reveal animation once positive delta arrives
  useEffect(() => {
    const pendingQuestionIndex = pendingRevealAnimationQuestionRef.current;
    if (pendingQuestionIndex === null) return;
    if (quizState.phase !== "REVEAL") return;
    if (quizState.questionIndex !== pendingQuestionIndex) return;
    if (playerData.lastAwardedPoints <= 0) return;

    triggerAnimation(playerData.lastAwardedPoints);
    pendingRevealAnimationQuestionRef.current = null;
  }, [quizState.phase, quizState.questionIndex, playerData.lastAwardedPoints, triggerAnimation]);

  // Handle answer selection (client-local)
  const handleSelect = useCallback(async (id: string) => {
    if (!isAnswerWindowLocallyOpen({
      phase: quizState.phase,
      endsAtMs: quizState.endsAtMs,
    })) {
      setAnswerSubmissionState("error");
      setAnswerNotice(quizState.phase === "OPEN"
        ? getAnswerRejectionNotice("too_late")
        : getAnswerRejectionNotice("locked"));
      return;
    }
    const roundKey = `${quizState.questionIndex}:${quizState.endsAtMs}`;
    if (answeredRoundKeyRef.current === roundKey) return;
    if (submittingRoundKeyRef.current === roundKey) return;

    setSelectedId(id);
    void hapticLight();
    setAnswerSubmissionState(isUsingSSE && ENGINE_URL && userId && joinToken ? "submitting" : "submitted");
    setAnswerNotice("Submitted");
    submittingRoundKeyRef.current = roundKey;

    // Submit answer to backend when using SSE/live engine AND user is registered
    if (isUsingSSE && ENGINE_URL && userId && joinToken) {
      try {
        const response = await fetch(`${ENGINE_URL}/answer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${joinToken}`,
          },
          body: JSON.stringify({
            userId,
            username: username ?? undefined,
            choiceId: id,
            roomId,
          }),
        });

        let payload: { ok?: boolean; accepted?: boolean; reason?: string } | null = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        const accepted = response.ok && payload?.accepted !== false;
        if (!accepted) {
          console.warn(
            `[Mobile] Answer submit rejected: HTTP ${response.status}, reason=${payload?.reason || "unknown"}`
          );
          // Preserve selected state if engine says this user already answered this question.
          if (payload?.reason === "already_answered") {
            setSelectedId(id);
            answeredRoundKeyRef.current = roundKey;
            setAnswerSubmissionState("submitted");
            setAnswerNotice("Already submitted for this question.");
          } else {
            // For transport/validation failures, allow re-select.
            setSelectedId(undefined);
            setAnswerSubmissionState("error");
            setAnswerNotice(getAnswerRejectionNotice(payload?.reason));
          }
        } else {
          answeredRoundKeyRef.current = roundKey;
          setAnswerSubmissionState("submitted");
          setAnswerNotice("Answer submitted.");
        }
      } catch (error) {
        console.warn("[Mobile] Answer submit failed:", error);
        setSelectedId(undefined);
        setAnswerSubmissionState("error");
        setAnswerNotice("Connection issue. Try again.");
      } finally {
        submittingRoundKeyRef.current = "";
      }
    } else if (isUsingSSE && ENGINE_URL && (!userId || !joinToken)) {
      // SSE mode but user not registered - allow local selection but don't submit
      // This is a preview/spectator mode
      console.log("[Mobile] Answer selected (spectator mode - not registered)");
      answeredRoundKeyRef.current = roundKey;
      setAnswerSubmissionState("submitted");
      setAnswerNotice("Preview selected. Join the room to score points.");
      submittingRoundKeyRef.current = "";
    } else {
      // Mock mode: treat first click as accepted for this round
      answeredRoundKeyRef.current = roundKey;
      setAnswerSubmissionState("submitted");
      setAnswerNotice("Answer submitted.");
      submittingRoundKeyRef.current = "";
    }
    
    // Demo: Simulate phase transitions only when using mock
    if (!isUsingSSE) {
      setTimeout(() => {
        setMockQuizState((prev) => ({ ...prev, phase: "LOCKED" }));
        
        setTimeout(() => {
          setMockQuizState(createMockQuizState("REVEAL"));
        }, 1500);
      }, 100);
    }
  }, [quizState.phase, quizState.questionIndex, quizState.endsAtMs, isUsingSSE, setMockQuizState, userId, username, joinToken, roomId]);

  // Demo: Reset for testing (only in mock mode)
  const handleReset = useCallback(() => {
    setSelectedId(undefined);
    setAnswerSubmissionState("idle");
    setAnswerNotice(null);
    if (!isUsingSSE) {
      setMockQuizState(createMockQuizState("OPEN"));
    }
  }, [isUsingSSE, setMockQuizState]);

  // Convert teaching refs to format expected by TeachingMomentCard
  const teachingRefs = useMemo(() => 
    quizState.teaching?.refs.map((ref, i) => ({
      label: i === 0 ? "Ref" : i === 1 ? "Catechism" : "Fathers",
      value: ref,
    })) ?? []
  , [quizState.teaching?.refs]);

  const onboardingState = getMobileOnboardingState({
    engineConfigured: Boolean(ENGINE_URL),
    roomId,
    playerName: username || playerData.playerName,
    isRegistered,
    phase: quizState.phase,
  });

  const phaseCopy = getPhaseCopy({
    phase: quizState.phase,
    hasTopicCountdown: Boolean(topicCountdownEvent),
    hasTopicComplete: Boolean(topicCompleteEvent),
    hasCongrats: Boolean(congratsEvent),
    connectionStatus,
  });

  const currentRoundKey = `${quizState.questionIndex}:${quizState.endsAtMs}`;
  const hasSubmittedCurrentRound =
    Boolean(selectedId) &&
    (answeredRoundKeyRef.current === currentRoundKey ||
      submittingRoundKeyRef.current === currentRoundKey ||
      answerSubmissionState === "submitted" ||
      answerSubmissionState === "submitting");
  const showAdminEntry = searchParams.get("admin") === "1" || process.env.NODE_ENV !== "production";

  return (
    <>
      <Layout
        leftContent={
          <div className="mx-auto flex min-h-screen w-full max-w-screen flex-1 flex-col bg-(--mobile-bg) pb-[env(safe-area-inset-bottom)] text-(--mobile-text) lg:max-w-none lg:bg-transparent lg:text-inherit">
            {/* TopBar - always visible, not covered by overlays */}
            <TopBar
              roomName={quizState.roomName || roomName || undefined}
              topic={quizState.themeTitle}
              questionNumber={quizState.questionIndex + 1}
              totalQuestions={quizState.totalQuestions}
              connectionStatus={connectionStatus}
              onOpenAdmin={showAdminEntry ? () => setIsAdminOpen(true) : undefined}
              onSwitchRoom={isUsingSSE ? handleSwitchRoom : undefined}
            />

            {isUsingSSE && connectionStatus !== "connected" && (
              <div className="px-3 pt-2">
                <div className="rounded-xl border border-(--border) bg-(--card)/85 px-3 py-2 text-[11px] text-(--text-secondary)">
                  {connectionStatus === "disconnected"
                    ? "Live engine unavailable. The app is retrying in the background."
                    : connectionStatus === "reconnecting"
                      ? "Reconnecting to the live room..."
                      : connectionStatus === "polling"
                        ? "Using polling fallback for live updates."
                        : "Connecting to the live room..."}
                </div>
              </div>
            )}

            <div className="quiz-mobile-status-stack space-y-2 px-4 pt-3">
              <PhaseStatusPanel
                title={phaseCopy.title}
                detail={phaseCopy.detail}
                phase={quizState.phase}
                answerNotice={answerNotice}
                submitted={hasSubmittedCurrentRound}
              />
              <OnboardingStatusPanel
                state={onboardingState}
                roomName={quizState.roomName || roomName}
                roomId={roomId}
                playerName={username || playerData.playerName}
                notice={roomNotice}
                onChooseRoom={isUsingSSE ? handleSwitchRoom : undefined}
              />
            </div>
            
            {/* Main content area - can be overlayed by CongratsOverlay */}
            <div className="relative mx-auto flex w-full max-w-screen flex-1 flex-col pb-28 lg:max-w-none lg:pb-0">
          <div className="quiz-mobile-score-summary relative mx-4 mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-(--mobile-border) bg-(--mobile-panel) shadow-[0_10px_28px_var(--mobile-shadow)] lg:hidden">
            <div className="relative px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-(--mobile-muted)">
                <svg className="h-4 w-4 text-[#c99516]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="m12 2 2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3.1L6.2 20l1.1-6.5-4.8-4.6 6.6-.9L12 2Z" />
                </svg>
                Score
              </div>
              <div className="quiz-mobile-score-value mt-1 text-3xl font-bold tabular-nums text-(--mobile-text)">{playerData.totalPoints}</div>
              <ScoreBurst points={scoreBurstPoints} eventKey={scoreBurstKey} />
            </div>
            <div className="relative border-l border-(--mobile-border-strong) px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-(--mobile-muted)">
                <svg className="h-4 w-4 text-[#d77b22]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-4 4-8 4-8Zm-5.5 9.5C4.8 13 4 15 4 17a8 8 0 0 0 16 0c0-2-1-4-2.4-5.6.1.6.1 1.1.1 1.6a5.7 5.7 0 1 1-11.4 0c0-.5.1-1 .2-1.5Z" />
                </svg>
                Streak
              </div>
              <div className="quiz-mobile-score-value mt-1 text-3xl font-bold tabular-nums text-(--mobile-text)">{playerData.streak}</div>
              <StreakToast streak={playerData.streak} eventKey={streakToastKey} />
            </div>
          </div>
          <div className="quiz-mobile-player-details mx-4 mt-2 rounded-2xl border border-(--mobile-border) bg-(--mobile-panel) px-4 py-3 text-(--mobile-text) shadow-[0_8px_20px_var(--mobile-shadow)] lg:hidden">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-[0.14em] text-(--mobile-muted)">Player</p>
                <p className="mt-1 truncate font-bold">{playerData.playerName || "Not joined"}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold uppercase tracking-[0.14em] text-(--mobile-muted)">Rank</p>
                <p className="mt-1 font-bold">{playerData.rank ? `#${playerData.rank}` : "Waiting"}</p>
              </div>
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-[0.14em] text-(--mobile-muted)">Room</p>
                <p className="mt-1 truncate font-bold">{quizState.roomName || roomName || "Choose a room"}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold uppercase tracking-[0.14em] text-(--mobile-muted)">Last</p>
                <p className="mt-1 font-bold">{playerData.lastAwardedPoints > 0 ? `+${playerData.lastAwardedPoints}` : answerSubmissionState === "submitted" ? "Submitted" : "No points"}</p>
              </div>
            </div>
          </div>
          <div className="quiz-mobile-top-three mx-4 mt-2 rounded-2xl border border-(--mobile-border) bg-(--mobile-panel) px-4 py-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--mobile-muted)">Top 3</p>
              <button
                type="button"
                onClick={() => setIsLeaderboardOpen(true)}
                className="rounded-full border border-(--mobile-border) px-3 py-1 text-xs font-semibold text-(--mobile-muted)"
              >
                Open leaderboard
              </button>
            </div>
            <div className="mt-2 grid gap-2">
              {leaderboardWithChanges.topScorers.slice(0, 3).map((scorer) => (
                <div key={`${scorer.rank}-${scorer.name}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-(--mobile-text)">#{scorer.rank} {scorer.name}</span>
                  <span className="font-bold tabular-nums text-(--accent)">{scorer.score}</span>
                </div>
              ))}
              {leaderboardWithChanges.topScorers.length === 0 ? (
                <p className="text-sm text-(--mobile-muted)">No scores yet.</p>
              ) : null}
            </div>
          </div>

          {/* Countdown Timer */}
          <CountdownRing
            endsAtMs={quizState.endsAtMs}
            durationSeconds={QUESTION_DURATION}
            phase={quizState.phase}
          />

          {/* Question - with ref for score animation source */}
          <div ref={sourceRef}>
            <QuestionCard text={quizState.question.text} />
          </div>

          {/* Answer choices */}
          <AnswerList
            options={quizState.question.choices}
            selectedId={selectedId}
            correctId={quizState.question.correctId}
            phase={quizState.phase}
            answerResult={answerResultEvent}
            submissionState={answerSubmissionState}
            onSelect={handleSelect}
          />

          {/* Teaching moment (always visible during REVEAL) */}
          {quizState.teaching && quizState.phase === "REVEAL" && (
            <TeachingMomentCard
              title={quizState.teaching.title}
              explanation={quizState.teaching.body}
              references={teachingRefs}
              defaultOpen={Boolean(quizState.teaching.isOpenByDefault)}
            />
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Demo reset button (mock mode only) */}
          {!isUsingSSE && quizState.phase === "REVEAL" && (
            <div className="px-3 py-2">
              <button
                onClick={handleReset}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-(--accent) text-white hover:opacity-90 transition-opacity"
              >
                Reset Demo
              </button>
            </div>
          )}

          {/* Bottom ticker */}
          {quizState.ticker && (
            <div className="hidden lg:block">
            <TickerBar
              items={quizState.ticker.items.map((item, i) => ({
                label: item.split(":")[0],
                value: item.split(":")[1]?.trim() ?? item,
                highlight: i === 0,
              }))}
            />
            </div>
          )}

          <div className="px-4 pb-3 lg:hidden">
            <div className="flex items-center gap-3 text-sm font-semibold text-(--mobile-muted)">
              <span className="text-[#b98512]">Q{quizState.questionIndex + 1}</span>
              <span>/ {quizState.totalQuestions || 0}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--mobile-border)">
                <div
                  className="h-full rounded-full bg-linear-to-r from-[#d9a51c] to-[#b98512]"
                  style={{
                    width: `${quizState.totalQuestions > 0 ? ((quizState.questionIndex + 1) / quizState.totalQuestions) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Congrats Overlay - covers quiz/answers but not TopBar */}
          {congratsEvent && (
            <CongratsOverlay
              event={congratsEvent}
              prefersReducedMotion={prefersReducedMotion}
              onComplete={clearCongrats}
            />
          )}
            </div>
        </div>
        }
        rightContent={
          <div className="flex flex-col h-full">
            {/* Your Score card - pinned at top */}
            <YourScoreCard
              ref={targetRef}
              totalPoints={playerData.totalPoints}
              previousPoints={playerData.previousPoints}
              streak={playerData.streak}
              rank={playerData.rank}
              distanceToTop10={playerData.distanceToTop10}
              playerName={playerData.playerName}
            />
            
            {/* Topic Summary Panel (shown after topic completion) */}
            {topicCompleteEvent ? (
              <div className="flex-1 overflow-y-auto">
                <TopicSummaryPanel
                  event={topicCompleteEvent}
                  autoAdvanceMs={topicCompleteEvent.autoAdvanceMs}
                  onDismiss={handleTopicSummaryDismiss}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            ) : (
              /* Leaderboard (normal mode) */
              <div className="flex-1 overflow-y-auto">
                <LeaderboardColumn
                  scorers={leaderboardWithChanges.topScorers}
                  streakers={leaderboardWithChanges.topStreaks}
                  roomName={leaderboardState.roomName || quizState.roomName || roomName || undefined}
                  scope={leaderboardState.scope}
                  period={leaderboardState.period}
                  selectedMode={leaderboardMode}
                  onModeChange={setLeaderboardMode}
                  loading={leaderboardLoading}
                  error={leaderboardError}
                />
              </div>
            )}
          </div>
        }
      />

      <FloatingLeaderboardButton
        rank={playerData.rank}
        pulseKey={leaderboardPulseKey}
        onClick={() => setIsLeaderboardOpen(true)}
      />

      <MobileLeaderboardDrawer
        open={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        scorers={leaderboardWithChanges.topScorers}
        streakers={leaderboardWithChanges.topStreaks}
        roomName={leaderboardState.roomName || quizState.roomName || roomName || undefined}
        scope={leaderboardState.scope}
        period={leaderboardState.period}
        selectedMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        loading={leaderboardLoading}
        error={leaderboardError}
        lastUpdatedMs={leaderboardState.snapshotAtMs ?? null}
        onRefresh={() => setLeaderboardRefreshKey((key) => key + 1)}
      />
      
      {/* Score delta animation portal */}
      <AnimationPortal />
      
      {/* Admin Drawer */}
      <AdminDrawer
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        engineUrl={ENGINE_URL || null}
        connectionStatus={connectionStatus}
        roomId={roomId}
        roomName={roomName}
        onRoomSelected={handleRoomSelected}
      />
      
      {/* Join Game Modal - shown only when using SSE backend and not registered */}
      {!isCheckingRegistration && isUsingSSE && ENGINE_URL && (!roomId || isRoomPickerOpen) && (
        <RoomSelectionModal
          engineUrl={ENGINE_URL}
          onSelected={handleRoomSelected}
          currentRoomId={roomId}
          onClose={roomId ? () => setIsRoomPickerOpen(false) : undefined}
        />
      )}

      {!isCheckingRegistration && isUsingSSE && !!roomId && !isRegistered && (
        <JoinGameModal roomId={roomId} roomName={roomName} onJoined={handleJoined} />
      )}
      
      {/* Topic Countdown Overlay - shown before a new topic starts */}
      {topicCountdownEvent && (
        <TopicCountdown
          event={topicCountdownEvent}
          prefersReducedMotion={prefersReducedMotion}
          onComplete={clearTopicCountdown}
        />
      )}
    </>
  );
}

function PhaseStatusPanel({
  title,
  detail,
  phase,
  answerNotice,
  submitted,
}: {
  title: string;
  detail: string;
  phase: QuizPhase;
  answerNotice: string | null;
  submitted: boolean;
}) {
  const tone =
    phase === "OPEN"
      ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
      : phase === "REVEAL"
        ? "border-(--accent)/40 bg-(--accent)/10 text-(--mobile-text)"
        : "border-(--mobile-border) bg-(--mobile-elevated) text-(--mobile-text)";

  return (
    <section className={`rounded-2xl border px-4 py-3 shadow-[0_8px_20px_var(--mobile-shadow)] ${tone}`} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--mobile-muted)">
            {phase}
          </p>
          <h2 className="mt-0.5 text-base font-bold">{title}</h2>
          <p className="mt-1 text-xs text-(--mobile-muted)">{detail}</p>
        </div>
        {submitted ? (
          <span className="shrink-0 rounded-full border border-(--accent) bg-(--accent)/15 px-2 py-1 text-[10px] font-bold uppercase text-(--accent)">
            Submitted
          </span>
        ) : null}
      </div>
      {answerNotice ? (
        <p className="mt-2 rounded-lg bg-(--mobile-panel) px-3 py-2 text-xs text-(--mobile-muted)">
          {answerNotice}
        </p>
      ) : null}
    </section>
  );
}

function OnboardingStatusPanel({
  state,
  roomName,
  roomId,
  playerName,
  notice,
  onChooseRoom,
}: {
  state: ReturnType<typeof getMobileOnboardingState>;
  roomName?: string | null;
  roomId: string | null;
  playerName?: string | null;
  notice: string | null;
  onChooseRoom?: () => void;
}) {
  const copy: Record<ReturnType<typeof getMobileOnboardingState>, { title: string; detail: string }> = {
    engine_unavailable: { title: "Engine unavailable", detail: "Live play is not connected. You can still preview the demo state." },
    no_room_selected: { title: "Choose a room", detail: "Select the room shared by your host." },
    no_player_name: { title: "Enter your display name", detail: "Your name is used for score and streak tracking." },
    player_name_saved: { title: "Name saved", detail: "Choose a room to continue." },
    room_selected_not_registered: { title: "Join this room", detail: "Enter your display name to register for scoring." },
    registered_waiting: { title: "Waiting for host", detail: "Game will start soon." },
    ready: { title: "Ready", detail: "You are in the live room." },
  };
  const current = copy[state];

  if (state === "ready" && !notice) return null;

  return (
    <section className="rounded-2xl border border-(--mobile-border) bg-(--mobile-panel) px-4 py-3 text-(--mobile-text)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{current.title}</h2>
          <p className="mt-1 text-xs text-(--mobile-muted)">{notice || current.detail}</p>
          <p className="mt-2 truncate text-[11px] text-(--mobile-subtle)">
            {roomId ? `Room: ${roomName || roomId}` : "No room selected"}
            {playerName ? ` | Player: ${playerName}` : ""}
          </p>
        </div>
        {onChooseRoom ? (
          <button
            type="button"
            onClick={onChooseRoom}
            className="min-h-11 shrink-0 rounded-full border border-(--mobile-border) px-3 py-2 text-xs font-semibold text-(--mobile-muted)"
          >
            {roomId ? "Change" : "Choose"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

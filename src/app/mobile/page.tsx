"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  PLAYER_NAME_KEY,
} from "@/components/mobile";
import { useLeaderboardDiff } from "@/hooks/useLeaderboardDiff";
import { useQuizSSE } from "@/hooks/useQuizSSE";
import { useLocalPlayer } from "@/hooks/useLocalPlayer";
import { useScoreDeltaAnimation } from "@/hooks/useScoreDeltaAnimation";
import type { QuizState, QuizPhase } from "@/types/quiz";

// Backend URL from environment (optional)
const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL;

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

/**
 * Hook that wraps SSE or mock state based on environment
 */
function useQuizState(userId: string | null) {
  // SSE connection (pass ENGINE_URL or null, with optional userId for personalized stream)
  const sseResult = useQuizSSE(ENGINE_URL || null, { userId });
  
  // Mock state (fallback when no ENGINE_URL)
  const [mockQuizState, setMockQuizState] = useState<QuizState>(() => 
    createMockQuizState("OPEN")
  );

  // Use SSE state if available, otherwise fall back to mock
  const quizState = sseResult.state || mockQuizState;
  const isUsingSSE = Boolean(ENGINE_URL);

  return {
    quizState,
    connectionStatus: sseResult.connectionStatus,
    setMockQuizState,
    isUsingSSE,
  };
}

export default function MobilePage() {
  // Registration state
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);
  const [mePreviousPoints, setMePreviousPoints] = useState(0);
  const [meLastAwardedPoints, setMeLastAwardedPoints] = useState(0);
  const meSnapshotPointsRef = useRef(0);
  const mePhaseRef = useRef<QuizPhase>("OPEN");
  const meInitializedRef = useRef(false);
  
  // Check for existing registration on mount
  useEffect(() => {
    if (!ENGINE_URL) {
      setIsCheckingRegistration(false);
      return;
    }

    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("playerName");

    if (!storedUserId || !storedUsername) {
      setIsCheckingRegistration(false);
      return;
    }

    let cancelled = false;

    fetch(`${ENGINE_URL}/register/me?userId=${encodeURIComponent(storedUserId)}`)
      .then(async (res) => {
        if (cancelled) return;

        if (!res.ok) {
          localStorage.removeItem("userId");
          localStorage.removeItem("playerName");
          localStorage.removeItem(PLAYER_NAME_KEY);
          setIsRegistered(false);
          setUserId(null);
          setUsername(null);
          return;
        }

        const data = await res.json();
        setUserId(data.userId);
        setUsername(data.username);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("playerName", data.username);
        localStorage.setItem(PLAYER_NAME_KEY, data.username);
        setIsRegistered(true);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem("userId");
        localStorage.removeItem("playerName");
        localStorage.removeItem(PLAYER_NAME_KEY);
        setIsRegistered(false);
        setUserId(null);
        setUsername(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingRegistration(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);
  
  // Handle successful registration
  const handleJoined = useCallback((newUserId: string, newUsername: string) => {
    setUserId(newUserId);
    setUsername(newUsername);
    localStorage.setItem(PLAYER_NAME_KEY, newUsername);
    setIsRegistered(true);
    setIsCheckingRegistration(false);
  }, []);
  
  const { quizState, connectionStatus, setMockQuizState, isUsingSSE } = useQuizState(userId);
  
  // Client-local state (never overwritten from server)
  const [selectedId, setSelectedId] = useState<string | undefined>();
  
  // Admin drawer state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Diff leaderboard for change animations
  const leaderboardWithChanges = useLeaderboardDiff(quizState.leaderboard);

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
  
  // Track previous phase/question to detect transitions
  const prevPhaseRef = useRef<QuizPhase>(quizState.phase);
  const prevQuestionIndexRef = useRef<number>(quizState.questionIndex);
  // Separate ref for reset tracking to avoid clearing selection during same question
  const lastResetQuestionRef = useRef<number>(quizState.questionIndex);

  // Reset selected answer ONLY when entering a NEW question (questionIndex changes)
  useEffect(() => {
    const isNewQuestion = quizState.questionIndex !== lastResetQuestionRef.current;
    if (isNewQuestion && quizState.phase === "OPEN") {
      setSelectedId(undefined);
      lastResetQuestionRef.current = quizState.questionIndex;
    }
  }, [quizState.questionIndex, quizState.phase]);

  // Snapshot selectedId when answering to preserve for reveal animation
  const selectedIdAtAnswerRef = useRef<string | undefined>(undefined);
  
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
        // Correct answers should animate with positive delta; if delta has not arrived yet,
        // defer until the `me`/local delta state updates.
        if (playerData.lastAwardedPoints > 0) {
          triggerAnimation(playerData.lastAwardedPoints);
        } else {
          pendingRevealAnimationQuestionRef.current = quizState.questionIndex;
        }
      } else {
        // Wrong answer feedback still animates as +0
        triggerAnimation(0);
      }
    }
    
    // Update refs for next comparison
    prevPhaseRef.current = quizState.phase;
    prevQuestionIndexRef.current = quizState.questionIndex;
  }, [quizState.phase, quizState.questionIndex, quizState.question.correctId, playerData.playerName, playerData.lastAwardedPoints, selectedId, triggerAnimation]);

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
    if (quizState.phase !== "OPEN") return;
    if (selectedId) return; // first-answer-only in client to match engine scoring
    setSelectedId(id);

    // Submit answer to backend when using SSE/live engine
    if (isUsingSSE && ENGINE_URL && userId) {
      try {
        const response = await fetch(`${ENGINE_URL}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            username: username ?? undefined,
            choiceId: id,
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
          // Keep UI consistent with engine first-answer rule: allow re-select if submission failed.
          setSelectedId(undefined);
        }
      } catch (error) {
        console.warn("[Mobile] Answer submit failed:", error);
        setSelectedId(undefined);
      }
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
  }, [quizState.phase, selectedId, isUsingSSE, setMockQuizState, userId, username]);

  // Demo: Reset for testing (only in mock mode)
  const handleReset = useCallback(() => {
    setSelectedId(undefined);
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

  return (
    <>
      <Layout
        leftContent={
          <div className="flex flex-col flex-1 min-h-screen">
            {/* TopBar */}
            <TopBar
              topic={quizState.themeTitle}
              questionNumber={quizState.questionIndex + 1}
              totalQuestions={quizState.totalQuestions}
              connectionStatus={connectionStatus}
              onOpenAdmin={() => setIsAdminOpen(true)}
            />

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
            onSelect={handleSelect}
          />

          {/* Teaching moment (collapsible) */}
          {quizState.teaching && (
            <TeachingMomentCard
              title={quizState.teaching.title}
              explanation={quizState.teaching.body}
              references={teachingRefs}
              defaultOpen={quizState.teaching.isOpenByDefault}
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
            <TickerBar
              items={quizState.ticker.items.map((item, i) => ({
                label: item.split(":")[0],
                value: item.split(":")[1]?.trim() ?? item,
                highlight: i === 0,
              }))}
            />
          )}
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
            
            {/* Leaderboard */}
            <div className="flex-1 overflow-y-auto">
              <LeaderboardColumn
                scorers={leaderboardWithChanges.topScorers}
                streakers={leaderboardWithChanges.topStreaks}
              />
            </div>
          </div>
        }
      />
      
      {/* Score delta animation portal */}
      <AnimationPortal />
      
      {/* Admin Drawer */}
      <AdminDrawer
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        engineUrl={ENGINE_URL || null}
        connectionStatus={connectionStatus}
      />
      
      {/* Join Game Modal - shown only when using SSE backend and not registered */}
      {!isCheckingRegistration && isUsingSSE && !isRegistered && (
        <JoinGameModal onJoined={handleJoined} />
      )}
    </>
  );
}

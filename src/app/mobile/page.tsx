"use client";

import { useState, useCallback, useMemo } from "react";
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
} from "@/components/mobile";
import { useLeaderboardDiff } from "@/hooks/useLeaderboardDiff";
import { useQuizSSE } from "@/hooks/useQuizSSE";
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
function useQuizState() {
  // SSE connection (pass ENGINE_URL or null)
  const sseResult = useQuizSSE(ENGINE_URL || null);
  
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
  const { quizState, connectionStatus, setMockQuizState, isUsingSSE } = useQuizState();
  
  // Client-local state (never overwritten from server)
  const [selectedId, setSelectedId] = useState<string | undefined>();
  
  // Admin drawer state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Diff leaderboard for change animations
  const leaderboardWithChanges = useLeaderboardDiff(quizState.leaderboard);

  // Handle answer selection (client-local)
  const handleSelect = useCallback((id: string) => {
    if (quizState.phase !== "OPEN") return;
    setSelectedId(id);
    
    // Demo: Simulate phase transitions only when using mock
    if (!isUsingSSE) {
      setTimeout(() => {
        setMockQuizState((prev) => ({ ...prev, phase: "LOCKED" }));
        
        setTimeout(() => {
          setMockQuizState(createMockQuizState("REVEAL"));
        }, 1500);
      }, 100);
    }
  }, [quizState.phase, isUsingSSE, setMockQuizState]);

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
          />

          {/* Question */}
          <QuestionCard text={quizState.question.text} />

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
                className="w-full py-2 text-xs font-semibold rounded-lg bg-[color:var(--accent)] text-white hover:opacity-90 transition-opacity"
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
          <LeaderboardColumn
            scorers={leaderboardWithChanges.topScorers}
            streakers={leaderboardWithChanges.topStreaks}
          />
        }
      />
      
      {/* Admin Drawer */}
      <AdminDrawer
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        engineUrl={ENGINE_URL || null}
        connectionStatus={connectionStatus}
      />
    </>
  );
}

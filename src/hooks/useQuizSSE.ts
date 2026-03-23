"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { QuizState, ConnectionStatus, TopicCompleteEvent, TopicStartEvent, TopicCountdownEvent, CongratsEvent } from "@/types/quiz";

interface UseQuizSSEOptions {
  /** Optional user ID for personalized SSE stream (enables 'me' field in state) */
  userId?: string | null;
  /** Optional room ID for room-scoped streams */
  roomId?: string | null;
  /** Callback fired when a topic complete event is received */
  onTopicComplete?: (event: TopicCompleteEvent) => void;
  /** Callback fired when a topic start event is received */
  onTopicStart?: (event: TopicStartEvent) => void;
  /** Callback fired when a topic countdown event is received */
  onTopicCountdown?: (event: TopicCountdownEvent) => void;
  /** Callback fired when a congrats event is received */
  onCongrats?: (event: CongratsEvent) => void;
}

interface UseQuizSSEResult {
  state: QuizState | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  /** Current topic complete event (cleared when next topic starts) */
  topicCompleteEvent: TopicCompleteEvent | null;
  /** Current topic countdown event (cleared when countdown ends or new event) */
  topicCountdownEvent: TopicCountdownEvent | null;
  /** Current congrats event (cleared when countdown starts) */
  congratsEvent: CongratsEvent | null;
  /** Clear the topic complete event manually */
  clearTopicComplete: () => void;
  /** Clear the topic countdown event manually */
  clearTopicCountdown: () => void;
  /** Clear the congrats event manually */
  clearCongrats: () => void;
}

/** Max reconnection attempts before going OFFLINE */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Backoff delays in ms: 1s, 2s, 4s, 8s, 10s (capped) */
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 10000];

/** Polling interval when SSE fails (ms) */
const POLL_INTERVAL = 2000;

/**
 * Hook for consuming QuizState via SSE with fallback to polling.
 * 
 * - Connects to `${engineUrl}/events` via EventSource
 * - Optionally passes `?userId=...` for personalized streams with 'me' field
 * - Tracks connectionStatus: connecting -> connected -> reconnecting -> disconnected
 * - Uses exponential backoff for reconnection
 * - Falls back to polling /state when SSE is offline
 * - Handles topicComplete, topicStart, topicCountdown events for topic transitions
 * 
 * @param engineUrl - Backend URL (e.g., "http://localhost:4000") or null to disable
 * @param options - Optional configuration including callbacks for topic events
 * @returns {state, connectionStatus, lastError, topicCompleteEvent, topicCountdownEvent, clearTopicComplete, clearTopicCountdown}
 */
export function useQuizSSE(
  engineUrl: string | null,
  options: UseQuizSSEOptions = {}
): UseQuizSSEResult {
  const { userId, roomId, onTopicComplete, onTopicStart, onTopicCountdown, onCongrats } = options;
  // Initialize state based on engineUrl
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [topicCompleteEvent, setTopicCompleteEvent] = useState<TopicCompleteEvent | null>(null);
  const [topicCountdownEvent, setTopicCountdownEvent] = useState<TopicCountdownEvent | null>(null);
  const [congratsEvent, setCongratsEvent] = useState<CongratsEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    engineUrl ? "connecting" : "disconnected"
  );
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  // Refs to avoid stale closures
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isOfflineRef = useRef(false);
  const onTopicCompleteRef = useRef(onTopicComplete);
  const onTopicStartRef = useRef(onTopicStart);
  const onTopicCountdownRef = useRef(onTopicCountdown);
  const onCongratsRef = useRef(onCongrats);
  
  // Keep callback refs up to date
  useEffect(() => {
    onTopicCompleteRef.current = onTopicComplete;
  }, [onTopicComplete]);
  
  useEffect(() => {
    onTopicStartRef.current = onTopicStart;
  }, [onTopicStart]);
  
  useEffect(() => {
    onTopicCountdownRef.current = onTopicCountdown;
  }, [onTopicCountdown]);
  
  useEffect(() => {
    onCongratsRef.current = onCongrats;
  }, [onCongrats]);

  /**
   * Clear topic complete event
   */
  const clearTopicComplete = useCallback(() => {
    setTopicCompleteEvent(null);
  }, []);
  
  /**
   * Clear topic countdown event
   */
  const clearTopicCountdown = useCallback(() => {
    setTopicCountdownEvent(null);
  }, []);
  
  /**
   * Clear congrats event
   */
  const clearCongrats = useCallback(() => {
    setCongratsEvent(null);
  }, []);

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  /**
   * Close EventSource connection
   */
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /**
   * Fetch state via REST API (polling fallback)
   */
  const fetchState = useCallback(async () => {
    if (!engineUrl) return;
    
    try {
      const query = new URLSearchParams();
      if (roomId) {
        query.set("roomId", roomId);
      }

      const response = await fetch(`${engineUrl}/state${query.size > 0 ? `?${query.toString()}` : ""}`);
      if (response.ok) {
        const state: QuizState = await response.json();
        setQuizState(state);
        setLastError(undefined);
        
        // If we successfully poll while disconnected, upgrade to connected
        if (connectionStatus === "disconnected") {
          setConnectionStatus("connected");
        }
      } else {
        setLastError(`HTTP ${response.status}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Poll failed";
      console.warn("[useQuizSSE] Poll failed:", msg);
      setLastError(msg);
    }
  }, [engineUrl, connectionStatus, roomId]);

  /**
   * Start polling fallback
   */
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return; // Already polling

    console.log("[useQuizSSE] Starting polling fallback");
    
    // Immediate fetch
    fetchState();

    // Poll every 2 seconds
    pollTimerRef.current = setInterval(fetchState, POLL_INTERVAL);
  }, [fetchState]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      console.log("[useQuizSSE] Stopped polling");
    }
  }, []);
  
  // Use a ref to hold the connect function so it can reference itself
  const connectRef = useRef<() => void>(() => {});

  /**
   * Connect to SSE endpoint
   */
  useEffect(() => {
    connectRef.current = () => {
      if (!engineUrl) return;
      
      // Clean up existing connection
      closeConnection();
      clearTimers();

      // Build events URL with optional userId for personalized stream
      let eventsUrl = `${engineUrl}/events`;
      const query = new URLSearchParams();
      if (userId) {
        query.set("userId", userId);
      }
      if (roomId) {
        query.set("roomId", roomId);
      }
      if (query.size > 0) {
        eventsUrl += `?${query.toString()}`;
      }
      
      console.log(`[useQuizSSE] Connecting to ${eventsUrl}`);
      setConnectionStatus("connecting");
      setLastError(undefined);

      const eventSource = new EventSource(eventsUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[useQuizSSE] Connection opened");
        setConnectionStatus("connected");
        reconnectAttemptRef.current = 0;
        isOfflineRef.current = false;
        stopPolling(); // Stop polling if it was running
      };

      // Listen for default messages (no event type from server)
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is a typed event (topicComplete, topicStart, topicCountdown, seriesComplete)
          if (data.type === "topicComplete") {
            console.log("[useQuizSSE] Topic complete event received:", data.topicId);
            setTopicCompleteEvent(data as TopicCompleteEvent);
            setTopicCountdownEvent(null); // Clear any countdown
            onTopicCompleteRef.current?.(data as TopicCompleteEvent);
            return;
          }
          
          if (data.type === "topicStart") {
            console.log("[useQuizSSE] Topic start event received:", data.topicId);
            // Clear all topic-related events when new topic starts
            setTopicCompleteEvent(null);
            setTopicCountdownEvent(null);
            setCongratsEvent(null);
            onTopicStartRef.current?.(data as TopicStartEvent);
            return;
          }
          
          if (data.type === "topicCountdown") {
            console.log("[useQuizSSE] Topic countdown event received:", data.countdownSeconds, "seconds");
            setTopicCountdownEvent(data as TopicCountdownEvent);
            setCongratsEvent(null); // Clear congrats when countdown starts
            onTopicCountdownRef.current?.(data as TopicCountdownEvent);
            return;
          }
          
          if (data.type === "congrats") {
            console.log("[useQuizSSE] Congrats event received:", data.topicId);
            setCongratsEvent(data as CongratsEvent);
            setTopicCompleteEvent(null); // Clear any existing topic complete
            onCongratsRef.current?.(data as CongratsEvent);
            return;
          }
          
          if (data.type === "seriesComplete") {
            console.log("[useQuizSSE] Series complete event received");
            // Could handle series complete separately if needed
            return;
          }
          
          // Regular quiz state update
          const state: QuizState = data;
          setQuizState(state);
          
          // Clear all topic transition events when regular quiz state comes in
          // (indicates normal question flow has resumed)
          setTopicCompleteEvent(null);
          setTopicCountdownEvent(null);
          setCongratsEvent(null);
          
          // If we were reconnecting, we're now connected
          if (reconnectAttemptRef.current > 0) {
            setConnectionStatus("connected");
            reconnectAttemptRef.current = 0;
          }
        } catch (error) {
          console.error("[useQuizSSE] Failed to parse state:", error);
        }
      };

      eventSource.onerror = () => {
        const errorMsg = "SSE connection error";
        console.warn(`[useQuizSSE] ${errorMsg}`);
        setLastError(errorMsg);
        closeConnection();

        reconnectAttemptRef.current++;

        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          // Go offline, start polling fallback
          console.log("[useQuizSSE] Max attempts reached, going offline");
          setConnectionStatus("disconnected");
          isOfflineRef.current = true;
          startPolling();
          return;
        }

        // Attempt reconnection with backoff
        setConnectionStatus("reconnecting");
        const delayIndex = Math.min(reconnectAttemptRef.current - 1, BACKOFF_DELAYS.length - 1);
        const delay = BACKOFF_DELAYS[delayIndex] ?? BACKOFF_DELAYS[0];

        console.log(`[useQuizSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

        reconnectTimerRef.current = setTimeout(() => {
          connectRef.current();
        }, delay);
      };
    };
  }, [engineUrl, userId, roomId, closeConnection, clearTimers, stopPolling, startPolling]);

  /**
   * Initialize connection on mount (only when engineUrl is provided)
   * Also reconnects when userId changes to get personalized stream
   */
  useEffect(() => {
    if (!engineUrl) {
      // Already initialized as disconnected with null state
      return;
    }

    connectRef.current();

    // Cleanup on unmount
    return () => {
      console.log("[useQuizSSE] Unmounting, cleaning up");
      closeConnection();
      clearTimers();
      stopPolling();
    };
  }, [engineUrl, userId, closeConnection, clearTimers, stopPolling]);

  return {
    state: quizState,
    connectionStatus,
    lastError,
    topicCompleteEvent,
    topicCountdownEvent,
    congratsEvent,
    clearTopicComplete,
    clearTopicCountdown,
    clearCongrats,
  };
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { PLAYER_NAME_KEY } from "./YourScoreCard";

interface JoinGameModalProps {
  onJoined: (userId: string, username: string) => void;
}

interface RegistrationState {
  status: "idle" | "loading" | "error";
  errorMessage?: string;
}

const API_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:4000";

/**
 * Full-screen modal for joining the game with a unique username.
 * Blocks interaction with the game until registration is complete.
 */
export function JoinGameModal({ onJoined }: JoinGameModalProps) {
  const [username, setUsername] = useState("");
  const [state, setState] = useState<RegistrationState>({ status: "idle" });

  // Check for existing registration on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("playerName");
    
    if (storedUserId && storedUsername) {
      // Verify the registration is still valid
      fetch(`${API_URL}/register/me?userId=${encodeURIComponent(storedUserId)}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            onJoined(data.userId, data.username);
          } else {
            // Registration expired or invalid, clear storage
            localStorage.removeItem("userId");
            localStorage.removeItem("playerName");
          }
        })
        .catch(() => {
          // Network error, let user try fresh registration
          localStorage.removeItem("userId");
          localStorage.removeItem("playerName");
        });
    }
  }, [onJoined]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = username.trim();
    if (!trimmed) return;
    
    setState({ status: "loading" });
    
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Save credentials to localStorage
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("playerName", data.username);
        localStorage.setItem(PLAYER_NAME_KEY, data.username);
        
        onJoined(data.userId, data.username);
      } else if (res.status === 409) {
        setState({ 
          status: "error", 
          errorMessage: "Username already taken. Please choose another." 
        });
      } else if (res.status === 400) {
        setState({ 
          status: "error", 
          errorMessage: data.error || "Invalid username. Use 3-20 characters (letters, numbers, underscores)." 
        });
      } else if (res.status === 429) {
        setState({ 
          status: "error", 
          errorMessage: "Too many attempts. Please wait a moment and try again." 
        });
      } else {
        setState({ 
          status: "error", 
          errorMessage: data.error || "Registration failed. Please try again." 
        });
      }
    } catch (err) {
      console.error("Registration error:", err);
      setState({ 
        status: "error", 
        errorMessage: "Connection failed. Please check your internet and try again." 
      });
    }
  }, [username, onJoined]);

  const isValidUsername = username.trim().length >= 3 && 
                          username.trim().length <= 20 && 
                          /^[a-zA-Z0-9_]+$/.test(username.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div 
        className="w-full max-w-md mx-4 p-8 rounded-2xl shadow-2xl"
        style={{ 
          backgroundColor: "var(--card)",
          border: "1px solid var(--card-border)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--accent)" }}
          >
            ✝ Apologia Sancta
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Join the live theology quiz
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="username" 
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              Choose your username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a unique name..."
              disabled={state.status === "loading"}
              className="w-full px-4 py-3 rounded-lg text-lg outline-none transition-all"
              style={{
                backgroundColor: "var(--option-bg)",
                border: "2px solid var(--option-border)",
                color: "var(--text)",
              }}
              autoFocus
              autoComplete="off"
              maxLength={20}
            />
            <p 
              className="mt-2 text-sm"
              style={{ color: "var(--muted)" }}
            >
              3-20 characters: letters, numbers, underscores
            </p>
          </div>

          {/* Error Message */}
          {state.status === "error" && state.errorMessage && (
            <div 
              className="p-3 rounded-lg text-sm"
              style={{ 
                backgroundColor: "var(--wrong-bg)",
                color: "var(--wrong)",
              }}
            >
              {state.errorMessage}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValidUsername || state.status === "loading"}
            className="w-full py-4 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isValidUsername ? "var(--accent)" : "var(--muted)",
              color: isValidUsername ? "#fff" : "var(--text-secondary)",
            }}
          >
            {state.status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span>
                Joining...
              </span>
            ) : (
              "Join Game"
            )}
          </button>
        </form>

        {/* Footer */}
        <p 
          className="mt-6 text-center text-xs"
          style={{ color: "var(--muted)" }}
        >
          Your username will appear on the leaderboard
        </p>
      </div>
    </div>
  );
}

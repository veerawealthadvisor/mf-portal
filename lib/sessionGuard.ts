"use client";
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { useRouter } from "next/navigation";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 25 * 60 * 1000; // warn at 25 minutes

export function useSessionGuard() {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warnRef  = useRef<NodeJS.Timeout | null>(null);
  const warnedRef = useRef(false);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnRef.current)  clearTimeout(warnRef.current);
  };

  const logout = async () => {
    clearTimers();
    await supabase.auth.signOut();
    router.push("/login?reason=timeout");
  };

  const resetTimer = () => {
    clearTimers();
    warnedRef.current = false;

    // Warn at 25 minutes
    warnRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true;
        const stay = window.confirm(
          "⏰ You have been inactive for 25 minutes.\n\nClick OK to stay logged in, or Cancel to log out."
        );
        if (stay) {
          resetTimer(); // reset full 30 min on confirmation
        } else {
          logout();
        }
      }
    }, WARNING_MS);

    // Force logout at 30 minutes
    timerRef.current = setTimeout(() => {
      logout();
    }, TIMEOUT_MS);
  };

  useEffect(() => {
    // Events that count as activity
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

    const handleActivity = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimer(); // start timer on mount

    // Also handle tab visibility — pause timer when tab is hidden
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
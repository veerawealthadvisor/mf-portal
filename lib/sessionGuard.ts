"use client";
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

const TIMEOUT_MS = 30 * 60 * 1000;  // change to 30 * 60 * 1000 after testing
const WARNING_MS = 25 * 60 * 1000; // change to 25 * 60 * 1000 after testing

export function useSessionGuard(router: any) {
  const timerRef  = useRef<any>(null);
  const warnRef   = useRef<any>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    const logout = async () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      await supabase.auth.signOut();
      router.push("/login?reason=timeout");
    };

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      warnedRef.current = false;

      warnRef.current = setTimeout(() => {
        warnedRef.current = true;
        const stay = window.confirm(
          "⏰ You have been inactive for 25 minutes.\n\nClick OK to stay logged in, or Cancel to log out."
        );
        if (stay) resetTimer();
        else logout();
      }, WARNING_MS);

      timerRef.current = setTimeout(() => {
        logout();
      }, TIMEOUT_MS);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);
}
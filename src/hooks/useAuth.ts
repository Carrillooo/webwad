"use client";
import { useCallback, useEffect, useState } from "react";
import { browserSupabase, setAuthCookie } from "@/lib/supabase/client";

type AuthState = "unconfigured" | "signed_out" | "signed_in" | "sent";

/** Supabase magic-link auth. Keeps a `sb-access-token` cookie in sync so the
 *  server (resolveUser) persists per-user with RLS. Optional: without login,
 *  ZERO already persists in single-owner mode. */
export function useAuth() {
  const [state, setState] = useState<AuthState>("unconfigured");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = browserSupabase();
    if (!sb) return setState("unconfigured");
    sb.auth.getSession().then(({ data }) => {
      const s = data.session;
      setAuthCookie(s?.access_token ?? null);
      setEmail(s?.user?.email ?? null);
      setState(s ? "signed_in" : "signed_out");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setAuthCookie(session?.access_token ?? null);
      setEmail(session?.user?.email ?? null);
      setState(session ? "signed_in" : "signed_out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendLink = useCallback(async (addr: string) => {
    const sb = browserSupabase();
    if (!sb) return;
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo } });
    if (!error) setState("sent");
  }, []);

  const signOut = useCallback(async () => {
    const sb = browserSupabase();
    await sb?.auth.signOut();
    setAuthCookie(null);
    setState("signed_out");
  }, []);

  return { state, email, sendLink, signOut };
}

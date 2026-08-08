import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../services/supabase";

interface UserProfile {
  gameUsername: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = getSupabaseClient();
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.warn("Could not restore the Supabase session.", error);
      setSession(data.session);
      setLoading(false);
      void loadProfile(data.session, setProfile);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
        void loadProfile(nextSession, setProfile);
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signOut: async () => {
        if (!isSupabaseConfigured) return;
        const { error } = await getSupabaseClient().auth.signOut();
        if (error) throw new Error(error.message);
      }
    }),
    [loading, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

async function loadProfile(
  session: Session | null,
  setProfile: (profile: UserProfile | null) => void
): Promise<void> {
  if (!session) {
    setProfile(null);
    return;
  }

  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("game_username")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Could not load the user profile.", error);
    setProfile(null);
    return;
  }

  setProfile(
    data && typeof data.game_username === "string"
      ? { gameUsername: data.game_username }
      : null
  );
}

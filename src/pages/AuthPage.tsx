import { useState, type FormEvent } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../auth/AuthContext";
import { getSupabaseClient, isSupabaseConfigured } from "../services/supabase";
import { getAppBasePath } from "../utils/routing";

interface AuthPageProps {
  mode: "sign-in" | "sign-up";
}

export function AuthPage({ mode }: AuthPageProps) {
  const { session, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gameUsername, setGameUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const signingUp = mode === "sign-up";
  const appBasePath = getAppBasePath();

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured for this deployment.");
      }

      const supabase = getSupabaseClient();
      if (signingUp) {
        const username = gameUsername.trim();
        if (!username) throw new Error("Enter your in-game username.");

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { game_username: username },
            emailRedirectTo: `${window.location.origin}${appBasePath}`
          }
        });
        if (error) throw new Error(error.message);

        setMessage(
          data.session
            ? "Your account is ready and you are signed in."
            : "Account created. Check your email to confirm your address."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw new Error(error.message);
        window.location.hash = "";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout
      activePage={null}
      title={signingUp ? "Create Your Account" : "Welcome Back"}
      subtitle={
        signingUp
          ? "Claim your Heroes III identity."
          : "Sign in to your battle ledger."
      }
      actions={null}
    >
      <section className="panel auth-panel">
        {session ? (
          <div className="auth-signed-in">
            <p className="eyebrow">Authenticated</p>
            <h2>You are already signed in</h2>
            <p>
              Signed in as{" "}
              <strong>{profile?.gameUsername ?? session.user.email}</strong>.
            </p>
            <a className="button button-primary auth-link" href={appBasePath}>
              Return to tournament
            </a>
          </div>
        ) : (
          <>
            <div className="auth-heading">
              <p className="eyebrow">{signingUp ? "New hero" : "Existing hero"}</p>
              <h2>{signingUp ? "Sign up" : "Sign in"}</h2>
              <p>
                {signingUp
                  ? "Your username is the unique name other players will recognize."
                  : "Use the email address and password attached to your account."}
              </p>
            </div>
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
              {signingUp && (
                <label className="form-field">
                  <span>In-game username</span>
                  <input
                    value={gameUsername}
                    minLength={1}
                    maxLength={30}
                    autoComplete="nickname"
                    required
                    onChange={(event) => setGameUsername(event.target.value)}
                  />
                </label>
              )}
              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  required
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  minLength={6}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {message && (
                <p className="auth-message" role="status">{message}</p>
              )}
              <button
                className="button button-primary"
                type="submit"
                disabled={busy || !isSupabaseConfigured}
              >
                {busy ? "Working…" : signingUp ? "Create account" : "Sign in"}
              </button>
            </form>
            <p className="auth-switch">
              {signingUp ? "Already have an account?" : "Need an account?"}{" "}
              <a href={`${appBasePath}#/${signingUp ? "sign-in" : "sign-up"}`}>
                {signingUp ? "Sign in" : "Sign up"}
              </a>
            </p>
          </>
        )}
      </section>
    </Layout>
  );
}

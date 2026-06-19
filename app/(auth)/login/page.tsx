"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FileText, Layers, DollarSign, ArrowLeft, Mail, ShieldCheck, Clock } from "lucide-react";

const ADMIN_EMAIL = "tech@planckoff.com";

const FEATURES = [
  {
    icon: FileText,
    title: "AI reads your door schedules",
    desc: "Upload any PDF or Excel — AI extracts every door tag, size, fire rating, and hardware group automatically.",
  },
  {
    icon: Layers,
    title: "Hardware matched instantly",
    desc: "Each door is matched to the correct hardware set from your library. No manual lookups, no binders.",
  },
  {
    icon: DollarSign,
    title: "Days of work done in hours",
    desc: "Submittals, procurement summaries, and pricing reports generated in one click.",
  },
];

const RESET_HINTS = [
  {
    icon: Mail,
    title: "Check your inbox",
    desc: "We'll send a secure reset link to your registered email address.",
  },
  {
    icon: ShieldCheck,
    title: "One-time link",
    desc: "The link is unique to your account and can only be used once.",
  },
  {
    icon: Clock,
    title: "Expires in 1 hour",
    desc: "For your security, the link expires 1 hour after it's sent.",
  },
];

type Mode = "login" | "forgot" | "forgot-sent";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const redirectTo = searchParams.get("redirectTo") ?? "/";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoginSubmitting(true);

    const { error } = await login(email, password);

    if (error) {
      setLoginError(error);
      setIsLoginSubmitting(false);
      return;
    }

    router.replace(redirectTo);
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError(null);
    setIsForgotSubmitting(true);

    const trimmed = forgotEmail.trim().toLowerCase();

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const json = (await res.json()) as { error?: string };

      if (!res.ok) {
        setForgotError(
          res.status === 429
            ? "Too many attempts. Please try again later."
            : (json.error ?? "Failed to send the reset email. Please try again.")
        );
        return;
      }

      setSentTo(trimmed);
      setMode("forgot-sent");
    } catch {
      setForgotError("Network error. Please check your connection.");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const switchToForgot = () => {
    // Pre-fill the forgot email with whatever the user typed in the login form
    if (email) setForgotEmail(email);
    setForgotError(null);
    setMode("forgot");
  };

  const switchToLogin = () => {
    setForgotError(null);
    setMode("login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isForgotMode = mode === "forgot" || mode === "forgot-sent";

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between bg-[#0f172a] px-12 py-10 relative overflow-hidden">
        {/* grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* glow blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Image
            src="/images/logo.svg"
            alt="PlanckOff"
            width={148}
            height={36}
            priority
            className="brightness-0 invert"
          />
        </div>

        {/* Body — swaps between login copy and reset copy */}
        <div className="relative z-10 flex flex-col gap-10">
          {isForgotMode ? (
            /* ── Forgot password left panel ── */
            <div
              key="forgot-copy"
              className="flex flex-col gap-10"
              style={{ animation: "fadeSlideIn 0.35s ease both" }}
            >
              <div>
                <h1 className="text-[2.15rem] font-bold leading-tight tracking-tight text-white">
                  Reset your
                  <br />
                  <span className="text-blue-400">password.</span>
                </h1>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-400 max-w-sm">
                  Enter your registered email and we'll send you a secure link
                  to choose a new password.
                </p>
              </div>

              <ul className="flex flex-col gap-6">
                {RESET_HINTS.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20 ring-1 ring-blue-500/30">
                      <Icon size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-[0.8rem] leading-relaxed text-slate-400">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-lg border border-slate-700 bg-slate-800/50 px-5 py-4">
                <p className="text-[0.8rem] leading-relaxed text-slate-400">
                  Can't remember your email address?{" "}
                  <a
                    href={`mailto:${ADMIN_EMAIL}?subject=PlanckOff%20Account%20Access`}
                    className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Contact your admin
                  </a>{" "}
                  at{" "}
                  <a
                    href={`mailto:${ADMIN_EMAIL}`}
                    className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {ADMIN_EMAIL}
                  </a>
                </p>
              </div>
            </div>
          ) : (
            /* ── Login left panel ── */
            <div
              key="login-copy"
              className="flex flex-col gap-10"
              style={{ animation: "fadeSlideIn 0.35s ease both" }}
            >
              <div>
                <h1 className="text-[2.15rem] font-bold leading-tight tracking-tight text-white">
                  Hardware estimating,
                  <br />
                  <span className="text-blue-400">powered by AI.</span>
                </h1>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-400 max-w-sm">
                  PlanckOff turns large door schedules into finished submittals,
                  procurement lists, and pricing reports — automatically.
                </p>
              </div>

              <ul className="flex flex-col gap-6">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20 ring-1 ring-blue-500/30">
                      <Icon size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-[0.8rem] leading-relaxed text-slate-400">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="relative z-10 text-[0.72rem] text-slate-600">
          © {new Date().getFullYear()} PlanckOff. Built for door hardware estimators.
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Image src="/images/logo.svg" alt="PlanckOff" width={148} height={36} priority />
        </div>

        <div className="w-full max-w-sm">
          {mode === "login" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Welcome back</h2>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                  Sign in to your PlanckOff account
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)]">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="you@company.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={switchToForgot}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <PasswordInput
                      id="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>

                  <ErrorDisplay error={loginError} />

                  <button
                    type="submit"
                    disabled={isLoginSubmitting}
                    className="relative w-full overflow-hidden rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoginSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Signing in…
                      </span>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </form>
              </div>

              <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
                Access is by invitation only.{" "}
                <span className="text-[var(--text-muted)]">
                  Contact your administrator at{" "}
                  <a href={`mailto:${ADMIN_EMAIL}`} className="font-medium text-blue-600 hover:underline">
                    {ADMIN_EMAIL}
                  </a>{" "}
                  to get access.
                </span>
              </p>
            </div>
          )}

          {mode === "forgot" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="mb-8">
                <button
                  onClick={switchToLogin}
                  className="mb-4 flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Forgot password?</h2>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                  Enter your registered email and we'll send you a reset link.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm">
                <form onSubmit={handleForgot} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-[var(--text-secondary)]">
                      Email address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="block w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="you@company.com"
                    />
                  </div>

                  <ErrorDisplay error={forgotError} />

                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="relative w-full overflow-hidden rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isForgotSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Sending…
                      </span>
                    ) : (
                      "Send reset link"
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {mode === "forgot-sent" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="mb-8">
                <button
                  onClick={switchToLogin}
                  className="mb-4 flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Check your email</h2>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                  A reset link has been sent to your inbox.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm space-y-5">
                <div className="flex items-start gap-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3.5">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                    <Mail className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
                    We sent a reset link to{" "}
                    <strong className="font-semibold">{sentTo}</strong>.
                    Check your inbox and spam folder.
                  </p>
                </div>

                <p className="text-xs text-[var(--text-muted)] text-center">
                  The link expires in <strong className="text-[var(--text)]">1 hour</strong>.
                  Didn't get it?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Resend
                  </button>
                </p>

                <button
                  onClick={switchToLogin}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition-all hover:bg-[var(--bg-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Back to login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

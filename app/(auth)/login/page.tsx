"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FileText, Layers, DollarSign } from "lucide-react";

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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = searchParams.get("redirectTo") ?? "/";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: loginError } = await login(email, password);

    if (loginError) {
      setError(loginError);
      setIsSubmitting(false);
      return;
    }

    router.replace(redirectTo);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between bg-[#0f172a] px-12 py-10 relative overflow-hidden">
        {/* subtle grid overlay */}
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
          style={{
            background:
              "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          }}
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

        {/* Hero copy */}
        <div className="relative z-10 flex flex-col gap-10">
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
                  <p className="mt-0.5 text-[0.8rem] leading-relaxed text-slate-400">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-[0.72rem] text-slate-600">
          © {new Date().getFullYear()} PlanckOff. Built for door hardware
          estimators.
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/images/logo.svg"
            alt="PlanckOff"
            width={148}
            height={36}
            priority
          />
        </div>

        <div className="w-full max-w-sm animate-fadeIn">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              Sign in to your PlanckOff account
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[var(--text-secondary)]"
                >
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
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--text-secondary)]"
                >
                  Password
                </label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <ErrorDisplay error={error} />

              <button
                type="submit"
                disabled={isSubmitting}
                className="relative w-full overflow-hidden rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
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
              <a
                href="mailto:tech@planckoff.com"
                className="font-medium text-blue-600 hover:underline"
              >
                tech@planckoff.com
              </a>{" "}
              to get access to the platform.
            </span>
          </p>
        </div>
      </div>
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

"use client";

import { FormEvent, startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PublicUser } from "@/lib/auth-types";

type AuthMessage = {
  type: "success" | "error";
  text: string;
};

function formatRole(role: PublicUser["role"]) {
  return role.toLowerCase();
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export function AuthLanding() {
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [activeForm, setActiveForm] = useState<"login" | "register" | null>(
    null,
  );
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [isRouting, routingTransition] = useTransition();

  async function completeAuthRedirect() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { user?: PublicUser | null }
        | null;

      if (response.ok && payload?.user) {
        window.location.assign("/dashboard");
        return;
      }

      await wait(150 * (attempt + 1));
    }

    throw new Error(
      "You were signed in, but the session was not confirmed yet. Try again in a moment.",
    );
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveForm("login");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: PublicUser; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "Login failed. Please try again.");
      }

      setMessage({
        type: "success",
        text: `Welcome back${payload.user.name ? `, ${payload.user.name}` : ""}. Signed in as ${formatRole(payload.user.role)}.`,
      });
      setLoginPassword("");
      routingTransition(() => {
        startTransition(() => {
          void completeAuthRedirect().catch((error) => {
            setMessage({
              type: "error",
              text:
                error instanceof Error
                  ? error.message
                  : "Login succeeded, but the session could not be confirmed yet.",
            });
          });
          router.refresh();
        });
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Login failed. Please try again.",
      });
    } finally {
      setActiveForm(null);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveForm("register");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: PublicUser; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "Registration failed. Please try again.");
      }

      setMessage({
        type: "success",
        text: `Account created for ${payload.user.email}. Assigned role: ${formatRole(payload.user.role)}.`,
      });
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      routingTransition(() => {
        startTransition(() => {
          void completeAuthRedirect().catch((error) => {
            setMessage({
              type: "error",
              text:
                error instanceof Error
                  ? error.message
                  : "Registration succeeded, but the session could not be confirmed yet.",
            });
          });
          router.refresh();
        });
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Registration failed. Please try again.",
      });
    } finally {
      setActiveForm(null);
    }
  }

  const isLoginSubmitting = activeForm === "login";
  const isRegisterSubmitting = activeForm === "register";
  const isDisabled = isLoginSubmitting || isRegisterSubmitting || isRouting;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-10">
      <div className="parchment-surface w-full max-w-6xl rounded-[1.75rem] p-5 shadow-2xl backdrop-blur-md sm:p-6 md:p-10">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <section className="order-2 flex flex-col justify-between md:order-1">
            <div className="space-y-4">
              <p className="inline-block rounded-full border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-1 text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                Welcome To InkBranch
              </p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
                Stories are not just read. They are lived.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
                InkBranch is an AI-powered interactive storytelling platform.
                Creators design the world, the rules, and the narrative
                boundaries. Readers step inside and shape the story by making
                choices or writing their own actions.
              </p>
            </div>
            <div className="mt-6 space-y-3 text-sm leading-6 text-[var(--ink-muted)]">
              <p>
                AI continues each scene in real time while staying true to the
                creator&apos;s vision. Every path is yours. Every story still belongs
                to its world.
              </p>
              <p>
                New accounts begin as readers. Author and admin access are added
                intentionally, not during public signup.
              </p>
            </div>
          </section>

          <section className="order-1 space-y-4 md:order-2 md:space-y-5">
            {message ? (
              <div
                aria-live="polite"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-700/40 bg-emerald-100/75 text-emerald-900"
                    : "border-rose-700/40 bg-rose-100/75 text-rose-900"
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="parchment-card rounded-2xl p-4 shadow-lg sm:p-5">
              <h2 className="text-xl font-semibold">Log In</h2>
              <form className="mt-4 space-y-3.5" onSubmit={handleLoginSubmit}>
                <label className="parchment-label block text-sm font-medium">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                  required
                />
                <label className="parchment-label block text-sm font-medium">
                  Password
                </label>
                <input
                  key={showLoginPassword ? "login-password-text" : "login-password-password"}
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="********"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                  required
                />
                <label className="flex items-center justify-between rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)]/70 px-3 py-2 text-sm text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">
                    Show password
                  </span>
                  <input
                    type="checkbox"
                    checked={showLoginPassword}
                    onChange={(event) =>
                      setShowLoginPassword(event.target.checked)
                    }
                    className="h-4 w-4 accent-[var(--ink-button)]"
                    disabled={isDisabled}
                  />
                </label>
                {showLoginPassword && loginPassword ? (
                  <p className="rounded-lg border border-[var(--parchment-border)] bg-white/55 px-3 py-2 text-sm text-[var(--ink)]">
                    Visible password:
                    <span className="ml-2 font-mono break-all">
                      {loginPassword}
                    </span>
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="parchment-button mt-2 w-full rounded-lg px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 md:py-2 md:text-sm"
                  disabled={isDisabled}
                >
                  {isLoginSubmitting ? "Logging In..." : "Log In"}
                </button>
              </form>
            </div>

            <div className="parchment-card rounded-2xl p-4 shadow-lg sm:p-5">
              <h2 className="text-xl font-semibold">Create Account</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Fresh accounts are created with reader access, which opens the
                bookstore and your library first.
              </p>
              <form
                className="mt-4 space-y-3.5"
                onSubmit={handleRegisterSubmit}
              >
                <label className="parchment-label block text-sm font-medium">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                />
                <label className="parchment-label block text-sm font-medium">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                  required
                />
                <label className="parchment-label block text-sm font-medium">
                  Password
                </label>
                <input
                  key={
                    showRegisterPassword
                      ? "register-password-text"
                      : "register-password-password"
                  }
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  minLength={8}
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                  required
                />
                <label className="flex items-center justify-between rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)]/70 px-3 py-2 text-sm text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">
                    Show password
                  </span>
                  <input
                    type="checkbox"
                    checked={showRegisterPassword}
                    onChange={(event) =>
                      setShowRegisterPassword(event.target.checked)
                    }
                    className="h-4 w-4 accent-[var(--ink-button)]"
                    disabled={isDisabled}
                  />
                </label>
                {showRegisterPassword && registerPassword ? (
                  <p className="rounded-lg border border-[var(--parchment-border)] bg-white/55 px-3 py-2 text-sm text-[var(--ink)]">
                    Visible password:
                    <span className="ml-2 font-mono break-all">
                      {registerPassword}
                    </span>
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="parchment-button mt-2 w-full rounded-lg px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 md:py-2 md:text-sm"
                  disabled={isDisabled}
                >
                  {isRegisterSubmitting ? "Creating Account..." : "Register"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

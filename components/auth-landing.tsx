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

export function AuthLanding() {
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [activeForm, setActiveForm] = useState<"login" | "register" | null>(
    null,
  );
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [isRouting, routingTransition] = useTransition();

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
        router.push("/dashboard");
        startTransition(() => {
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
        router.push("/dashboard");
        startTransition(() => {
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
          <section className="flex flex-col justify-between">
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

          <section className="space-y-5">
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

            <div className="parchment-card rounded-2xl p-5 shadow-lg">
              <h2 className="text-xl font-semibold">Log In</h2>
              <form className="mt-4 space-y-3" onSubmit={handleLoginSubmit}>
                <label className="parchment-label block text-sm font-medium">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
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
                  type="password"
                  placeholder="********"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                  required
                />
                <button
                  type="submit"
                  className="parchment-button mt-2 w-full rounded-lg px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 md:py-2 md:text-sm"
                  disabled={isDisabled}
                >
                  {isLoginSubmitting ? "Logging In..." : "Log In"}
                </button>
              </form>
            </div>

            <div className="parchment-card rounded-2xl p-5 shadow-lg">
              <h2 className="text-xl font-semibold">Create Account</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Fresh accounts are created with reader access, which opens the
                bookstore and your library first.
              </p>
              <form
                className="mt-4 space-y-3"
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
                  type="password"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  minLength={8}
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  className="parchment-input w-full rounded-lg px-3 py-3 text-base outline-none transition md:py-2 md:text-sm"
                  disabled={isDisabled}
                  required
                />
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

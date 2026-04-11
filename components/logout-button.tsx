"use client";

import { startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, transition] = useTransition();

  async function handleLogout() {
    setMessage(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      transition(() => {
        router.replace("/");
        startTransition(() => {
          router.refresh();
        });
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Logout failed. Please try again.",
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="parchment-button rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Signing Out..." : "Sign Out"}
      </button>
      {message ? (
        <p className="text-xs text-rose-800" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}

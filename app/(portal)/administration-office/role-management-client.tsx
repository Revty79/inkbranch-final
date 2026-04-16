"use client";

import { useMemo, useState } from "react";

import type { AppRole } from "@/lib/auth-types";
import type { AdminUserRoleDirectoryItem } from "@/lib/admin-office";

type Props = {
  initialUsers: AdminUserRoleDirectoryItem[];
  currentAdminUserId: string;
};

type Message = {
  type: "success" | "error";
  text: string;
};

type UpdateRoleResponse =
  | {
      user?: {
        id: string;
        role: AppRole;
        updatedAt: string;
      };
      error?: string;
    }
  | null;

const ROLE_OPTIONS: AppRole[] = ["READER", "AUTHOR", "ADMIN"];

function formatRole(role: AppRole) {
  switch (role) {
    case "READER":
      return "Reader";
    case "AUTHOR":
      return "Author";
    case "ADMIN":
      return "Admin";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toSearchText(user: AdminUserRoleDirectoryItem) {
  return [
    user.name,
    user.email,
    user.role,
    formatRole(user.role),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function buildDraftRoleMap(users: AdminUserRoleDirectoryItem[]) {
  const map: Record<string, AppRole> = {};

  for (const user of users) {
    map[user.userId] = user.role;
  }

  return map;
}

export function RoleManagementClient({ initialUsers, currentAdminUserId }: Props) {
  const [users, setUsers] = useState<AdminUserRoleDirectoryItem[]>(initialUsers);
  const [draftRoles, setDraftRoles] = useState<Record<string, AppRole>>(
    buildDraftRoleMap(initialUsers),
  );
  const [searchInput, setSearchInput] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const filteredUsers = useMemo(() => {
    const normalized = searchInput.trim().toLowerCase();

    if (!normalized) {
      return users;
    }

    return users.filter((user) => toSearchText(user).includes(normalized));
  }, [searchInput, users]);

  async function handleSaveRole(userId: string) {
    const nextRole = draftRoles[userId];

    if (!nextRole) {
      return;
    }

    setSavingUserId(userId);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: nextRole }),
      });
      const payload = (await response.json().catch(() => null)) as UpdateRoleResponse;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "Could not update user role.");
      }

      setUsers((current) =>
        current.map((user) =>
          user.userId === userId
            ? {
                ...user,
                role: payload.user?.role ?? user.role,
                updatedAt: payload.user?.updatedAt ?? user.updatedAt,
              }
            : user,
        ),
      );
      setDraftRoles((current) => ({
        ...current,
        [userId]: payload.user?.role ?? nextRole,
      }));
      setMessage({
        type: "success",
        text: "User role updated.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not update user role.",
      });
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section className="parchment-card rounded-2xl p-4 shadow-lg sm:p-5">
      <div className="space-y-1">
        <p className="text-xs tracking-[0.16em] text-[var(--ink-muted)] uppercase">
          Role Management
        </p>
        <h3 className="text-2xl font-semibold">Change user access roles</h3>
        <p className="text-sm text-[var(--ink-muted)]">
          Update access by user. Reader is default; Author enables Writer&apos;s Desk; Admin enables platform controls.
        </p>
      </div>

      <div className="mt-4">
        <label className="space-y-1 text-sm">
          <span className="parchment-label block text-sm font-medium">Search users</span>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Name, email, or role..."
            className="parchment-input w-full rounded-lg px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.type === "success"
              ? "border-emerald-700/40 bg-emerald-100/70 text-emerald-900"
              : "border-rose-700/40 bg-rose-100/75 text-rose-900"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {users.length === 0 ? (
        <p className="mt-4 rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)]">
          No users found.
        </p>
      ) : filteredUsers.length === 0 ? (
        <p className="mt-4 rounded-lg border border-[var(--parchment-border)] bg-[var(--parchment-soft)] px-3 py-3 text-sm text-[var(--ink-muted)]">
          No users match your search.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--parchment-border)]">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--parchment-soft)] text-left text-xs tracking-[0.12em] text-[var(--ink-muted)] uppercase">
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Current Role</th>
                <th className="px-3 py-2 font-semibold">New Role</th>
                <th className="px-3 py-2 font-semibold">Created</th>
                <th className="px-3 py-2 font-semibold">Updated</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const draftRole = draftRoles[user.userId] ?? user.role;
                const isSaving = savingUserId === user.userId;
                const hasRoleChange = draftRole !== user.role;
                const isSelf = user.userId === currentAdminUserId;
                const disableSave =
                  isSaving ||
                  !hasRoleChange ||
                  (isSelf && draftRole !== "ADMIN");

                return (
                  <tr
                    key={user.userId}
                    className="border-t border-[var(--parchment-border)] align-top"
                  >
                    <td className="px-3 py-2">
                      <p className="font-semibold">{user.name?.trim() || "Unnamed User"}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{user.email}</p>
                    </td>
                    <td className="px-3 py-2">{formatRole(user.role)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={draftRole}
                        onChange={(event) => {
                          const nextRole = event.target.value as AppRole;
                          setDraftRoles((current) => ({
                            ...current,
                            [user.userId]: nextRole,
                          }));
                        }}
                        className="parchment-input rounded-lg px-2 py-1.5 text-xs outline-none"
                        disabled={isSaving}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {formatRole(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">{formatDate(user.createdAt)}</td>
                    <td className="px-3 py-2">{formatDate(user.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={disableSave}
                        onClick={() => {
                          void handleSaveRole(user.userId);
                        }}
                        className="rounded-full border border-[var(--parchment-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--parchment-soft)] disabled:cursor-not-allowed disabled:opacity-70"
                        title={isSelf ? "You cannot demote your own admin role here." : undefined}
                      >
                        {isSaving ? "Saving..." : hasRoleChange ? "Save Role" : "Saved"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

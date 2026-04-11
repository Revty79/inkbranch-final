import type { AppRole } from "@/lib/auth-types";

export type PortalCard = {
  href: "/bookstore" | "/library" | "/writers-desk" | "/administration-office";
  title: string;
  kicker: string;
  description: string;
  callToAction: string;
  statusLabel: string;
  themeClassName: string;
  allowedRoles: AppRole[];
};

export const portalCards: PortalCard[] = [
  {
    href: "/bookstore",
    title: "Bookstore",
    kicker: "Reader Access",
    description:
      "Browse new interactive stories, discover fresh worlds, and purchase your next branching adventure.",
    callToAction: "Explore the shelves",
    statusLabel: "Buy new stories",
    themeClassName: "book-card-bookstore",
    allowedRoles: ["READER", "AUTHOR", "ADMIN"],
  },
  {
    href: "/library",
    title: "Library",
    kicker: "Reader Access",
    description:
      "Return to the stories you already own, resume active paths, and keep your personal collection organized.",
    callToAction: "Open your collection",
    statusLabel: "Owned stories",
    themeClassName: "book-card-library",
    allowedRoles: ["READER", "AUTHOR", "ADMIN"],
  },
  {
    href: "/writers-desk",
    title: "Writer's Desk",
    kicker: "Author Access",
    description:
      "Shape worlds, define narrative guardrails, and manage the branches that keep every path true to canon.",
    callToAction: "Step into creation",
    statusLabel: "Author tools",
    themeClassName: "book-card-desk",
    allowedRoles: ["AUTHOR", "ADMIN"],
  },
  {
    href: "/administration-office",
    title: "Administration Office",
    kicker: "Admin Access",
    description:
      "Oversee platform operations, curate the storefront, and guide who gets elevated access across InkBranch.",
    callToAction: "Review operations",
    statusLabel: "Platform controls",
    themeClassName: "book-card-admin",
    allowedRoles: ["ADMIN"],
  },
];

export function canAccessPortal(role: AppRole, allowedRoles: AppRole[]) {
  return allowedRoles.includes(role);
}

export function getAccessiblePortalCards(role: AppRole) {
  return portalCards.filter((card) => canAccessPortal(role, card.allowedRoles));
}

export function getRolePortalSummary(role: AppRole) {
  switch (role) {
    case "READER":
      return "Readers unlock the Bookstore and Library so they can discover and enjoy stories.";
    case "AUTHOR":
      return "Authors keep reader access and also unlock the Writer's Desk to build story worlds.";
    case "ADMIN":
      return "Admins can move through every room in InkBranch, including platform oversight.";
  }
}

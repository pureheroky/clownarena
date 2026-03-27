import {
  Flag,
  History,
  LayoutGrid,
  Swords,
  Trophy,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: "exact" | "prefix";
  activePrefixes?: string[];
};

export type AppRouteMeta = {
  sidebarEyebrow: string;
  sidebarTitle: string;
  sidebarDescription: string;
  headerEyebrow: string;
  headerTitle: string;
  headerDescription: string;
  headerNote?: string;
};

export const appNavItems: AppNavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutGrid, match: "exact" },
  { href: "/app/problems", label: "Problems", icon: Flag, match: "prefix" },
  {
    href: "/app/duels/private",
    label: "Duels",
    icon: Swords,
    match: "prefix",
    activePrefixes: ["/app/duels/private", "/app/duels/"],
  },
  { href: "/app/history", label: "History", icon: History, match: "prefix" },
  {
    href: "/app/leaderboards",
    label: "Leaderboards",
    icon: Trophy,
    match: "prefix",
  },
  {
    href: "/app/profile",
    label: "Profile",
    icon: UserCircle2,
    match: "prefix",
  },
];

const defaultMeta: AppRouteMeta = {
  sidebarEyebrow: "Workspace",
  sidebarTitle: "Control room",
  sidebarDescription:
    "Open the next arena screen, check your status and move between the core parts of the app.",
  headerEyebrow: "Workspace",
  headerTitle: "Clown Arena",
  headerDescription:
    "Private coding duels, player-made problems and token stakes in one place.",
};

export function isAppNavItemActive(pathname: string, item: AppNavItem) {
  if (item.match === "exact") {
    return pathname === item.href;
  }
  if (
    item.activePrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    )
  ) {
    return true;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getAppRouteMeta(pathname: string): AppRouteMeta {
  if (pathname === "/app") {
    return {
      sidebarEyebrow: "Overview",
      sidebarTitle: "Main interface",
      sidebarDescription:
        "Check your rating, token balance, fresh drafts and the latest arena movement from one dashboard.",
      headerEyebrow: "Overview",
      headerTitle: "Your control room",
      headerDescription:
        "Start from here when you want a quick picture of your wallet, problem pipeline and recent duels.",
      headerNote: "Wallet, drafts and recent results at a glance.",
    };
  }

  if (pathname.startsWith("/app/problems/new")) {
    return {
      sidebarEyebrow: "Problems",
      sidebarTitle: "Create a new task",
      sidebarDescription:
        "Write the statement, add visible and hidden tests, then validate everything with a reference solution.",
      headerEyebrow: "Problem editor",
      headerTitle: "Forge a duel-ready problem",
      headerDescription:
        "Turn a rough idea into a task players can solve in a private duel.",
      headerNote: "Drafts, tests and publishing.",
    };
  }

  if (pathname.startsWith("/app/problems/") && pathname.endsWith("/edit")) {
    return {
      sidebarEyebrow: "Problems",
      sidebarTitle: "Problem editor",
      sidebarDescription:
        "Refine the statement, tune the tests and keep the draft ready for the next validation pass.",
      headerEyebrow: "Problem editor",
      headerTitle: "Continue editing",
      headerDescription:
        "Adjust the draft, review older tests and prepare the next published version.",
      headerNote: "Keep editing while older published versions stay available.",
    };
  }

  if (pathname.startsWith("/app/problems/")) {
    return {
      sidebarEyebrow: "Problems",
      sidebarTitle: "Problem preview",
      sidebarDescription:
        "Review the current statement and confirm the task looks right before a duel.",
      headerEyebrow: "Problem preview",
      headerTitle: "Inspect the current version",
      headerDescription:
        "Use this screen to verify the task text, sample structure and publication state.",
      headerNote: "Read-only view of the current problem version.",
    };
  }

  if (pathname.startsWith("/app/problems")) {
    return {
      sidebarEyebrow: "Problems",
      sidebarTitle: "Problem workspace",
      sidebarDescription:
        "All of your drafts, validation states and published tasks live here.",
      headerEyebrow: "Problems",
      headerTitle: "Manage your problems",
      headerDescription:
        "Open older drafts, spot what still needs tests and publish tasks that are ready for duels.",
      headerNote: "Drafts, validation and publication status.",
    };
  }

  if (pathname.startsWith("/app/duels/") && pathname !== "/app/duels/private") {
    return {
      sidebarEyebrow: "Duels",
      sidebarTitle: "Live duel room",
      sidebarDescription:
        "Stay in sync with the room, submit Python solutions and track the current phase of the match.",
      headerEyebrow: "Live duel",
      headerTitle: "Match in progress",
      headerDescription:
        "See whether this room is rated or practice, follow opponent progress and submit code without leaving the match screen.",
      headerNote: "Room type, stakes and live updates.",
    };
  }

  if (pathname.startsWith("/app/duels/private")) {
    return {
      sidebarEyebrow: "Duels",
      sidebarTitle: "Private duel setup",
      sidebarDescription:
        "Create a rated room with someone else’s task or open a practice room with one of your own published tasks.",
      headerEyebrow: "Private duels",
      headerTitle: "Create or join a room",
      headerDescription:
        "Switch between rated and practice rooms, then share the code with the other player.",
      headerNote: "Room codes, stakes and practice mode.",
    };
  }

  if (pathname.startsWith("/app/history")) {
    return {
      sidebarEyebrow: "History",
      sidebarTitle: "Match archive",
      sidebarDescription:
        "Look back at finished rooms, including rated matches and practice sessions.",
      headerEyebrow: "History",
      headerTitle: "Review finished matches",
      headerDescription:
        "See how each room ended and whether it changed your rating and wallet or was practice-only.",
      headerNote: "Replays, results and room impact.",
    };
  }

  if (pathname.startsWith("/app/leaderboards")) {
    return {
      sidebarEyebrow: "Leaderboards",
      sidebarTitle: "Arena rankings",
      sidebarDescription:
        "Track who leads by rating and who has built the largest clown token stack.",
      headerEyebrow: "Leaderboards",
      headerTitle: "See who leads the arena",
      headerDescription:
        "Switch between the rating ladder and the token ladder to compare players.",
      headerNote: "Two rankings: rating and clown tokens.",
    };
  }

  if (pathname.startsWith("/app/profile")) {
    return {
      sidebarEyebrow: "Profile",
      sidebarTitle: "Wallet and identity",
      sidebarDescription:
        "This is where you claim daily tokens and review every wallet movement tied to your account.",
      headerEyebrow: "Profile",
      headerTitle: "Your account overview",
      headerDescription:
        "Check your personal rating, token balance and the full wallet ledger from one place.",
      headerNote: "Daily claim, rating and wallet history.",
    };
  }

  return defaultMeta;
}

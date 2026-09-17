// The six console users, one per role. Kept apart from lib/fixtures.ts on
// purpose: the role provider in the root layout needs this six-row file and
// nothing else, and importing it through the fixture module would put every
// fixture (the 185-source inventory included) into the chunk of every route.

import usersJson from "@/fixtures/users.json";
import type { ConsoleUser } from "./types";

export const USERS = usersJson as ConsoleUser[];

export function userForRole(role: ConsoleUser["role"]): ConsoleUser {
  const u = USERS.find((x) => x.role === role);
  if (!u) throw new Error(`No fixture user for role ${role}`);
  return u;
}

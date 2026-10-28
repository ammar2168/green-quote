import type { UserRole } from "@/db/schema";

/** Where a user lands after signing in or up. */
export const USER_HOME_PATH = "/quotes/new";

/** Where an admin lands instead. */
export const ADMIN_HOME_PATH = "/admin/quotes";

/**
 * A signed-in user's starting page. Shared by the sign-in action and by
 * `/login` and `/signup`, which send an already signed-in visitor here rather
 * than showing a form that suggests they were signed out.
 */
export function homePathFor(role: UserRole): string {
  return role === "admin" ? ADMIN_HOME_PATH : USER_HOME_PATH;
}

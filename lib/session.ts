import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Stateless sessions: a signed JWT in an httpOnly cookie. There is no session
 * table — the cookie *is* the session.
 *
 * The payload holds nothing but `users.id`, so the role is re-read from the
 * database on every request (see `lib/current-user.ts`) and an admin demoted in
 * the database stops being an admin immediately rather than at next login.
 *
 * The trade-off of going stateless: a session cannot be revoked server-side.
 * Rotating SESSION_SECRET invalidates every session at once, which is the blunt
 * version of logging everyone out.
 */

const SESSION_COOKIE = "session";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const secret = process.env.SESSION_SECRET;

if (!secret) {
  throw new Error(
    "SESSION_SECRET is not set. Copy .env.example to .env — generate a value with `openssl rand -base64 32`.",
  );
}

const encodedSecret = new TextEncoder().encode(secret);

type SessionPayload = {
  userId: string;
};

async function encrypt(
  payload: SessionPayload,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedSecret);
}

async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ["HS256"],
    });

    // The token is signed by us, but it could still be an old shape, so the
    // claim is checked rather than asserted.
    return typeof payload.userId === "string"
      ? { userId: payload.userId }
      : null;
  } catch {
    // Expired, tampered with, or signed with a previous SESSION_SECRET.
    return null;
  }
}

/** Signs the user in by writing the session cookie. */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encrypt({ userId }, expiresAt);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Browsers reject `secure` cookies over plain http, which is what
    // `next dev` serves, so it is only set for real deployments.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/** Returns the signed-in user's id, or null. Does not touch the database. */
export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  return token ? decrypt(token) : null;
}

/** Signs the user out. Only callable from a Server Action or Route Handler. */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

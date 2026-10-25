import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for the whole app — the seed script and, later, sign-up and
 * login all go through here, so there is exactly one hash format in the
 * `users.password_hash` column.
 *
 * scrypt ships with Node, which keeps this dependency-free. The cost
 * parameters are stored alongside the hash (see `serialise`), so they can be
 * raised later without invalidating hashes that already exist.
 */

type ScryptParams = {
  /** CPU/memory cost. Must be a power of two. */
  N: number;
  /** Block size. */
  r: number;
  /** Parallelisation. */
  p: number;
};

const CURRENT_PARAMS: ScryptParams = { N: 32768, r: 8, p: 1 };

const KEY_LENGTH = 64;

/**
 * scrypt needs roughly `128 * N * r` bytes, which is 32 MiB at the parameters
 * above — just over Node's 32 MiB default, so it has to be raised explicitly.
 */
const MAX_MEM = 64 * 1024 * 1024;

const SALT_LENGTH = 16;

const ALGORITHM = "scrypt";

function deriveKey(
  password: string,
  salt: Buffer,
  params: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { ...params, maxmem: MAX_MEM },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function serialise(params: ScryptParams, salt: Buffer, key: Buffer): string {
  return [
    ALGORITHM,
    params.N,
    params.r,
    params.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

function deserialise(stored: string) {
  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    throw new Error(`Unrecognised password hash format: ${parts[0]}`);
  }

  const [, N, r, p, salt, key] = parts;

  return {
    params: { N: Number(N), r: Number(r), p: Number(p) },
    salt: Buffer.from(salt, "base64"),
    key: Buffer.from(key, "base64"),
  };
}

/** Hashes a plaintext password for storage in `users.password_hash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, CURRENT_PARAMS);

  return serialise(CURRENT_PARAMS, salt, key);
}

/**
 * Checks a plaintext password against a stored hash, re-deriving with the
 * parameters that hash was created with.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const { params, salt, key } = deserialise(stored);
  const candidate = await deriveKey(password, salt, params);

  // Lengths match by construction, but timingSafeEqual throws if they differ.
  return candidate.length === key.length && timingSafeEqual(candidate, key);
}

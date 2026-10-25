/**
 * The shape the sign-up and sign-in Server Actions hand back to
 * `useActionState`. It lives in its own module because `app/actions/auth.ts`
 * is a `"use server"` file, and those may only export async functions.
 */
export type AuthFormState = {
  /** Per-field messages, rendered under the input they belong to. */
  errors?: {
    fullName?: string;
    email?: string;
    password?: string;
  };
  /** A whole-form message, such as "Invalid email or password". */
  message?: string;
  /** Echoed back so a failed submit does not clear what was typed. */
  values?: {
    fullName?: string;
    email?: string;
  };
};

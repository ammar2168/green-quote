"use client";

import { useActionState, useId } from "react";

import { login, signup } from "@/app/actions/auth";
import type { AuthFormState } from "@/lib/auth-form-state";

import { primaryButton } from "./site-chrome";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-3">
      <FormMessage state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state?.values?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-3">
      <FormMessage state={state} />
      <Field
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={state?.values?.fullName}
        error={state?.errors?.fullName}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state?.values?.email}
        error={state?.errors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={state?.errors?.password}
      />
      <SubmitButton pending={pending} pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

function Field({ label, hint, error, ...input }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={`mt-1 w-full rounded-control border bg-surface px-3 py-2.5 text-sm font-medium outline-none transition focus:ring-2 ${
          error
            ? "border-danger focus:border-danger focus:ring-danger/20"
            : "border-line-strong focus:border-brand focus:ring-brand/20"
        }`}
        {...input}
      />
      {note && (
        <p
          id={noteId}
          className={`mt-1 text-xs ${error ? "text-danger" : "text-subtle"}`}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** Whole-form errors, such as "Invalid email or password." */
function FormMessage({ state }: { state: AuthFormState | undefined }) {
  return (
    // empty:hidden keeps the live region in the DOM without adding a gap.
    <div aria-live="polite" className="empty:hidden">
      {state?.message && (
        <p className="rounded-control border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}

function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButton} mt-1`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

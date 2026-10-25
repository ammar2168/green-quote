"use client";

import { useId } from "react";

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  /** A unit shown inside the input's right edge, such as "kWh". */
  suffix?: string;
};

/** A labelled input with its hint, or its error in place of the hint. */
export function Field({ label, hint, error, suffix, ...input }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={`w-full rounded-control border bg-surface px-3 py-2.5 text-sm font-medium outline-none transition focus:ring-2 ${
            suffix ? "pr-14" : ""
          } ${
            error
              ? "border-danger focus:border-danger focus:ring-danger/20"
              : "border-line-strong focus:border-brand focus:ring-brand/20"
          }`}
          {...input}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-subtle"
          >
            {suffix}
          </span>
        )}
      </div>
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

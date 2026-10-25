import type { z } from "zod";

/**
 * One message per top-level field, which is what a form renders under each
 * input. The first issue wins, since it is the most basic one ("enter a
 * number" before "must be more than 0").
 *
 * An unknown key has no input to sit under, so it is reported against its own
 * name, which makes a typo like `downpayment` obvious.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        errors[key] ??= "Not a recognised field.";
      }

      continue;
    }

    const field = issue.path.length > 0 ? String(issue.path[0]) : "";

    if (field) errors[field] ??= issue.message;
  }

  return errors;
}

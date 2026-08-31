import * as React from "react";
import { ApiError } from "@/lib/api-client";

/**
 * Binds a failed request's per-field validation messages to form inputs.
 *
 * Without this the only signal is a toast, which says *that* something is wrong but not *which
 * box* — on a long form (Add Tenant has fourteen fields) that leaves the user hunting. The server
 * already says exactly which field it rejected; this surfaces it there.
 *
 * ```tsx
 * const errors = useFieldErrors();
 * const save = async () => {
 *   errors.clear();
 *   try { await mutation.mutateAsync(payload); onClose(); }
 *   catch (e) { errors.capture(e); }   // re-throws nothing; the hook's toast rule applies
 * };
 * <Input aria-invalid={!!errors.get("name")} />
 * <FieldError message={errors.get("name")} />
 * ```
 */
export interface FieldErrors {
  /** Message for one field, or undefined. Case-insensitive. */
  get: (field: string) => string | undefined;
  /** Errors the server reported without naming a field (ASP.NET's "" bucket). */
  formError: string | undefined;
  /** True if anything was captured — useful for a summary banner. */
  any: boolean;
  /** Record a failed request. Non-validation failures are ignored, so the mutation hook's toast
   *  stays the single place a generic error is reported. Returns true if it captured anything. */
  capture: (error: unknown) => boolean;
  /** Reset before each submit, so a fixed field stops showing its old message. */
  clear: () => void;
  /** Drop one field's message as soon as the user edits it. */
  clearField: (field: string) => void;
}

export function useFieldErrors(): FieldErrors {
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const clear = React.useCallback(() => setErrors({}), []);

  const clearField = React.useCallback((field: string) => {
    const key = field.toLowerCase();
    setErrors(prev => {
      if (!(key in prev)) return prev;   // avoids a re-render on every keystroke
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const capture = React.useCallback((error: unknown) => {
    if (error instanceof ApiError && error.hasFieldErrors) {
      setErrors(error.fieldErrors);
      return true;
    }
    return false;
  }, []);

  const get = React.useCallback(
    (field: string) => errors[field.toLowerCase()]?.[0],
    [errors]);

  return {
    get,
    formError: errors[""]?.[0],
    any: Object.keys(errors).length > 0,
    capture,
    clear,
    clearField,
  };
}

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The validation message under a form field. Renders nothing when there is no message, so it can
 * sit unconditionally in the markup.
 *
 * `role="alert"` is deliberate: a screen reader user gets no signal from red text appearing
 * somewhere below the input they just left.
 */
export function FieldError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("flex items-start gap-1 text-[11px] text-destructive mt-1", className)}>
      <AlertCircle className="w-3 h-3 mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

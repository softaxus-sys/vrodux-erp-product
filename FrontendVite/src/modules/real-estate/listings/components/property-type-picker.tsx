import * as React from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePropertyTypes } from "@/hooks/real-estate/use-re";

/** The option that switches the picker into free-text mode. */
const ADD_NEW = "__add_new__";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

/**
 * Property type: pick one, or add one.
 *
 * <p>Shared by the listing form and the building form. Two copies of a control with its own
 * commit/cancel state is how one of them ends up subtly different — and the building form having
 * its own idea of what a type is, is precisely the bug this replaces.</p>
 *
 * <p>Types are free text stored on the property, so the list is the built-in defaults plus every
 * type already in use. A new one is created by being typed once. No table, same approach as HR
 * job designations.</p>
 */
export function PropertyTypePicker({ value, onChange }: Props) {
  const { data: serverTypes } = usePropertyTypes();

  /**
   * Types added in this session. The server list only refreshes after a save, so without this a
   * type would be committed and then immediately vanish from the dropdown it was added to.
   */
  const [added, setAdded] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<string | null>(null);

  const options = React.useMemo(() => {
    const all = [...(serverTypes ?? []), ...added];
    // The current value always appears, even before the list has loaded — otherwise a select
    // whose value is missing from its options silently displays the first one instead, which
    // would change the type just by opening the form.
    if (value && !all.some(t => t.toLowerCase() === value.toLowerCase())) all.unshift(value);
    return Array.from(
      all.reduce((m, t) => m.set(t.trim().toLowerCase(), t.trim()), new Map<string, string>()).values(),
    ).sort((a, b) => a.localeCompare(b));
  }, [serverTypes, added, value]);

  const commit = () => {
    const next = (draft ?? "").trim();
    // Nothing typed is a cancel, not an error. Committing "" would blank a required field.
    if (!next) { setDraft(null); return; }
    setAdded(prev => prev.some(t => t.toLowerCase() === next.toLowerCase()) ? prev : [...prev, next]);
    onChange(next);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <div className="flex gap-1.5">
        <Input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          // Enter commits. Typing a name and pressing Enter is what people do, and without this
          // it did nothing at all.
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); setDraft(null); }
          }}
          placeholder="e.g. Labour Camp"
          className="h-9 text-sm"
        />
        {/* An explicit Add. The input previously offered only Cancel, so there was no way to tell
            the type had been accepted — and the obvious button discarded it. */}
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          title="Add this type"
          className="h-9 w-9 shrink-0 rounded-lg border border-border bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          title="Cancel"
          className="h-9 w-9 shrink-0 rounded-lg border border-border text-muted-foreground flex items-center justify-center hover:bg-muted/40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        if (e.target.value === ADD_NEW) { setDraft(""); return; }
        onChange(e.target.value);
      }}
      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {options.map(t => <option key={t} value={t}>{t}</option>)}
      <option value={ADD_NEW}>+ Add a new type…</option>
    </select>
  );
}

import { useEffect, useState } from "react";
import { isDesktop, clearApiUrlCache } from "@/lib/desktop";

export function ServerSettingsPrompt() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!isDesktop) return;
    window.vroduxDesktop!.onShowServerPrompt((currentUrl) => {
      setUrl(currentUrl);
      setOpen(true);
    });
  }, []);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!trimmed) return;
    clearApiUrlCache();
    await window.vroduxDesktop!.setApiUrl(trimmed);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg p-6 shadow-xl w-[420px] space-y-4">
        <h2 className="text-lg font-semibold">Server Settings</h2>
        <p className="text-sm text-muted-foreground">
          Enter the API server URL. The app will reload after saving.
        </p>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md px-4 py-2 text-sm border border-input hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}

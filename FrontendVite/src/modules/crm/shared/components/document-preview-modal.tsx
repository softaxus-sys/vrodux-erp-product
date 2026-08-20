import * as React from "react";
import { useTranslation } from "react-i18next";
import { X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crmDocumentsApi } from "@/lib/crm/documents.api";
import type { CrmDocumentDto } from "@/lib/crm/documents.api";

interface Props {
  doc: CrmDocumentDto;
  onClose: () => void;
  onDownload: () => void;
}

/**
 * Inline preview for images and PDFs.
 *
 * The file is fetched as a blob (the endpoint needs a bearer token, so the URL can't just be put
 * in a src attribute) and rendered from an object URL, which is revoked on unmount — without that
 * the blob stays in memory for the lifetime of the page.
 */
export function DocumentPreviewModal({ doc, onClose, onDownload }: Props) {
  const { t } = useTranslation("crm");
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    crmDocumentsApi
      .previewUrl(doc)
      .then((u) => {
        // The component may have unmounted while the fetch was in flight.
        if (revoked) { URL.revokeObjectURL(u); return; }
        objectUrl = u;
        setUrl(u);
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc]);

  // Escape closes, matching the drawers.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] rounded-xl border border-border bg-card flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <p className="flex-1 truncate text-sm font-semibold text-foreground">{doc.fileName}</p>
          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {t("documents.download", { defaultValue: "Download" })}
          </Button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center">
          {error ? (
            <p className="text-sm text-destructive p-6">{error}</p>
          ) : !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : doc.contentType.startsWith("image/") ? (
            <img src={url} alt={doc.fileName} className="max-h-full max-w-full object-contain" />
          ) : (
            <iframe src={url} title={doc.fileName} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}

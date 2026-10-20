import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlayCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, type TicketCategory, type TicketPriority, type AttachmentInput } from "@/lib/support/support.api";
import { useCreateTicket } from "@/hooks/support/use-support";
import { AttachmentPicker } from "@/modules/support/components/attachment-picker";
import { useVideoGuides } from "@/hooks/support/use-video-guides";
import { WatchGuideLink } from "@/modules/support/video-guides/components/watch-guide-link";

export function NewTicketForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("support");
  const navigate = useNavigate();
  const { data: guides } = useVideoGuides();
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState<TicketCategory>("general");
  const [priority, setPriority] = React.useState<TicketPriority>("medium");
  const [message, setMessage] = React.useState("");
  const [attachments, setAttachments] = React.useState<AttachmentInput[]>([]);
  const create = useCreateTicket();

  const reset = () => { setSubject(""); setCategory("general"); setPriority("medium"); setMessage(""); setAttachments([]); };

  const submit = () => {
    if (!subject.trim() || !message.trim()) return;
    create.mutate({ subject: subject.trim(), category, priority, message: message.trim(), attachments }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <p className="font-semibold">New support ticket</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>

              <div className="p-5 space-y-4">
                {/* Shown only once the guides have loaded — a hint to a feature that failed to load is just noise. */}
                {guides && guides.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs">
                    <PlayCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 min-w-[180px] text-muted-foreground">{t("videos.ticketHint")}</span>
                    {category === "onboarding" && <WatchGuideLink slug="getting-started" />}
                    <button type="button" className="font-medium text-primary hover:underline"
                      onClick={() => { onClose(); navigate("/support/videos"); }}>
                      {t("videos.browse")}
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)}
                    placeholder="Briefly describe the issue" maxLength={200} className="mt-1" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                      value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}
                    >
                      {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                      value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    >
                      {TICKET_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">What's going on?</label>
                  <textarea
                    className="mt-1 w-full min-h-[120px] rounded-lg border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Include as much detail as you can — screenshots and steps to reproduce help a lot."
                    maxLength={5000}
                  />
                </div>

                <AttachmentPicker value={attachments} onChange={setAttachments} disabled={create.isPending} />
              </div>

              <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={submit} disabled={!subject.trim() || !message.trim() || create.isPending}>
                  Submit ticket
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateProject } from "@/hooks/project-management/use-projects";

interface CreateProjectFormProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectForm({ open, onClose }: CreateProjectFormProps) {
  const create = useCreateProject();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [leadName, setLeadName] = React.useState("");

  const reset = () => {
    setName(""); setDescription(""); setLeadName("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const isValid = name.trim().length > 0;
  const isPending = create.isPending;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        leadName: leadName.trim() || undefined,
      });
      onClose();
    } catch { /* hook toasts the error; keep form open for retry */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">New Project</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a project to organize work into a board, backlog and sprints</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Engineering Platform" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What is this project about?" rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Lead</label>
                <Input value={leadName} onChange={e => setLeadName(e.target.value)}
                  placeholder="e.g. Sarah Khan" className="h-9 text-sm" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                A short project key is generated automatically from the name (e.g. "Engineering Platform" → "ENG"), and a default board
                with To Do, In Progress, In Review and Done columns is created for you.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? "Creating…" : "Create Project"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

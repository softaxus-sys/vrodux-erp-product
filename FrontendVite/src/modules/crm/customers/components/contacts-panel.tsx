import * as React from "react";
import { useTranslation } from "react-i18next";
import { Star, Mail, Phone, Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact, useSetPrimaryContact } from "@/hooks/crm/use-crm";
import type { ContactDto, UpsertContactRequest } from "@/lib/crm/crm.api";

interface Props { customerId: string }

const blank = (customerId: string): UpsertContactRequest => ({
  customerId, firstName: "", lastName: "", title: "", email: "", phone: "", department: "", isPrimary: false, notes: "",
});

export function ContactsPanel({ customerId }: Props) {
  const { t } = useTranslation("crm");
  const { data: contacts = [] } = useContacts(customerId);
  const create = useCreateContact();
  const update = useUpdateContact();
  const del = useDeleteContact();
  const setPrimary = useSetPrimaryContact();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<UpsertContactRequest | null>(null);

  const startAdd  = () => { setEditingId("new"); setForm(blank(customerId)); };
  const startEdit = (c: ContactDto) => {
    setEditingId(c.id);
    setForm({ customerId, firstName: c.firstName, lastName: c.lastName, title: c.title, email: c.email, phone: c.phone, department: c.department ?? "", isPrimary: c.isPrimary, notes: c.notes ?? "" });
  };
  const cancel = () => { setEditingId(null); setForm(null); };
  const save = () => {
    if (!form || !form.firstName.trim()) return;
    if (editingId === "new") create.mutate(form, { onSuccess: cancel });
    else if (editingId) update.mutate({ id: editingId, data: form }, { onSuccess: cancel });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t("contacts.heading", { count: contacts.length })}</h4>
        {editingId === null && <Button size="sm" className="h-8 text-xs gap-1.5" onClick={startAdd}><Plus className="h-3.5 w-3.5" />{t("contacts.addContact")}</Button>}
      </div>

      {editingId === "new" && form && <ContactForm form={form} setForm={setForm} onSave={save} onCancel={cancel} saving={create.isPending} />}

      {contacts.length === 0 && editingId === null && (
        <p className="text-xs text-muted-foreground text-center py-6">{t("contacts.empty")}</p>
      )}

      {contacts.map(c => editingId === c.id && form ? (
        <ContactForm key={c.id} form={form} setForm={setForm} onSave={save} onCancel={cancel} saving={update.isPending} />
      ) : (
        <div key={c.id} className="rounded-xl border border-border p-3 group">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{c.fullName}</p>
                {c.isPrimary && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full"><Star className="h-2.5 w-2.5" />{t("contacts.primary")}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{[c.title, c.department].filter(Boolean).join(" · ") || "—"}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{c.email}</a>}
                {c.phone && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!c.isPrimary && <button title={t("contacts.setPrimary")} onClick={() => setPrimary.mutate(c.id)} className="p-1.5 rounded text-muted-foreground hover:text-primary"><Star className="h-3.5 w-3.5" /></button>}
              <button title={t("contacts.edit")} onClick={() => startEdit(c)} className="p-1.5 rounded text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button title={t("contacts.remove")} onClick={() => del.mutate(c.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactForm({ form, setForm, onSave, onCancel, saving }: {
  form: UpsertContactRequest; setForm: (f: UpsertContactRequest) => void; onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const { t } = useTranslation("crm");
  const set = (k: keyof UpsertContactRequest, v: string | boolean) => setForm({ ...form, [k]: v });
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{form.firstName ? t("contacts.editContact") : t("contacts.newContact")}</span>
        <button onClick={onCancel} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder={t("contacts.firstName")} className="h-8 text-sm" />
        <Input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder={t("contacts.lastName")} className="h-8 text-sm" />
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("contacts.jobTitle")} className="h-8 text-sm" />
        <Input value={form.department ?? ""} onChange={e => set("department", e.target.value)} placeholder={t("contacts.department")} className="h-8 text-sm" />
        <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder={t("contacts.email")} className="h-8 text-sm" />
        <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder={t("contacts.phone")} className="h-8 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={form.isPrimary} onChange={e => set("isPrimary", e.target.checked)} className="rounded" />
        {t("contacts.primaryLabel")}
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={saving}>{t("contacts.cancel")}</Button>
        <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={saving || !form.firstName.trim()}>{saving ? t("contacts.saving") : t("contacts.save")}</Button>
      </div>
    </div>
  );
}

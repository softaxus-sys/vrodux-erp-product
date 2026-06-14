import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Briefcase, Clock, Building2, Calendar,
  Upload, CheckCircle2, FileText, X,
} from "lucide-react";
import { careersApi, CareersApiError } from "@/lib/hr/careers.api";
import { CareersLayout } from "./careers-layout";

function formatSalary(min: number, max: number, currency: string): string {
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  if (!min && !max) return "Competitive";
  if (min && max) return `${currency} ${fmt(min)} – ${fmt(max)}`;
  return `${currency} ${fmt(min || max)}`;
}

function formatPostedDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" });
}

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_EXT = [".pdf", ".doc", ".docx"];

interface ApplyFormState {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  currentRole: string;
  currentCompany: string;
  experience: string;
  coverNote: string;
}

const EMPTY_FORM: ApplyFormState = {
  name: "", email: "", phone: "", nationality: "",
  currentRole: "", currentCompany: "", experience: "", coverNote: "",
};

export function CareersJobDetailView() {
  const { tenantSlug = "", jobId = "" } = useParams<{ tenantSlug: string; jobId: string }>();
  const [form, setForm] = React.useState<ApplyFormState>(EMPTY_FORM);
  const [resume, setResume] = React.useState<File | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: company } = useQuery({
    queryKey: ["careers", tenantSlug, "company"],
    queryFn: () => careersApi.getCompany(tenantSlug),
    enabled: !!tenantSlug,
    retry: false,
  });

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ["careers", tenantSlug, "jobs", jobId],
    queryFn: () => careersApi.getOpenJob(tenantSlug, jobId),
    enabled: !!tenantSlug && !!jobId,
    retry: false,
  });

  const apply = useMutation({
    mutationFn: () => careersApi.apply(tenantSlug, {
      jobId,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      nationality: form.nationality.trim() || undefined,
      currentRole: form.currentRole.trim() || undefined,
      currentCompany: form.currentCompany.trim() || undefined,
      experience: form.experience ? Number(form.experience) : undefined,
      coverNote: form.coverNote.trim() || undefined,
      resume,
    }),
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Application submitted successfully.");
    },
    onError: (err: Error) => {
      const message = err instanceof CareersApiError ? err.message : "Failed to submit application.";
      toast.error(message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setResume(null); return; }

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_RESUME_EXT.includes(ext)) {
      toast.error("Resume must be a PDF or Word document.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      toast.error("Resume must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setResume(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    try {
      await apply.mutateAsync();
    } catch {
      // onError already shows the toast
    }
  };

  if (isLoading) {
    return (
      <CareersLayout tenantSlug={tenantSlug} companyName={company?.name}>
        <p className="text-sm text-slate-400">Loading job details…</p>
      </CareersLayout>
    );
  }

  if (isError || !job) {
    return (
      <CareersLayout tenantSlug={tenantSlug} companyName={company?.name}>
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
          <Briefcase className="mx-auto h-8 w-8 mb-3 text-slate-600" />
          This job posting is no longer available.
          <div className="mt-4">
            <Link to={`/careers/${tenantSlug}`} className="text-blue-400 hover:underline text-sm">
              ← Back to all openings
            </Link>
          </div>
        </div>
      </CareersLayout>
    );
  }

  return (
    <CareersLayout tenantSlug={tenantSlug} companyName={company?.name}>
      <Link to={`/careers/${tenantSlug}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to all openings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.department}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.branch}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{TYPE_LABELS[job.type] ?? job.type}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Posted {formatPostedDate(job.postedDate)}</span>
            </div>
            <div className="mt-4 inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400">
              {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold mb-2">About this role</h2>
            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{job.description}</p>
          </section>

          {job.responsibilities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Responsibilities</h2>
              <ul className="space-y-1.5">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {job.requirements.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Requirements</h2>
              <ul className="space-y-1.5">
                {job.requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
                <h3 className="font-semibold text-lg">Application Sent!</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Thank you for applying to <span className="font-medium text-slate-200">{job.title}</span>.
                  Our team will review your application and get back to you.
                </p>
                <Link
                  to={`/careers/${tenantSlug}`}
                  className="mt-4 inline-block text-sm text-blue-400 hover:underline"
                >
                  View other openings
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-4">Apply for this position</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                    <input
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nationality</label>
                      <input
                        value={form.nationality}
                        onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                        className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Experience (yrs)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.experience}
                        onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
                        className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Current Role</label>
                    <input
                      value={form.currentRole}
                      onChange={e => setForm(f => ({ ...f, currentRole: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Current Company</label>
                    <input
                      value={form.currentCompany}
                      onChange={e => setForm(f => ({ ...f, currentCompany: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Cover Note</label>
                    <textarea
                      rows={3}
                      value={form.coverNote}
                      onChange={e => setForm(f => ({ ...f, coverNote: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Resume / CV (PDF or Word, max 5MB)</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {resume ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 h-9 text-sm">
                        <span className="flex items-center gap-2 truncate text-slate-200">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span className="truncate">{resume.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setResume(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="ml-2 text-slate-500 hover:text-slate-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 text-sm text-slate-400 hover:border-blue-500/50 hover:text-slate-300"
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload resume
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={apply.isPending}
                    className="w-full h-10 mt-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {apply.isPending ? "Submitting…" : "Submit Application"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </CareersLayout>
  );
}

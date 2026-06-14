import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Briefcase, Clock, Building2 } from "lucide-react";
import { careersApi } from "@/lib/hr/careers.api";
import { CareersLayout } from "./careers-layout";

function formatSalary(min: number, max: number, currency: string): string {
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  if (!min && !max) return "Competitive";
  if (min && max) return `${currency} ${fmt(min)} – ${fmt(max)}`;
  return `${currency} ${fmt(min || max)}`;
}

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export function CareersJobsView() {
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = React.useState("");

  const { data: company } = useQuery({
    queryKey: ["careers", tenantSlug, "company"],
    queryFn: () => careersApi.getCompany(tenantSlug),
    enabled: !!tenantSlug,
    retry: false,
  });

  const { data: jobs = [], isLoading, isError } = useQuery({
    queryKey: ["careers", tenantSlug, "jobs"],
    queryFn: () => careersApi.getOpenJobs(tenantSlug),
    enabled: !!tenantSlug,
    retry: false,
  });

  const filtered = jobs.filter(j => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return j.title.toLowerCase().includes(q)
      || j.department.toLowerCase().includes(q)
      || j.branch.toLowerCase().includes(q);
  });

  return (
    <CareersLayout tenantSlug={tenantSlug} companyName={company?.name}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Open Positions</h1>
        <p className="mt-2 text-slate-400">
          {company?.name ? `Join the team at ${company.name}.` : "Explore current openings and apply online."}
        </p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, department, or location…"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading open positions…</p>}

      {isError && (
        <p className="text-sm text-red-400">
          We couldn't load this company's job board. Please check the link or try again later.
        </p>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
          <Briefcase className="mx-auto h-8 w-8 mb-3 text-slate-600" />
          {jobs.length === 0 ? "No open positions right now. Check back soon!" : "No positions match your search."}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(job => (
          <Link
            key={job.id}
            to={`/careers/${tenantSlug}/jobs/${job.id}`}
            className="block rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-blue-500/50 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">{job.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.department}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.branch}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{TYPE_LABELS[job.type] ?? job.type}</span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-emerald-400">
                {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400 line-clamp-2">{job.description}</p>
          </Link>
        ))}
      </div>
    </CareersLayout>
  );
}

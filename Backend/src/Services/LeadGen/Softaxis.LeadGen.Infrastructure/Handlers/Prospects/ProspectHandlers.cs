using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.LeadIntake.Commands;
using Softaxis.LeadGen.Application;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Catalog;
using Softaxis.LeadGen.Application.Prospects;
using Softaxis.LeadGen.Application.Scoring;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Providers;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Prospects;

internal static class ProspectQueries
{
    public static IQueryable<Prospect> Filter(LeadGenDbContext db, ProspectFilter f)
    {
        var q = db.Prospects.AsNoTracking().Where(p => !p.IsDeleted);
        if (f.SearchJobId is { } sj) q = q.Where(p => p.SearchJobId == sj);
        if (!string.IsNullOrWhiteSpace(f.Status)) q = q.Where(p => p.Status == f.Status);
        if (f.Revealed is { } rv) q = q.Where(p => p.IsRevealed == rv);
        if (f.MinQuality is { } mq) q = q.Where(p => p.QualityScore >= mq);
        if (f.MinFit is { } mf) q = q.Where(p => p.FitScore >= mf);
        if (!string.IsNullOrWhiteSpace(f.Region)) q = q.Where(p => p.Region == f.Region);
        if (!string.IsNullOrWhiteSpace(f.Category)) q = q.Where(p => p.Category == f.Category);
        if (f.HasEmail is { } he) q = he ? q.Where(p => p.IsRevealed && p.Email != null) : q.Where(p => !p.IsRevealed || p.Email == null);
        if (f.OwnerUserId is { } ow) q = q.Where(p => p.OwnerUserId == ow);
        if (f.InCrm is { } ic) q = ic ? q.Where(p => p.CrmLeadId != null) : q.Where(p => p.CrmLeadId == null);

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = f.Search.Trim();
            // Contact details are searchable only once revealed, so a search cannot be used to probe
            // for an email or number the workspace has not paid for.
            q = q.Where(p => p.Name.Contains(s) || (p.Area != null && p.Area.Contains(s)) || (p.Address != null && p.Address.Contains(s))
                          || (p.IsRevealed && ((p.Email != null && p.Email.Contains(s)) || (p.Phone != null && p.Phone.Contains(s)) || (p.Domain != null && p.Domain.Contains(s)))));
        }

        return f.Sort switch
        {
            "quality" => q.OrderByDescending(p => p.QualityScore).ThenByDescending(p => p.FitScore),
            "newest"  => q.OrderByDescending(p => p.CreatedAt),
            "name"    => q.OrderBy(p => p.Name),
            "rating"  => q.OrderByDescending(p => p.Rating).ThenByDescending(p => p.ReviewCount),
            _         => q.OrderByDescending(p => p.FitScore).ThenByDescending(p => p.QualityScore),
        };
    }
}

internal sealed class GetProspectsHandler(LeadGenDbContext db) : IQueryHandler<GetProspectsQuery, PagedResult<ProspectDto>>
{
    public async Task<Result<PagedResult<ProspectDto>>> Handle(GetProspectsQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 500);
        var query = ProspectQueries.Filter(db, q.Filter);
        var total = await query.CountAsync(ct);
        var rows = await query.Skip((page - 1) * size).Take(size).ToListAsync(ct);

        var set = await SuppressionSupport.LoadAsync(db, ct);
        var items = rows.Select(p => ProspectSupport.ToDto(p, p.IsRevealed && SuppressionSupport.IsSuppressed(set, p.Email, p.Domain, p.PhoneE164))).ToList();
        return Result.Success(new PagedResult<ProspectDto>(items, total, page, size));
    }
}

internal sealed class GetProspectStatsHandler(LeadGenDbContext db) : IQueryHandler<GetProspectStatsQuery, ProspectStatsDto>
{
    public async Task<Result<ProspectStatsDto>> Handle(GetProspectStatsQuery q, CancellationToken ct)
    {
        var query = db.Prospects.AsNoTracking().Where(p => !p.IsDeleted);
        if (q.SearchJobId is { } sj) query = query.Where(p => p.SearchJobId == sj);
        var by = await query.GroupBy(p => p.Status).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        int N(string s) => by.GetValueOrDefault(s);
        var inCrm = await query.CountAsync(p => p.CrmLeadId != null, ct);
        return Result.Success(new ProspectStatsDto(by.Values.Sum(), N(ProspectStatus.Discovered), N(ProspectStatus.Revealed),
            N(ProspectStatus.Contacted), N(ProspectStatus.Replied), N(ProspectStatus.Qualified), N(ProspectStatus.Converted),
            N(ProspectStatus.Rejected), N(ProspectStatus.DoNotContact), inCrm));
    }
}

internal sealed class GetProspectByIdHandler(LeadGenDbContext db) : IQueryHandler<GetProspectByIdQuery, ProspectDto>
{
    public async Task<Result<ProspectDto>> Handle(GetProspectByIdQuery q, CancellationToken ct)
    {
        var p = await db.Prospects.AsNoTracking().Include(x => x.Contacts.Where(c => !c.IsDeleted))
            .FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure<ProspectDto>(Error.NotFoundById("Prospect", q.Id));
        var set = await SuppressionSupport.LoadAsync(db, ct);
        return Result.Success(ProspectSupport.ToDto(p, p.IsRevealed && SuppressionSupport.IsSuppressed(set, p.Email, p.Domain, p.PhoneE164),
            p.Contacts.Select(ProspectSupport.ToDto).ToList()));
    }
}

internal sealed class UpdateProspectHandler(LeadGenDbContext db) : ICommandHandler<UpdateProspectCommand, ProspectDto>
{
    public async Task<Result<ProspectDto>> Handle(UpdateProspectCommand cmd, CancellationToken ct)
    {
        var p = await db.Prospects.Include(x => x.Contacts.Where(c => !c.IsDeleted)).FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure<ProspectDto>(Error.NotFoundById("Prospect", cmd.Id));

        if (cmd.Status is not null)
        {
            if (!p.IsRevealed && cmd.Status != ProspectStatus.Rejected)
                return Result.Failure<ProspectDto>(Error.Custom("Prospect.Conflict", "Reveal this prospect before working it."));
            p.SetStatus(cmd.Status);
            // "Do not contact" is a promise to the person: honour it everywhere, immediately.
            if (cmd.Status == ProspectStatus.DoNotContact)
            {
                if (!string.IsNullOrWhiteSpace(p.Email)) await SuppressionSupport.AddAsync(db, SuppressionKind.Email, p.Email, SuppressionReason.DoNotContact, "prospect", null, false, ct);
                if (!string.IsNullOrWhiteSpace(p.PhoneE164)) await SuppressionSupport.AddAsync(db, SuppressionKind.Phone, p.PhoneE164, SuppressionReason.DoNotContact, "prospect", null, false, ct);
            }
        }
        if (cmd.Notes is not null) p.SetNotes(cmd.Notes);
        if (cmd.ClearOwner) p.Assign(null, null);
        else if (cmd.OwnerUserId is { } owner) p.Assign(owner, cmd.OwnerName);

        await db.SaveChangesAsync(ct);
        var set = await SuppressionSupport.LoadAsync(db, ct);
        return Result.Success(ProspectSupport.ToDto(p, p.IsRevealed && SuppressionSupport.IsSuppressed(set, p.Email, p.Domain, p.PhoneE164),
            p.Contacts.Select(ProspectSupport.ToDto).ToList()));
    }
}

internal sealed class BulkProspectsHandler(LeadGenDbContext db) : ICommandHandler<BulkProspectsCommand, BulkResultDto>
{
    public async Task<Result<BulkResultDto>> Handle(BulkProspectsCommand cmd, CancellationToken ct)
    {
        var ids = cmd.Ids.Distinct().ToList();
        var rows = await db.Prospects.Where(p => ids.Contains(p.Id) && !p.IsDeleted).ToListAsync(ct);
        int affected = 0;

        foreach (var p in rows)
        {
            switch (cmd.Action)
            {
                case "delete":
                    // A revealed prospect was paid for and may be in a campaign or the CRM. Keep the record
                    // unless it is a teaser the user simply does not want.
                    if (p.IsRevealed && (p.CrmLeadId is not null)) continue;
                    p.Delete(); affected++; break;
                case "assign":
                    if (cmd.OwnerUserId is null) { p.Assign(null, null); } else p.Assign(cmd.OwnerUserId, cmd.OwnerName);
                    affected++; break;
                case "status":
                    if (!p.IsRevealed && cmd.Status != ProspectStatus.Rejected) continue;
                    p.SetStatus(cmd.Status!); affected++; break;
            }
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(new BulkResultDto(affected, ids.Count - affected));
    }
}

internal sealed class CreateProspectHandler(LeadGenDbContext db, ICurrentUser user) : ICommandHandler<CreateProspectCommand, ProspectDto>
{
    public async Task<Result<ProspectDto>> Handle(CreateProspectCommand cmd, CancellationToken ct)
    {
        var i = cmd.Input;
        var country = GeoCatalog.Get(i.CountryCode);
        if (country is null) return Result.Failure<ProspectDto>(Error.Custom("Prospect.Invalid", "Unknown country."));

        var phone = PhoneNormalizer.Normalize(i.Phone, country.PhoneRegion);
        if (!string.IsNullOrWhiteSpace(i.Phone) && phone is null)
            return Result.Failure<ProspectDto>(Error.Custom("Prospect.Invalid", "That phone number does not look valid for this country."));

        var domain = ProspectSupport.DomainOf(i.Website);
        var email = string.IsNullOrWhiteSpace(i.Email) ? null : i.Email.Trim().ToLowerInvariant();

        // The same business entered twice splits its history; catch the obvious cases.
        var key = Text(i.Name);
        var dupe = await db.Prospects.AsNoTracking().AnyAsync(p => !p.IsDeleted &&
            ((phone != null && p.PhoneE164 == phone.E164) || (email != null && p.Email == email) || (domain != null && p.Domain == domain) || (p.NameKey == key && p.Region == i.Region)), ct);
        if (dupe) return Result.Failure<ProspectDto>(Error.Custom("Prospect.Duplicate", "This business is already in your prospects."));

        var p = new Prospect(null, i.Name, country.Code);
        p.SetListing(null, i.Category, null, i.Region, i.City, null, i.Address, null, null, phone?.Display ?? i.Phone, phone?.E164,
            phone?.Type, i.Website, domain, null, null, "OPERATIONAL", null, null);
        if (email is not null)
        {
            // A hand-entered address is the user's own responsibility, but it still gets the basic check at send time.
            p.SetContactEmail(email, EmailStatus.Unknown, ProspectScoring.IsRoleAddress(email));
        }
        p.SetNotes(i.Notes);
        p.MarkRevealed(user.Id, 0);   // entered by hand: nothing to pay for
        p.Assign(user.Id, user.Name);

        var profile = ProspectSupport.ProfileFor(await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct));
        var s = ProspectSupport.ScoreOf(p, profile);
        p.SetScores(s.Quality, s.Fit, ProspectScoring.NotesJson(s.Notes));

        db.Prospects.Add(p);
        await db.SaveChangesAsync(ct);
        return Result.Success(ProspectSupport.ToDto(p, false, []));
    }

    private static string Text(string s) => new(s.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
}

internal sealed class AddContactHandler(LeadGenDbContext db, IEmailChecker emails) : ICommandHandler<AddContactCommand, ContactDto>
{
    public async Task<Result<ContactDto>> Handle(AddContactCommand cmd, CancellationToken ct)
    {
        var p = await db.Prospects.FirstOrDefaultAsync(x => x.Id == cmd.ProspectId && !x.IsDeleted, ct);
        if (p is null) return Result.Failure<ContactDto>(Error.NotFoundById("Prospect", cmd.ProspectId));
        if (!p.IsRevealed) return Result.Failure<ContactDto>(Error.Custom("Prospect.Conflict", "Reveal this prospect first."));

        var c = new ProspectContact(p.Id, cmd.FullName, cmd.Title, cmd.Email, cmd.Phone, "manual");
        if (!string.IsNullOrWhiteSpace(cmd.Email))
        {
            var check = await emails.CheckAsync(cmd.Email, ct);
            c.SetEmailStatus(check.Status);
        }
        db.Contacts.Add(c);
        await db.SaveChangesAsync(ct);
        return Result.Success(ProspectSupport.ToDto(c));
    }
}

internal sealed class DeleteContactHandler(LeadGenDbContext db) : ICommandHandler<DeleteContactCommand>
{
    public async Task<Result> Handle(DeleteContactCommand cmd, CancellationToken ct)
    {
        var c = await db.Contacts.FirstOrDefaultAsync(x => x.Id == cmd.ContactId && x.ProspectId == cmd.ProspectId && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Contact", cmd.ContactId));
        c.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Reveal ───────────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Reveals prospects, which is where credits are spent.
///
/// Three phases, so the slow network work never holds a database transaction and never runs one
/// prospect at a time: (1) charge, each under its own idempotency key; (2) enrich every charged
/// prospect in parallel; (3) save the results, refunding any prospect where nothing usable turned up.
/// "Usable" means a valid phone or an email that can be sent to — a reveal that yields neither costs
/// the workspace nothing.
/// </summary>
internal sealed class RevealProspectsHandler(
    LeadGenDbContext db, IPlatformSettings settings, ICreditService credits, IEnrichmentService enrichment,
    ICurrentUser user, ILogger<RevealProspectsHandler> logger) : ICommandHandler<RevealProspectsCommand, RevealResultDto>
{
    private sealed class Job
    {
        public required Prospect P { get; init; }
        public BusinessDirectoryEntry? Dir { get; init; }
        public int Charged { get; set; }
        public Enrichment? Result { get; set; }
        public bool FromPool { get; set; }
    }

    public async Task<Result<RevealResultDto>> Handle(RevealProspectsCommand cmd, CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        if (!cfg.Enabled) return Result.Failure<RevealResultDto>(Error.Custom("Prospect.Conflict", "Lead generation is switched off on this platform."));

        var ids = cmd.Ids.Distinct().ToList();
        if (ids.Count > cfg.MaxRevealsPerRequest)
            return Result.Failure<RevealResultDto>(Error.Custom("Prospect.Invalid", $"Reveal at most {cfg.MaxRevealsPerRequest} prospects at a time."));

        var prospects = await db.Prospects.Where(p => ids.Contains(p.Id) && !p.IsDeleted).ToDictionaryAsync(p => p.Id, ct);
        var dirIds = prospects.Values.Where(p => p.DirectoryId != null).Select(p => p.DirectoryId!.Value).Distinct().ToList();
        var directory = await db.Directory.Where(d => dirIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id, ct);

        await credits.EnsureWalletAsync(ct);
        var items = new List<RevealItemDto>(); var jobs = new List<Job>();
        var outOfCredits = false;

        // Phase 1 — charge.
        foreach (var id in ids)
        {
            if (!prospects.TryGetValue(id, out var p)) { items.Add(new(id, "not_found", 0, "Prospect not found.")); continue; }
            if (p.IsRevealed) { items.Add(new(id, "skipped", 0, "Already revealed.")); continue; }
            if (p.BusinessStatus == "CLOSED_PERMANENTLY") { items.Add(new(id, "skipped", 0, "Permanently closed.")); continue; }
            if (outOfCredits) { items.Add(new(id, "insufficient_credits", 0, "Not enough credits.")); continue; }

            var spend = await credits.TrySpendAsync(cfg.RevealCost, $"Revealed {p.Name}", "prospect", p.Id, $"reveal:{p.Id}", ct);
            if (!spend.Ok) { outOfCredits = true; items.Add(new(id, "insufficient_credits", 0, "Not enough credits.")); continue; }

            jobs.Add(new Job { P = p, Dir = p.DirectoryId is { } d && directory.TryGetValue(d, out var e) ? e : null, Charged = cfg.RevealCost });
        }

        if (jobs.Count == 0) return Result.Success(await SummaryAsync(items, ct));

        try
        {
            // Phase 2 — enrich in parallel. Only network and DNS here; nothing touches the DbContext.
            var fresh = DateTime.UtcNow.AddDays(-cfg.PoolFreshDays);
            using var gate = new SemaphoreSlim(6);
            await Task.WhenAll(jobs.Select(async j =>
            {
                if (j.Dir is { EnrichedAt: { } at } dir && at >= fresh)
                {
                    // Someone enriched this business recently. Reuse it — free for us, instant for them.
                    j.FromPool = true;
                    j.Result = new Enrichment(dir.Email, dir.EmailStatus, dir.EmailIsRole, dir.Social, dir.Phone, dir.PhoneE164, dir.PhoneType, true, null);
                    return;
                }
                await gate.WaitAsync(ct);
                try
                {
                    j.Result = await enrichment.EnrichAsync(j.P.Website, j.P.Phone, null, j.P.CountryCode, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Enrichment failed for {Prospect}", j.P.Id);
                    j.Result = new Enrichment(null, EmailStatus.Unknown, false, null, null, null, null, false, null);
                }
                finally { gate.Release(); }
            }));

            // Phase 3 — save, bonus, refund.
            var profile = ProspectSupport.ProfileFor(await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct));
            var suppressed = await SuppressionSupport.LoadAsync(db, ct);

            foreach (var j in jobs)
            {
                var p = j.P; var r = j.Result!;
                var phoneE164 = r.PhoneE164 ?? p.PhoneE164;
                var emailOk = r.Email is not null && EmailStatus.Sendable(r.EmailStatus);
                var usable = !string.IsNullOrWhiteSpace(phoneE164) || emailOk;

                if (!usable)
                {
                    // Nothing to reach them with. They pay nothing.
                    await credits.AddAsync(j.Charged, LedgerType.Refund, $"No usable contact found for {p.Name}", "prospect", p.Id, $"reveal-refund:{p.Id}", ct);
                    p.SetEnrichment(null, EmailStatus.Unknown, false, r.SocialJson, null, null, null, DateTime.UtcNow);
                    var s0 = ProspectSupport.ScoreOf(p, profile);
                    p.SetScores(s0.Quality, s0.Fit, ProspectScoring.NotesJson(s0.Notes));
                    items.Add(new(p.Id, "refunded", 0, "No phone or email could be found. You were not charged."));
                    continue;
                }

                p.SetEnrichment(r.Email, r.EmailStatus, r.EmailIsRole, r.SocialJson, r.Phone, r.PhoneE164, r.PhoneType, DateTime.UtcNow);

                // Pay a little more for a real person's or a confirmed address — only if they can afford it.
                var total = j.Charged;
                if (cfg.VerifiedEmailBonus > 0 && emailOk && (r.EmailStatus == EmailStatus.Valid || !r.EmailIsRole))
                {
                    var bonus = await credits.TrySpendAsync(cfg.VerifiedEmailBonus, $"Verified email for {p.Name}", "prospect", p.Id, $"reveal-bonus:{p.Id}", ct);
                    if (bonus.Ok) total += cfg.VerifiedEmailBonus;
                }

                p.MarkRevealed(user.Id, total);
                var isSuppressed = SuppressionSupport.IsSuppressed(suppressed, p.Email, p.Domain, p.PhoneE164);
                if (isSuppressed) p.SetStatus(ProspectStatus.DoNotContact);
                var s = ProspectSupport.ScoreOf(p, profile);
                p.SetScores(s.Quality, s.Fit, ProspectScoring.NotesJson(s.Notes));

                // Feed the shared pool, role addresses only: no named individual is ever stored platform-wide.
                if (!j.FromPool && j.Dir is not null)
                    j.Dir.SetEnrichment(r.EmailIsRole ? r.Email : null, r.EmailIsRole ? r.EmailStatus : EmailStatus.Unknown,
                        r.EmailIsRole, r.SocialJson, r.Phone, r.PhoneE164, r.PhoneType);

                items.Add(new(p.Id, "revealed", total, isSuppressed ? "On your do-not-contact list." : null));
            }

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Something broke after money moved. Give back whatever was not completed, then fail.
            logger.LogError(ex, "Reveal failed after charging; refunding.");
            db.ChangeTracker.Clear();
            foreach (var j in jobs)
                if (!items.Any(i => i.Id == j.P.Id))
                    await credits.AddAsync(j.Charged, LedgerType.Refund, $"Reveal failed for {j.P.Name}", "prospect", j.P.Id, $"reveal-refund:{j.P.Id}", CancellationToken.None);
            return Result.Failure<RevealResultDto>(Error.Custom("Prospect.Failed", "Something went wrong. You were not charged for the prospects that did not finish."));
        }

        return Result.Success(await SummaryAsync(items, ct));
    }

    private async Task<RevealResultDto> SummaryAsync(List<RevealItemDto> items, CancellationToken ct) =>
        new(items.Count(i => i.Outcome == "revealed"), items.Count(i => i.Outcome == "refunded"),
            items.Count(i => i.Outcome is "skipped" or "not_found" or "insufficient_credits"),
            items.Sum(i => i.Credits), await credits.BalanceAsync(ct), items);
}

// ── CRM hand-off ─────────────────────────────────────────────────────────────────────────────

internal sealed class ImportToCrmHandler(LeadGenDbContext db, ISender sender, ICurrentUser user)
    : ICommandHandler<ImportToCrmCommand, ImportToCrmResult>
{
    public async Task<Result<ImportToCrmResult>> Handle(ImportToCrmCommand cmd, CancellationToken ct)
    {
        if (!user.HasModule("crm"))
            return Result.Failure<ImportToCrmResult>(Error.Custom("Crm.Forbidden", "Your plan does not include the CRM."));
        if (!user.HasPermission("crm.leads.create"))
            return Result.Failure<ImportToCrmResult>(Error.Custom("Crm.Forbidden", "You need permission to create CRM leads."));

        var ids = cmd.Ids.Distinct().ToList();
        var rows = await db.Prospects.Include(p => p.Contacts.Where(c => !c.IsDeleted)).Where(p => ids.Contains(p.Id) && !p.IsDeleted).ToListAsync(ct);
        var suppressed = await SuppressionSupport.LoadAsync(db, ct);
        var jobIds = rows.Where(r => r.SearchJobId != null).Select(r => r.SearchJobId!.Value).Distinct().ToList();
        var jobNames = await db.Searches.AsNoTracking().Where(s => jobIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Name, ct);

        int created = 0, duplicates = 0, failed = 0, notRevealed = 0;
        var errors = new List<string>();

        foreach (var p in rows)
        {
            if (!p.IsRevealed) { notRevealed++; continue; }
            if (p.CrmLeadId is not null) { duplicates++; continue; }
            if (p.Status == ProspectStatus.DoNotContact || SuppressionSupport.IsSuppressed(suppressed, p.Email, p.Domain, p.PhoneE164))
            { failed++; errors.Add($"{p.Name}: on your do-not-contact list."); continue; }

            var contact = p.Contacts.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.FullName));
            var fields = new Dictionary<string, string?>
            {
                ["google_maps"] = p.GoogleMapsUri, ["website"] = p.Website, ["rating"] = p.Rating?.ToString(),
                ["reviews"] = p.ReviewCount?.ToString(), ["quality_score"] = p.QualityScore.ToString(), ["fit_score"] = p.FitScore.ToString(),
            };
            var notes = string.Join("; ", ProspectScoring.ParseList(p.ScoreNotes));
            var input = new IngestLeadInput(
                null, null, contact?.FullName ?? p.Name, contact?.Email ?? p.Email, p.PhoneE164 ?? p.Phone,
                p.Name, contact?.Title, ProspectSupport.LabelOf(p.Category), p.Address, p.City ?? p.Region,
                GeoCatalog.Get(p.CountryCode)?.Name, notes.Length == 0 ? null : notes, "lead-generation",
                p.SearchJobId is { } sj && jobNames.TryGetValue(sj, out var n) ? n : null, fields,
                WhatsApp: p.PhoneType == "mobile" ? p.PhoneE164 : null);

            try
            {
                var res = await sender.Send(new IngestLeadCommand(input), ct);
                if (!res.IsSuccess) { failed++; errors.Add($"{p.Name}: {res.Error.Description}"); continue; }
                var outcome = res.Value.Outcome;
                if (res.Value.LeadId is { } leadId && outcome is "created" or "updated" or "duplicate")
                {
                    p.LinkCrmLead(leadId);
                    if (outcome == "created") created++; else duplicates++;
                }
                else { failed++; errors.Add($"{p.Name}: {res.Value.Message ?? "The CRM did not accept this lead."}"); }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                failed++; errors.Add($"{p.Name}: could not be added.");
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new ImportToCrmResult(created, duplicates, failed, notRevealed, errors.Take(50).ToList()));
    }
}

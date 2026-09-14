using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.PortalListings.Commands;
using Softaxis.CRM.Application.PortalListings.Dtos;
using Softaxis.CRM.Application.PortalListings.Queries;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.PortalListings;

internal static partial class PortalListingSupport
{
    public static PortalListingDto ToDto(PortalListing x) => new(
        x.Id, x.Portal, x.Reference, x.ListingId, x.Url, x.Title, x.AgentUserId, x.AgentName, x.TeamId,
        x.IsActive, x.EnquiryCount, x.LastEnquiryAt, x.CreatedAt);

    // "Ref: 100104-SI9UFU", "Reference No. 100104-SI9UFU" — agents paste the line straight from the message.
    [GeneratedRegex(@"^\s*ref(?:erence)?(?:\s*(?:no\.?|number|#))?\s*[:#]?\s*", RegexOptions.IgnoreCase)]
    private static partial Regex RefPrefix();

    [GeneratedRegex(@"^\d{4,12}$")]
    private static partial Regex Digits();

    /// <summary>
    /// Turns what the agent typed into the two routing keys. Forgiving about WHERE they typed it — a URL
    /// pasted into the reference box is still a URL — and strict about what it must contain, because a
    /// listing saved with a key no enquiry will ever carry is worse than a refusal: it looks registered
    /// and routes nothing.
    /// </summary>
    public static Result<(string? Reference, string? ListingId, string? Url)> Parse(string? reference, string? url)
    {
        var r = string.IsNullOrWhiteSpace(reference) ? null : RefPrefix().Replace(reference.Trim(), "").Trim();
        var u = string.IsNullOrWhiteSpace(url) ? null : url.Trim();

        if (r is not null && r.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            u ??= r;
            r = null;
        }
        if (string.IsNullOrEmpty(r)) r = null;

        if (u is not null && (!Uri.TryCreate(u, UriKind.Absolute, out var uri)
                              || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)))
            return Fail("The listing URL must be a full web address starting with https://.");

        if (r is not null && r.Any(char.IsWhiteSpace))
            return Fail($"\"{r}\" is not a listing reference — a reference has no spaces, e.g. 100104-SI9UFU.");

        var listingId = PortalListingUrl.ExtractId(u);
        // A bare number is the listing id, not the account reference (references carry a dash).
        if (listingId is null && r is not null && Digits().IsMatch(r))
        {
            listingId = r;
            r = null;
        }

        if (r is null && listingId is null)
            return Fail(u is not null
                ? "That URL does not contain a listing id. Copy the link of the listing itself, or enter its reference."
                : "Enter the listing reference (e.g. 100104-SI9UFU) or the listing URL.");

        return Result.Success((r, listingId, u));
    }

    private static Result<(string?, string?, string?)> Fail(string message) =>
        Result.Failure<(string?, string?, string?)>(Error.Custom("Validation.Failed", message));

    /// <summary>
    /// The agent the listing is registered to, validated against THIS workspace — never trusting the
    /// name from the client, since the name is what the agent and every admin will read.
    /// </summary>
    public static async Task<(Guid Id, string Name)?> FindAgentAsync(CrmDbContext db, Guid userId, CancellationToken ct)
    {
        var tenant = TenantAmbient.TenantId;
        var u = await db.Set<IdentityUserView>().AsNoTracking()
            .Where(x => x.Id == userId && !x.IsDeleted && x.TenantId == tenant)
            .Select(x => new { x.Id, x.FirstName, x.LastName, x.Username })
            .FirstOrDefaultAsync(ct);
        if (u is null) return null;
        var name = $"{u.FirstName} {u.LastName}".Trim();
        return (u.Id, name.Length > 0 ? name : u.Username);
    }

    /// <summary>The user's team when they are in exactly one — never a guess for someone in several.</summary>
    public static async Task<Guid?> SoleTeamAsync(CrmDbContext db, Guid userId, CancellationToken ct)
    {
        var tenant = TenantAmbient.TenantId;
        var teams = await (
                from m in db.Set<IdentityTeamMemberView>()
                join t in db.Set<IdentityTeamView>() on m.TeamId equals t.Id
                where m.UserId == userId && t.TenantId == tenant && t.IsActive && !t.IsDeleted
                select t.Id)
            .Distinct().Take(2).ToListAsync(ct);
        return teams.Count == 1 ? teams[0] : null;
    }

    /// <summary>
    /// A reference or listing id can belong to one agent only — two registrations would make the
    /// routing depend on which row the database returns first. Names the holder so the two agents can
    /// sort it out rather than guessing why their listing "does nothing".
    /// </summary>
    public static async Task<Result?> DuplicateAsync(
        CrmDbContext db, string portal, string? reference, string? listingId, Guid? exceptId, CancellationToken ct)
    {
        var clash = await db.PortalListings.AsNoTracking()
            .Where(x => !x.IsDeleted && x.Portal == portal && x.Id != exceptId
                        && ((reference != null && x.Reference == reference) || (listingId != null && x.ListingId == listingId)))
            .Select(x => new { x.Reference, x.ListingId, x.AgentName })
            .FirstOrDefaultAsync(ct);
        if (clash is null) return null;

        var key = clash.Reference is not null && string.Equals(clash.Reference, reference, StringComparison.OrdinalIgnoreCase)
            ? clash.Reference
            : clash.ListingId;
        return Result.Failure(Error.Custom("PortalListing.Duplicate",
            $"Listing {key} is already registered to {clash.AgentName}."));
    }

    public static readonly Error NotAllowed = Error.Custom("PortalListing.Conflict",
        "You can register listings only for yourself, or for members of a team you lead (pick them under that team).");

    public static readonly Error NotFound = Error.Custom("PortalListing.NotFound", "Listing not found.");
}

internal sealed class GetPortalListingsHandler(CrmDbContext db, ILeadAccessGuard guard, ICurrentUser currentUser)
    : IQueryHandler<GetPortalListingsQuery, IReadOnlyList<PortalListingDto>>
{
    public async Task<Result<IReadOnlyList<PortalListingDto>>> Handle(GetPortalListingsQuery q, CancellationToken ct)
    {
        // !IsDeleted by hand: the tenant filter replaces any entity-level soft-delete filter.
        var query = guard.ScopeListings(db.PortalListings.AsNoTracking()).Where(x => !x.IsDeleted);

        if (q.Mine)
        {
            if (currentUser.Id is not { } me) return Result.Success<IReadOnlyList<PortalListingDto>>([]);
            query = query.Where(x => x.AgentUserId == me);
        }
        if (!string.IsNullOrWhiteSpace(q.Portal)) query = query.Where(x => x.Portal == q.Portal);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(x =>
                (x.Reference != null && x.Reference.Contains(s)) ||
                (x.ListingId != null && x.ListingId.Contains(s)) ||
                (x.Title != null && x.Title.Contains(s)) ||
                (x.Url != null && x.Url.Contains(s)) ||
                x.AgentName.Contains(s));
        }

        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(2000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PortalListingDto>>(rows.Select(PortalListingSupport.ToDto).ToList());
    }
}

internal sealed class CreatePortalListingHandler(CrmDbContext db, ILeadAccessGuard guard, ICurrentUser currentUser)
    : ICommandHandler<CreatePortalListingCommand, PortalListingDto>
{
    public async Task<Result<PortalListingDto>> Handle(CreatePortalListingCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } me) return Result.Failure<PortalListingDto>(PortalListingSupport.NotAllowed);

        var parsed = PortalListingSupport.Parse(cmd.Reference, cmd.Url);
        if (parsed.IsFailure) return Result.Failure<PortalListingDto>(parsed.Error);
        var (reference, listingId, url) = parsed.Value;

        var agentId = cmd.AgentUserId ?? me;
        if (await PortalListingSupport.FindAgentAsync(db, agentId, ct) is not { } agent)
            return Result.Failure<PortalListingDto>(Error.Custom("PortalListing.NotFound", "That agent has no login in this workspace."));

        // Filed to a team so the agent's team lead sees it — the agent's own team when unambiguous.
        var teamId = cmd.TeamId ?? await PortalListingSupport.SoleTeamAsync(db, agentId, ct);

        if (!await guard.CanManageListingAsync(agentId, teamId, ct))
            return Result.Failure<PortalListingDto>(PortalListingSupport.NotAllowed);

        if (await PortalListingSupport.DuplicateAsync(db, cmd.Portal, reference, listingId, null, ct) is { } dup)
            return Result.Failure<PortalListingDto>(dup.Error);

        var listing = new PortalListing(cmd.Portal, reference, listingId, url, cmd.Title,
            agent.Id, agent.Name, teamId, me);
        db.PortalListings.Add(listing);
        await db.SaveChangesAsync(ct);
        return Result.Success(PortalListingSupport.ToDto(listing));
    }
}

internal sealed class UpdatePortalListingHandler(CrmDbContext db, ILeadAccessGuard guard)
    : ICommandHandler<UpdatePortalListingCommand, PortalListingDto>
{
    public async Task<Result<PortalListingDto>> Handle(UpdatePortalListingCommand cmd, CancellationToken ct)
    {
        var listing = await db.PortalListings.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (listing is null) return Result.Failure<PortalListingDto>(PortalListingSupport.NotFound);

        // Must be allowed to manage it as it stands AND as it will be — otherwise an agent could hand
        // their listing (and every future enquiry on it) to someone outside their reach.
        if (!await guard.CanManageListingAsync(listing.AgentUserId, listing.TeamId, ct))
            return Result.Failure<PortalListingDto>(PortalListingSupport.NotFound);

        var parsed = PortalListingSupport.Parse(cmd.Reference, cmd.Url);
        if (parsed.IsFailure) return Result.Failure<PortalListingDto>(parsed.Error);
        var (reference, listingId, url) = parsed.Value;

        if (await PortalListingSupport.FindAgentAsync(db, cmd.AgentUserId, ct) is not { } agent)
            return Result.Failure<PortalListingDto>(Error.Custom("PortalListing.NotFound", "That agent has no login in this workspace."));

        var teamId = cmd.TeamId
                     ?? (cmd.AgentUserId == listing.AgentUserId
                         ? listing.TeamId
                         : await PortalListingSupport.SoleTeamAsync(db, cmd.AgentUserId, ct));

        if (!await guard.CanManageListingAsync(agent.Id, teamId, ct))
            return Result.Failure<PortalListingDto>(PortalListingSupport.NotAllowed);

        if (await PortalListingSupport.DuplicateAsync(db, listing.Portal, reference, listingId, listing.Id, ct) is { } dup)
            return Result.Failure<PortalListingDto>(dup.Error);

        listing.Update(reference, listingId, url, cmd.Title, agent.Id, agent.Name, teamId, cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(PortalListingSupport.ToDto(listing));
    }
}

internal sealed class ImportPortalListingsHandler(CrmDbContext db, ILeadAccessGuard guard, ICurrentUser currentUser)
    : ICommandHandler<ImportPortalListingsCommand, ImportPortalListingsResultDto>
{
    public async Task<Result<ImportPortalListingsResultDto>> Handle(ImportPortalListingsCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } me)
            return Result.Failure<ImportPortalListingsResultDto>(PortalListingSupport.NotAllowed);

        var tenant = TenantAmbient.TenantId;
        var users = await db.Set<IdentityUserView>().AsNoTracking()
            .Where(u => u.TenantId == tenant && !u.IsDeleted)
            .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.Username })
            .ToListAsync(ct);
        var nameOf = users.ToDictionary(u => u.Id, u =>
        {
            var n = $"{u.FirstName} {u.LastName}".Trim();
            return n.Length > 0 ? n : u.Username;
        });

        // Existing keys loaded once, per portal, so thousands of rows don't mean thousands of queries.
        var existing = await db.PortalListings.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Select(x => new { x.Portal, x.Reference, x.ListingId, x.AgentName })
            .ToListAsync(ct);
        var taken = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in existing)
        {
            if (e.Reference is not null) taken.TryAdd($"{e.Portal}|r|{e.Reference}", e.AgentName);
            if (e.ListingId is not null) taken.TryAdd($"{e.Portal}|i|{e.ListingId}", e.AgentName);
        }

        var teamCache = new Dictionary<Guid, Guid?>();
        var errors = new List<ImportPortalListingRowError>();
        var created = 0;

        for (var i = 0; i < cmd.Rows.Count; i++)
        {
            var row = cmd.Rows[i];
            var rowNo = i + 1;
            var label = row.Reference ?? row.Url;
            void Skip(string reason) => errors.Add(new ImportPortalListingRowError(rowNo, label, reason));

            var portal = string.IsNullOrWhiteSpace(row.Portal) ? cmd.Portal : NormalizePortal(row.Portal);
            if (portal is null) { Skip($"Unknown portal \"{row.Portal}\"."); continue; }

            var parsed = PortalListingSupport.Parse(row.Reference, row.Url);
            if (parsed.IsFailure) { Skip(parsed.Error.Description); continue; }
            var (reference, listingId, url) = parsed.Value;

            // Agent: blank = me. Email first; a name only when exactly one login carries it.
            Guid agentId;
            var agentText = row.Agent?.Trim();
            if (string.IsNullOrEmpty(agentText)) agentId = me;
            else if (agentText.Contains('@'))
            {
                var hit = users.FirstOrDefault(u => string.Equals(u.Email, agentText, StringComparison.OrdinalIgnoreCase));
                if (hit is null) { Skip($"No login with the email {agentText}."); continue; }
                agentId = hit.Id;
            }
            else
            {
                var wanted = NormalizeName(agentText);
                var hits = users.Where(u => NormalizeName($"{u.FirstName} {u.LastName}") == wanted).Take(2).ToList();
                if (hits.Count != 1)
                {
                    Skip(hits.Count == 0 ? $"No login named \"{agentText}\"." : $"More than one login is named \"{agentText}\" — use their email.");
                    continue;
                }
                agentId = hits[0].Id;
            }

            if (!teamCache.TryGetValue(agentId, out var teamId))
                teamCache[agentId] = teamId = await PortalListingSupport.SoleTeamAsync(db, agentId, ct);

            if (!await guard.CanManageListingAsync(agentId, teamId, ct))
            {
                Skip($"You can't register listings for {nameOf.GetValueOrDefault(agentId, agentText)}.");
                continue;
            }

            string? holder = null;
            if (reference is not null && taken.TryGetValue($"{portal}|r|{reference}", out var h1)) holder = h1;
            else if (listingId is not null && taken.TryGetValue($"{portal}|i|{listingId}", out var h2)) holder = h2;
            if (holder is not null) { Skip($"Already registered to {holder}."); continue; }

            var agentName = nameOf.GetValueOrDefault(agentId, "");
            db.PortalListings.Add(new PortalListing(portal, reference, listingId, url, row.Title, agentId, agentName, teamId, me));
            if (reference is not null) taken[$"{portal}|r|{reference}"] = agentName;
            if (listingId is not null) taken[$"{portal}|i|{listingId}"] = agentName;
            created++;
        }

        if (created > 0) await db.SaveChangesAsync(ct);
        return Result.Success(new ImportPortalListingsResultDto(created, errors.Count, errors.Take(500).ToList()));
    }

    private static string? NormalizePortal(string p)
    {
        var k = new string(p.Trim().ToLowerInvariant().Where(char.IsLetter).ToArray());
        return k switch
        {
            "bayut" => "bayut",
            "propertyfinder" or "pf" => "property-finder",
            "dubizzle" => "dubizzle",
            _ => null,
        };
    }

    private static string NormalizeName(string s) =>
        string.Join(' ', new string(s.Select(c => char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : ' ').ToArray())
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
}

internal sealed class DeletePortalListingHandler(CrmDbContext db, ILeadAccessGuard guard)
    : ICommandHandler<DeletePortalListingCommand>
{
    public async Task<Result> Handle(DeletePortalListingCommand cmd, CancellationToken ct)
    {
        var listing = await db.PortalListings.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (listing is null || !await guard.CanManageListingAsync(listing.AgentUserId, listing.TeamId, ct))
            return Result.Failure(PortalListingSupport.NotFound);

        listing.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

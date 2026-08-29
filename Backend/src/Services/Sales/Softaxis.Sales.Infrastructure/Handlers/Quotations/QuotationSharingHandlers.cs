using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.Abstractions;
using Softaxis.Sales.Application.Quotations.Commands;
using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

// ── Issue a share link without sending ────────────────────────────────────────
internal sealed class CreateQuotationShareLinkHandler(SalesDbContext db, IPublicLinkBuilder links)
    : ICommandHandler<CreateQuotationShareLinkCommand, QuotationShareLinkDto>
{
    public async Task<Result<QuotationShareLinkDto>> Handle(
        CreateQuotationShareLinkCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (q is null) return Result.Failure<QuotationShareLinkDto>(QuotationErrors.NotFound);

        var token = q.EnsureShareToken();
        await db.SaveChangesAsync(ct);

        return Result.Success(new QuotationShareLinkDto(token, links.QuotationUrl(token)));
    }
}

internal sealed class RevokeQuotationShareLinkHandler(SalesDbContext db)
    : ICommandHandler<RevokeQuotationShareLinkCommand>
{
    public async Task<Result> Handle(RevokeQuotationShareLinkCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (q is null) return Result.Failure(QuotationErrors.NotFound);

        q.RevokeShareLink();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Send to the customer ──────────────────────────────────────────────────────
internal sealed class SendQuotationHandler(
    SalesDbContext             db,
    IPublicLinkBuilder         links,
    IQuotationEmailSender      email,
    IQuotationBrandingProvider branding)
    : ICommandHandler<SendQuotationCommand, QuotationSendResultDto>
{
    public async Task<Result<QuotationSendResultDto>> Handle(SendQuotationCommand cmd, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (q is null) return Result.Failure<QuotationSendResultDto>(QuotationErrors.NotFound);

        if (q.Status == SalesQuotation.StatusConverted)
            return Result.Failure<QuotationSendResultDto>(QuotationErrors.Conflict(
                "This quotation has already been converted to a sales order."));

        if (q.Items.Count == 0)
            return Result.Failure<QuotationSendResultDto>(QuotationErrors.Conflict(
                "Add at least one line item before sending the quotation."));

        var to = string.IsNullOrWhiteSpace(cmd.ToEmail) ? q.CustomerEmail : cmd.ToEmail.Trim();

        if (cmd.SendEmail && string.IsNullOrWhiteSpace(to))
            return Result.Failure<QuotationSendResultDto>(QuotationErrors.Conflict(
                "No customer email address to send to. Add one to the quotation, or copy the share link instead."));

        // Mark sent and commit BEFORE attempting delivery. A quotation whose email failed can be
        // resent from a link that already exists; a link that was emailed but never persisted is
        // a dead URL in the customer's inbox.
        var token = q.MarkSent(to);
        await db.SaveChangesAsync(ct);

        var url = links.QuotationUrl(token);
        if (!cmd.SendEmail)
            return Result.Success(new QuotationSendResultDto(false, to, url, null));

        var brand = await branding.GetAsync(TenantAmbient.TenantId, ct);
        var total = MoneyFormat.Format(q.Total, q.CurrencyCode);

        bool sent;
        try
        {
            sent = await email.SendAsync(to!, q.CustomerName, q.QuotationNumber, q.Title,
                                         brand.CompanyName, url, cmd.Message, q.ValidUntil, total, ct);
        }
        catch
        {
            // Delivery is best-effort by design: the quotation is already sent and shareable, so
            // an SMTP outage must not read to the user as "the quotation failed".
            sent = false;
        }

        return Result.Success(new QuotationSendResultDto(
            sent, to, url,
            sent ? null : "The quotation is ready and its share link is active, but the email could not be delivered. Send the link to the customer directly."));
    }
}

// ── Public: open the link ─────────────────────────────────────────────────────
/// <summary>
/// Anonymous. There is no tenant on the request, so the token is looked up with the global
/// tenant filter bypassed and the ambient tenant is then set from the row itself — the same
/// shape the careers portal and the restaurant public-ordering endpoints use.
/// </summary>
internal sealed class ViewPublicQuotationHandler(SalesDbContext db, IQuotationBrandingProvider branding)
    : ICommandHandler<ViewPublicQuotationCommand, PublicQuotationDto>
{
    public async Task<Result<PublicQuotationDto>> Handle(ViewPublicQuotationCommand cmd, CancellationToken ct)
    {
        var q = await PublicQuotationLookup.FindAsync(db, cmd.Token, ct);
        if (q is null) return Result.Failure<PublicQuotationDto>(QuotationErrors.NotFound);

        // A quotation the tenant has not sent yet must not be readable, even by someone holding a
        // token issued by the copy-link flow — the copy-link exists so the sender can paste it
        // into their own email, and that act is still "sending".
        if (q.Status == SalesQuotation.StatusDraft)
            return Result.Failure<PublicQuotationDto>(QuotationErrors.NotFound);

        q.MarkViewed();
        await db.SaveChangesAsync(ct);

        var tenantId = PublicQuotationLookup.TenantIdOf(db, q);
        var brand    = await branding.GetAsync(tenantId, ct);
        return Result.Success(QuotationMappings.ToPublicDto(q, brand));
    }
}

// ── Public: accept / decline ──────────────────────────────────────────────────
internal sealed class RespondToPublicQuotationHandler(SalesDbContext db, IQuotationBrandingProvider branding)
    : ICommandHandler<RespondToPublicQuotationCommand, PublicQuotationDto>
{
    public async Task<Result<PublicQuotationDto>> Handle(
        RespondToPublicQuotationCommand cmd, CancellationToken ct)
    {
        var q = await PublicQuotationLookup.FindAsync(db, cmd.Token, ct);
        if (q is null || q.Status == SalesQuotation.StatusDraft)
            return Result.Failure<PublicQuotationDto>(QuotationErrors.NotFound);

        if (q.IsExpired(DateTime.UtcNow))
            return Result.Failure<PublicQuotationDto>(QuotationErrors.Conflict(
                "This quotation has expired. Please contact us for an updated quote."));

        if (!q.Respond(cmd.Accepted, cmd.ByName, cmd.Comment))
            return Result.Failure<PublicQuotationDto>(QuotationErrors.Conflict(
                "This quotation has already been answered."));

        await db.SaveChangesAsync(ct);

        var tenantId = PublicQuotationLookup.TenantIdOf(db, q);
        var brand    = await branding.GetAsync(tenantId, ct);
        return Result.Success(QuotationMappings.ToPublicDto(q, brand));
    }
}

internal static class PublicQuotationLookup
{
    /// <summary>
    /// Resolves a quotation from its share token with no tenant context.
    ///
    /// <c>IgnoreQueryFilters</c> drops the tenant filter — unavoidable, since an anonymous
    /// request has no tenant to filter by — so it also drops the soft-delete filter, and
    /// <c>IsDeleted</c> is re-applied by hand. The token is 24 CSPRNG bytes and uniquely
    /// indexed, so it identifies exactly one row across all tenants; the ambient tenant is then
    /// set from that row so the subsequent save stamps and scopes correctly.
    /// </summary>
    public static async Task<SalesQuotation?> FindAsync(SalesDbContext db, string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var q = await db.SalesQuotations
            .IgnoreQueryFilters()
            .Include(x => x.Items)
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.ShareToken == token && !x.IsDeleted, ct);

        if (q is null) return null;

        var tenantId = TenantIdOf(db, q);
        if (tenantId is not null && !TenantAmbient.IsResolved)
            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

        return q;
    }

    /// <summary>Reads the shadow tenant column off a tracked entity.</summary>
    public static Guid? TenantIdOf(SalesDbContext db, SalesQuotation q)
    {
        var entry = db.Entry(q);
        var prop  = entry.Metadata.FindProperty("TenantId");
        return prop is null ? null : entry.Property("TenantId").CurrentValue as Guid?;
    }
}

internal static class MoneyFormat
{
    /// <summary>
    /// "PKR 12,500.00" — the invariant culture with an explicit code, because this string goes
    /// into an email rendered on the customer's device, where the server's culture is irrelevant
    /// and a bare symbol would be ambiguous.
    /// </summary>
    public static string Format(decimal amount, string currencyCode) =>
        $"{currencyCode} {amount.ToString("N2", CultureInfo.InvariantCulture)}";
}

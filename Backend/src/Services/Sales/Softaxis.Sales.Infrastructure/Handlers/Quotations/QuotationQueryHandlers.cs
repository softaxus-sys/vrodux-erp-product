using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Application.Quotations.Queries;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

internal sealed class GetQuotationsHandler(SalesDbContext db)
    : IQueryHandler<GetQuotationsQuery, PagedResult<QuotationSummaryDto>>
{
    public async Task<Result<PagedResult<QuotationSummaryDto>>> Handle(
        GetQuotationsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 200);

        IQueryable<SalesQuotation> q = db.SalesQuotations
            .AsNoTracking()
            .Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            q = q.Where(x => x.QuotationNumber.Contains(s)
                          || (x.CustomerName != null && x.CustomerName.Contains(s))
                          || (x.Title        != null && x.Title.Contains(s))
                          || (x.Reference    != null && x.Reference.Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (query.CustomerId.HasValue)
            q = q.Where(x => x.CustomerId == query.CustomerId.Value);

        if (query.InvoiceId.HasValue)
            q = q.Where(x => x.InvoiceId == query.InvoiceId.Value);

        var total      = await q.CountAsync(ct);
        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling((double)total / pageSize);

        // Materialise before mapping: the totals are computed properties on the aggregate
        // (optional lines excluded, header discount applied, tax taken on the discounted base),
        // and re-expressing that arithmetic as a SQL projection is exactly how a list total ends
        // up disagreeing with the document the customer was sent.
        var rows = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var items = rows.Select(x => new QuotationSummaryDto(
            x.Id, x.QuotationNumber, x.Title, x.CustomerId, x.CustomerName,
            x.Status, x.CurrencyCode, x.DiscountPercent,
            x.SubTotal, x.DiscountAmount, x.TaxAmount, x.Total,
            x.Items.Count, x.IssueDate, x.ValidUntil, x.IsExpired(now),
            x.ConvertedOrderId, x.InvoiceId, x.InvoiceNumber,
            x.ShareToken != null,
            x.SentAt, x.ViewedAt, x.RespondedAt,
            x.CreatedAt, x.UpdatedAt)).ToList();

        return Result.Success(new PagedResult<QuotationSummaryDto>(
            items, page, pageSize, total, totalPages, page < totalPages, page > 1));
    }
}

internal sealed class GetQuotationByIdHandler(SalesDbContext db)
    : IQueryHandler<GetQuotationByIdQuery, QuotationDto>
{
    public async Task<Result<QuotationDto>> Handle(GetQuotationByIdQuery query, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .AsNoTracking()
            .Include(x => x.Items)
            .Include(x => x.Sections)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        return q is null
            ? Result.Failure<QuotationDto>(Error.Custom("Quotation.NotFound", "Quotation not found."))
            : Result.Success(QuotationMappings.ToDto(q));
    }
}

internal sealed class GetQuotationTemplatesHandler(SalesDbContext db)
    : IQueryHandler<GetQuotationTemplatesQuery, IReadOnlyList<QuotationTemplateDto>>
{
    public async Task<Result<IReadOnlyList<QuotationTemplateDto>>> Handle(
        GetQuotationTemplatesQuery query, CancellationToken ct)
    {
        IQueryable<QuotationTemplate> q = db.QuotationTemplates
            .AsNoTracking()
            .Include(x => x.Items);

        if (!query.IncludeInactive) q = q.Where(x => x.IsActive);

        var rows = await q
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<QuotationTemplateDto>>(
            rows.Select(QuotationMappings.ToDto).ToList());
    }
}

internal sealed class GetQuotationTemplateByIdHandler(SalesDbContext db)
    : IQueryHandler<GetQuotationTemplateByIdQuery, QuotationTemplateDto>
{
    public async Task<Result<QuotationTemplateDto>> Handle(
        GetQuotationTemplateByIdQuery query, CancellationToken ct)
    {
        var t = await db.QuotationTemplates
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        return t is null
            ? Result.Failure<QuotationTemplateDto>(
                Error.Custom("QuotationTemplate.NotFound", "Quotation template not found."))
            : Result.Success(QuotationMappings.ToDto(t));
    }
}

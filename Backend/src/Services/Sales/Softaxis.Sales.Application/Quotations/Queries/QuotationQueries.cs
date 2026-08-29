using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Sales.Application.Quotations.Dtos;

namespace Softaxis.Sales.Application.Quotations.Queries;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int  Page,
    int  PageSize,
    int  TotalCount,
    int  TotalPages,
    bool HasNext,
    bool HasPrev);

public sealed record GetQuotationsQuery(
    int     Page       = 1,
    int     PageSize   = 20,
    string? Search     = null,
    string? Status     = null,
    Guid?   CustomerId = null,
    /// <summary>Quotations attached to one Finance invoice — powers the invoice drawer's list.</summary>
    Guid?   InvoiceId  = null
) : IQuery<PagedResult<QuotationSummaryDto>>;

public sealed record GetQuotationByIdQuery(Guid Id) : IQuery<QuotationDto>;

// ── Templates ─────────────────────────────────────────────────────────────────
public sealed record GetQuotationTemplatesQuery(bool IncludeInactive = false)
    : IQuery<IReadOnlyList<QuotationTemplateDto>>;

public sealed record GetQuotationTemplateByIdQuery(Guid Id) : IQuery<QuotationTemplateDto>;

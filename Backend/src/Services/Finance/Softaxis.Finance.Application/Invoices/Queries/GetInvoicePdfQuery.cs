using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Invoices.Queries;

/// <summary>
/// The invoice as a PDF — the same document that is attached to the customer's email.
///
/// <para>Exists so the app and the customer never see two different invoices. The frontend used to
/// build its own copy with window.print(), which meant a second layout that could drift from the
/// one actually sent; this endpoint is the single source.</para>
/// </summary>
public sealed record GetInvoicePdfQuery(Guid Id) : IQuery<InvoicePdfDto>;

public sealed record InvoicePdfDto(string FileName, byte[] Content);

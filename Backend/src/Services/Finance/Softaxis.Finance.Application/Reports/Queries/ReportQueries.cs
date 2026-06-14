using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Reports.Dtos;

namespace Softaxis.Finance.Application.Reports.Queries;

public sealed record GetArAgingQuery(string? AsOf) : IQuery<AgingReportDto>;

public sealed record GetApAgingQuery(string? AsOf) : IQuery<AgingReportDto>;

public sealed record GetCustomerStatementQuery(Guid CustomerId, string? From, string? To) : IQuery<StatementDto>;

public sealed record GetSupplierStatementQuery(Guid SupplierId, string? From, string? To) : IQuery<StatementDto>;

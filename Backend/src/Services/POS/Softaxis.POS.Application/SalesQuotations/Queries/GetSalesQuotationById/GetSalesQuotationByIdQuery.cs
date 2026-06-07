using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesQuotations.Queries.GetSalesQuotationById;

public sealed record GetSalesQuotationByIdQuery(Guid Id) : IQuery<SalesQuotationDto>;

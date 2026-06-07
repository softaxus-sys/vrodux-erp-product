using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Queries.GetTransactionById;

public sealed record GetTransactionByIdQuery(Guid Id) : IQuery<POSTransactionDto>;

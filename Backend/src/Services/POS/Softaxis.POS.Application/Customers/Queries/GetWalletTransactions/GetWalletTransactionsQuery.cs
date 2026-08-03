using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Queries.GetWalletTransactions;

public sealed record GetWalletTransactionsQuery(Guid CustomerId) : IQuery<IReadOnlyList<CustomerWalletTransactionDto>>;

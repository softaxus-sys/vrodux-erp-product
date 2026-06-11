using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Banking.Dtos;

namespace Softaxis.Finance.Application.Banking.Queries;

public sealed record GetBankingSummaryQuery : IQuery<BankingSummaryDto>;

public sealed record GetBankAccountsQuery : IQuery<IReadOnlyList<BankAccountDto>>;

public sealed record GetBankTransactionsQuery(Guid? AccountId, string? Type) : IQuery<IReadOnlyList<BankTransactionDto>>;

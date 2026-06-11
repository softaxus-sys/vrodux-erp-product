using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Tax.Commands;

public sealed record FileTaxPeriodCommand(Guid Id) : ICommand;

public sealed record PayTaxPeriodCommand(Guid Id) : ICommand;

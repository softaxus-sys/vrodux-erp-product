using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record StartPerformanceReviewCommand(Guid Id) : ICommand;

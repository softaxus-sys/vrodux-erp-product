using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record DeletePerformanceGoalCommand(Guid ReviewId, Guid GoalId) : ICommand;

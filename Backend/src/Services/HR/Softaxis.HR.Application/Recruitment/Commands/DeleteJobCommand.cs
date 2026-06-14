using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Recruitment.Commands;

public sealed record DeleteJobCommand(Guid Id) : ICommand;

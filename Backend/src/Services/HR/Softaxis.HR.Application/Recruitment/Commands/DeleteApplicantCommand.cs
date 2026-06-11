using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Recruitment.Commands;

public sealed record DeleteApplicantCommand(Guid Id) : ICommand;

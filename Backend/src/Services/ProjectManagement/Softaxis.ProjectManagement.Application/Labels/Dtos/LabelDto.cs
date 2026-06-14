namespace Softaxis.ProjectManagement.Application.Labels.Dtos;

public sealed record LabelDto(Guid Id, Guid ProjectId, string Name, string Color);

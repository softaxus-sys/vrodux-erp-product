using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Projects.Commands;
using Softaxis.ProjectManagement.Application.Projects.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Projects;

internal sealed class CreateProjectHandler(ProjectManagementDbContext db)
    : ICommandHandler<CreateProjectCommand, ProjectDto>
{
    public async Task<Result<ProjectDto>> Handle(CreateProjectCommand cmd, CancellationToken ct)
    {
        var key = await GenerateUniqueKeyAsync(cmd.Name, db, ct);

        var entity = new Project(key, cmd.Name, cmd.Description, cmd.LeadName);
        db.Projects.Add(entity);

        var columns = new[]
        {
            new BoardColumn(entity.Id, "Backlog",     "backlog",     0, isDefault: true),
            new BoardColumn(entity.Id, "To Do",       "todo",        1, isDefault: true),
            new BoardColumn(entity.Id, "In Progress", "in_progress", 2, isDefault: true),
            new BoardColumn(entity.Id, "In Review",   "in_progress", 3, isDefault: true),
            new BoardColumn(entity.Id, "Done",        "done",        4, isDefault: true),
        };
        db.BoardColumns.AddRange(columns);

        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(entity));
    }

    private static async Task<string> GenerateUniqueKeyAsync(string name, ProjectManagementDbContext db, CancellationToken ct)
    {
        var baseKey = DeriveBaseKey(name);
        var key = baseKey;
        var suffix = 2;

        while (await db.Projects.AnyAsync(x => x.Key == key, ct))
        {
            key = $"{baseKey}{suffix}";
            suffix++;
        }

        return key;
    }

    private static string DeriveBaseKey(string name)
    {
        var words = name
            .Split([' ', '-', '_', '.'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(w => w.Any(char.IsLetterOrDigit))
            .ToList();

        string key;
        if (words.Count > 1)
            key = new string(words.Take(4).Select(w => w.First(char.IsLetterOrDigit)).ToArray());
        else if (words.Count == 1)
            key = new string(words[0].Where(char.IsLetterOrDigit).Take(4).ToArray());
        else
            key = "PRJ";

        key = key.ToUpperInvariant();
        return key.Length == 0 ? "PRJ" : key;
    }

    internal static ProjectDto ToDto(Project p) =>
        new(p.Id, p.Key, p.Name, p.Description, p.Status, p.LeadName, p.NextIssueNumber, p.CreatedAt, p.UpdatedAt);
}

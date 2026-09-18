using Softaxis.Support.Application.Tickets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Options;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Application.Tickets.Queries;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>
/// Cross-schema read: every service in this codebase points at the same physical database,
/// different schema. "identity" is a RESERVED SQL Server keyword and MUST be bracketed, or this
/// fails with "Incorrect syntax near the keyword 'identity'". Column is `p.ModuleId`, not
/// `p.Module` — confirmed against `PermissionConfiguration`/the InitialCreate migration.
///
/// Scope note (same simplification Real Estate's rent-alert CC list documents): role-derived
/// only. Per-user permission grants/denies are not applied here, so a user granted
/// support.tickets.edit individually (rather than through a role) is not listed. Good enough for
/// choosing an assignee; not used for any access decision itself.
/// </summary>
internal sealed class GetSupportAgentsHandler(
    SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard, IOptions<SupportOptions> options)
    : IQueryHandler<GetSupportAgentsQuery, IReadOnlyList<SupportAgentDto>>
{
    private sealed record AgentRow(Guid Id, string Username, string FirstName, string LastName, string Email);

    public async Task<Result<IReadOnlyList<SupportAgentDto>>> Handle(GetSupportAgentsQuery query, CancellationToken ct)
    {
        if (!TicketAccess.IsAgent(currentUser, guard))
            return Result.Failure<IReadOnlyList<SupportAgentDto>>(
                Error.Custom("Support.Forbidden", "Only Softaxis support agents can list the agent roster."));

        var operatorTenantId = options.Value.OperatorTenantId;
        if (operatorTenantId is null || operatorTenantId == Guid.Empty)
            return Result.Success<IReadOnlyList<SupportAgentDto>>([]);

        var rows = await db.Database.SqlQuery<AgentRow>($@"
            SELECT DISTINCT u.[Id], u.[Username], u.[FirstName], u.[LastName], u.[Email]
            FROM [identity].[users] u
            JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
            JOIN [identity].[role_permissions] rp ON rp.RoleId = ur.RoleId
            JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
            WHERE u.IsDeleted = 0
              AND u.TenantId = {operatorTenantId}
              AND p.ModuleId = 'support.tickets'
              AND p.Action = 'edit'").ToListAsync(ct);

        var agents = rows
            .Select(r => new SupportAgentDto(r.Id, BuildName(r), r.Email))
            .OrderBy(a => a.Name)
            .ToList();

        return Result.Success<IReadOnlyList<SupportAgentDto>>(agents);
    }

    private static string BuildName(AgentRow r)
    {
        var full = $"{r.FirstName} {r.LastName}".Trim();
        return string.IsNullOrWhiteSpace(full) ? r.Username : full;
    }
}

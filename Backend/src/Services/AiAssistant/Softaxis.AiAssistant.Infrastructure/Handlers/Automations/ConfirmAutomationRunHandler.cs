using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Automations.Commands;
using Softaxis.AiAssistant.Application.Automations.Dtos;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Automations;

/// <summary>
/// Resolves a confirm-mode run that is waiting on a write. Approving mints a token for the rule's
/// run-as user and executes the queued action under their identity (RBAC enforced); rejecting just
/// discards it. Scopes the ambient tenant to the run's tenant for the whole operation.
/// </summary>
internal sealed class ConfirmAutomationRunHandler(
    AiAssistantDbContext db,
    ISender sender,
    IAiOrchestrator orchestrator,
    Microsoft.Extensions.Configuration.IConfiguration configuration)
    : ICommandHandler<ConfirmAutomationRunCommand, AutomationRunDto>
{
    public async Task<Result<AutomationRunDto>> Handle(ConfirmAutomationRunCommand cmd, CancellationToken ct)
    {
        var run = await db.AutomationRuns.FirstOrDefaultAsync(x => x.Id == cmd.RunId, ct);
        if (run is null)
            return Result.Failure<AutomationRunDto>(Error.Custom("AutomationRun.NotFound", "Automation run not found."));
        if (!run.IsPending || string.IsNullOrEmpty(run.PendingToolName))
            return Result.Failure<AutomationRunDto>(Error.Custom("AutomationRun.Conflict", "This run is not awaiting confirmation."));

        if (!cmd.Approve)
        {
            run.Resolve("rejected", "Action was rejected and not run.", null);
            await db.SaveChangesAsync(ct);
            return Result.Success(AutomationMappings.ToRunDto(run));
        }

        var tenantId = (Guid?)db.Entry(run).Property(TenantIsolation.Column).CurrentValue;
        if (tenantId is null)
            return Result.Failure<AutomationRunDto>(Error.Custom("AutomationRun.Invalid", "Run has no tenant."));

        var tokenResult = await sender.Send(new IssueServiceTokenCommand(run.RunAsUserId), ct);
        if (tokenResult.IsFailure)
        {
            run.Resolve("failed", null, "The run-as user is no longer eligible to run this action.");
            await db.SaveChangesAsync(ct);
            return Result.Success(AutomationMappings.ToRunDto(run));
        }
        var tok = tokenResult.Value;
        var baseUrl = configuration["Ai:BaseUrl"] ?? configuration["Integrations:PublicBaseUrl"] ?? "http://localhost:5000";

        var prevTenant = TenantAmbient.TenantId;
        var prevSuper  = TenantAmbient.IsSuperAdmin;
        var prevResolved = TenantAmbient.IsResolved;
        TenantAmbient.Set(tenantId.Value, isSuperAdmin: false, isResolved: true);
        try
        {
            using (AiImpersonation.Use(new AiImpersonatedUser(
                tok.UserId, tok.Username, tok.Email, tok.IsSuperAdmin,
                tok.Permissions.ToHashSet(StringComparer.Ordinal), tok.AccessToken, baseUrl)))
            {
                var res = await orchestrator.ConfirmAsync(run.PendingToolName!, run.PendingArgumentsJson ?? "{}", ct);
                run.Resolve("success", res.Reply, null);
            }
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            TenantAmbient.Set(prevTenant, prevSuper, prevResolved);
        }

        return Result.Success(AutomationMappings.ToRunDto(run));
    }
}

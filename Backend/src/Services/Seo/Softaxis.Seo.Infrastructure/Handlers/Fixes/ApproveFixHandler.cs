using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Fixes.Commands;
using Softaxis.Seo.Application.Fixes.Dtos;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Fixes;

/// <summary>Approving IS the deploy step (see SeoFix's own remarks) — the snippet starts serving
/// this fix on the tenant's live site the moment this commits.</summary>
internal sealed class ApproveFixHandler(SeoDbContext db, ICurrentUser currentUser) : ICommandHandler<ApproveFixCommand, FixDto>
{
    public async Task<Result<FixDto>> Handle(ApproveFixCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Result.Failure<FixDto>(Error.Custom("Seo.Unresolved", "Could not resolve the signed-in user."));

        var fix = await db.Fixes.FirstOrDefaultAsync(f => f.Id == cmd.Id, ct);
        if (fix is null) return Result.Failure<FixDto>(Error.NotFoundById("SeoFix", cmd.Id));

        fix.Approve(currentUser.Id.Value, currentUser.Username ?? "Unknown user", cmd.EditedValueJson);

        var issue = await db.Issues.FirstOrDefaultAsync(i => i.Id == fix.IssueId, ct);
        issue?.MarkApplied();

        await db.SaveChangesAsync(ct);

        return Result.Success(new FixDto(
            fix.Id, fix.IssueId, fix.SiteId, fix.PageUrl, fix.ChangeType, fix.ProposedValueJson, fix.Rationale,
            fix.Status, fix.ReviewedByName, fix.ReviewedAt, fix.AppliedAt, fix.CreatedAt,
            issue?.Title ?? "", issue?.Severity ?? "", issue?.Category ?? ""));
    }
}

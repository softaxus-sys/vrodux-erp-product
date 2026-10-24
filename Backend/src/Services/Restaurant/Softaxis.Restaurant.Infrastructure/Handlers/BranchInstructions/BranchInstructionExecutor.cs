using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.BranchInstructions;

/// <summary>
/// Runs on a BRANCH server: applies what head office asked for. The instruction arrives by the ordinary
/// down-sync; this finds the ones with no result yet, applies each through the normal void / refund
/// commands (so every rule - validation, shift checks, the audit trail - is the same as at the till), and
/// records the outcome in a result row that syncs back up.
///
/// <para>
/// <b>Claim, then act.</b> A result row (<c>applying</c>) is saved BEFORE the change is attempted. If the
/// server stops in between, the instruction is not repeated: a refund run twice is worse than one that
/// waits for a person. The change is recorded under the requester's id (<see cref="InstructionIdentity"/>),
/// so the audit trail names the head-office user.
/// </para>
///
/// <para>Does nothing unless <c>BranchSync:Mode = Branch</c>. See <c>docs/branch-server-design.md</c> §7.</para>
/// </summary>
internal sealed class BranchInstructionExecutor(
    IServiceScopeFactory scopes, IConfiguration configuration, ILogger<BranchInstructionExecutor> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!string.Equals(configuration["BranchSync:Mode"], "Branch", StringComparison.OrdinalIgnoreCase)) return;
        if (!Guid.TryParse(configuration["BranchSync:TenantId"], out var tenantId) ||
            !Guid.TryParse(configuration["BranchSync:BranchId"], out var branchId))
        {
            logger.LogWarning("Branch instructions: BranchSync TenantId / BranchId are not set; nothing will be applied.");
            return;
        }

        // Not at startup: migrations run first and work started earlier competes with /health.
        try { await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue("BranchSync:StartupDelaySeconds", 300))), stoppingToken); }
        catch (OperationCanceledException) { return; }

        var interval = TimeSpan.FromSeconds(Math.Max(1, configuration.GetValue("BranchSync:IntervalSeconds", 5)));
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await PassAsync(tenantId, branchId, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unhandled exception would end the worker for the life of the process.
                logger.LogError(ex, "Branch instructions: a pass failed.");
            }

            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task PassAsync(Guid tenantId, Guid branchId, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();

        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
        try
        {
            var pending = await db.BranchInstructions
                .Where(i => i.BranchId == branchId && !db.BranchInstructionResults.Any(r => r.Id == i.Id))
                .OrderBy(i => i.RequestedAt)
                .Take(20)
                .ToListAsync(ct);

            foreach (var i in pending)
            {
                // Claim first (see the class comment).
                var result = new BranchInstructionResult(i.Id, branchId);
                db.BranchInstructionResults.Add(result);
                await db.SaveChangesAsync(ct);

                bool ok; string? message = null;
                try
                {
                    // Own scope = own DbContext: a failing command leaves its half-made changes there,
                    // not on the context that records the result.
                    using var cmdScope = scopes.CreateScope();
                    var sender = cmdScope.ServiceProvider.GetRequiredService<ISender>();
                    using var _ = InstructionIdentity.Begin(i.RequestedByUserId, i.RequestedByName);
                    if (i.Kind == BranchInstruction.VoidOrder)
                    {
                        var r = await sender.Send(new VoidOrderCommand(i.OrderId, i.Reason), ct);
                        ok = r.IsSuccess; message = ok ? null : r.Error.Description;
                    }
                    else if (i.Kind == BranchInstruction.RefundOrder)
                    {
                        var r = await sender.Send(new RefundOrderCommand(i.OrderId, i.Amount ?? 0, i.Reason, i.Method ?? ""), ct);
                        ok = r.IsSuccess; message = ok ? null : r.Error.Description;
                    }
                    else { ok = false; message = $"Unknown instruction '{i.Kind}'."; }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    ok = false; message = ex.Message;
                    logger.LogError(ex, "Branch instructions: {Kind} for order {Order} failed.", i.Kind, i.OrderId);
                }

                result.Finish(ok, message);
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Branch instructions: {Kind} for order {Order} - {Status}.", i.Kind, i.OrderId, result.Status);
            }
        }
        finally
        {
            // AsyncLocal ambient: clear it so nothing else on this thread inherits the tenant.
            TenantAmbient.Clear();
        }
    }
}

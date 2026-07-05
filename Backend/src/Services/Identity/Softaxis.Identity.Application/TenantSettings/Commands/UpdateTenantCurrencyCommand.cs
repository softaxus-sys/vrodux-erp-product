using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Application.TenantsAdmin;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantSettings.Commands;

/// <summary>
/// Self-service: the signed-in tenant admin changes their own tenant's operating currency.
/// Takes effect immediately in the UI (auth store) and is embedded in the next issued token.
/// </summary>
public sealed record UpdateTenantCurrencyCommand(string Currency) : ICommand<TenantDto>;

public sealed class UpdateTenantCurrencyValidator : AbstractValidator<UpdateTenantCurrencyCommand>
{
    public UpdateTenantCurrencyValidator()
    {
        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required.")
            .MaximumLength(50);
    }
}

public sealed class UpdateTenantCurrencyCommandHandler(
    ITenantContext    tenantContext,
    ITenantRepository tenantRepo,
    IUnitOfWork       uow)
    : ICommandHandler<UpdateTenantCurrencyCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(UpdateTenantCurrencyCommand cmd, CancellationToken ct)
    {
        if (tenantContext.TenantId is not { } tenantId)
            return Result.Failure<TenantDto>(Error.Custom("Tenant.NotResolved", "No tenant context on this request."));

        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.Custom("Tenant.NotFound", "Tenant not found."));

        tenant.SetCurrency(cmd.Currency);   // normalises "USD - US Dollar" or "USD" → "USD"
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}

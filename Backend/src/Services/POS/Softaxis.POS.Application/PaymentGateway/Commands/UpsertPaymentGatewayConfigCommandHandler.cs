using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.PaymentGateway.Dtos;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PaymentGateway.Commands;

public sealed class UpsertPaymentGatewayConfigCommandHandler(
    IPaymentGatewayConfigRepository repo, ISecretProtector protector, IUnitOfWork uow)
    : ICommandHandler<UpsertPaymentGatewayConfigCommand, PaymentGatewayConfigDto>
{
    public async Task<Result<PaymentGatewayConfigDto>> Handle(UpsertPaymentGatewayConfigCommand cmd, CancellationToken ct)
    {
        var config = await repo.GetAsync(ct);
        var isNew = config is null;
        config ??= PaymentGatewayConfig.CreateDefault();

        // null = leave the currently-stored secret unchanged (GET never round-trips the plaintext
        // back to the browser, so a blank field must not be read as "clear it").
        var apiKeyEncrypted = cmd.ApiKey is null ? config.ApiKeyEncrypted : protector.Protect(cmd.ApiKey);
        var secretKeyEncrypted = cmd.SecretKey is null ? config.SecretKeyEncrypted : protector.Protect(cmd.SecretKey);

        config.Configure(cmd.Provider, apiKeyEncrypted, secretKeyEncrypted, cmd.PublicKey, cmd.Mode, cmd.IsEnabled);

        if (isNew) repo.Add(config); else repo.Update(config);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new PaymentGatewayConfigDto(
            config.Provider, config.ApiKeyEncrypted != null, config.SecretKeyEncrypted != null,
            config.PublicKey, config.Mode, config.IsEnabled));
    }
}

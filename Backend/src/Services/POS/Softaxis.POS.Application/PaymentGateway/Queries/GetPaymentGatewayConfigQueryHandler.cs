using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.PaymentGateway.Dtos;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PaymentGateway.Queries;

public sealed class GetPaymentGatewayConfigQueryHandler(IPaymentGatewayConfigRepository repo)
    : IQueryHandler<GetPaymentGatewayConfigQuery, PaymentGatewayConfigDto>
{
    public async Task<Result<PaymentGatewayConfigDto>> Handle(GetPaymentGatewayConfigQuery query, CancellationToken ct)
    {
        var config = await repo.GetAsync(ct);

        // No config saved yet — this tenant is on the default ("manual") shape, matching how a new
        // Order.PaymentMethod already behaves without any gateway configured.
        if (config is null)
            return Result.Success(new PaymentGatewayConfigDto("manual", false, false, null, "test", true));

        return Result.Success(new PaymentGatewayConfigDto(
            config.Provider, config.ApiKeyEncrypted != null, config.SecretKeyEncrypted != null,
            config.PublicKey, config.Mode, config.IsEnabled));
    }
}

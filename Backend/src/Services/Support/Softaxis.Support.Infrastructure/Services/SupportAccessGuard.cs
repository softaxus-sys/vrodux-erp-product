using Microsoft.Extensions.Options;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Options;

namespace Softaxis.Support.Infrastructure.Services;

internal sealed class SupportAccessGuard(IOptions<SupportOptions> options, ICurrentUser currentUser)
    : ISupportAccessGuard
{
    public bool IsOperatorTenantCaller
    {
        get
        {
            var operatorTenantId = options.Value.OperatorTenantId;
            // Unconfigured → fail closed. Nobody is an agent until Softaxis's own tenant id is
            // set in config — never fall back to "any tenant" or "no check".
            if (operatorTenantId is null || operatorTenantId == Guid.Empty) return false;
            return currentUser.TenantId == operatorTenantId;
        }
    }
}

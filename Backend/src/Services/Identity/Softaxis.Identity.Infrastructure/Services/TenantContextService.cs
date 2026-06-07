using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Resolved per-request from JWT claims via TenantContextMiddleware.
/// Provides plan limits for use in command handlers.
/// </summary>
public sealed class TenantContextService : ITenantContext
{
    private bool                  _resolved;
    private Guid?                 _tenantId;
    private string?               _tenantSlug;
    private string?               _tenantName;
    private PlanType?             _plan;
    private bool                  _isSuperAdmin;
    private IReadOnlyList<string> _modules = [];

    public bool                  IsResolved   => _resolved;
    public Guid?                 TenantId     => _tenantId;
    public string?               TenantSlug   => _tenantSlug;
    public string?               TenantName   => _tenantName;
    public PlanType?             Plan         => _plan;
    public PlanLimits?           Limits       => _plan.HasValue ? PlanDefinitions.Get(_plan.Value) : null;
    public bool                  IsSuperAdmin => _isSuperAdmin;

    /// <summary>
    /// Resolved module list. Priority: JWT "modules" claim → plan defaults → empty.
    /// </summary>
    public IReadOnlyList<string> Modules      => _modules;

    /// <summary>Called by TenantContextMiddleware after JWT auth.</summary>
    public void Resolve(
        Guid?    tenantId,
        string?  tenantSlug,
        string?  tenantName,
        string?  planName,
        bool     isSuperAdmin,
        string?  modulesCsv = null)
    {
        _tenantId     = tenantId;
        _tenantSlug   = tenantSlug;
        _tenantName   = tenantName;
        _isSuperAdmin = isSuperAdmin;

        if (planName is not null &&
            Enum.TryParse<PlanType>(planName, ignoreCase: true, out var plan))
        {
            _plan = plan;
        }

        // Resolve modules: JWT claim first, then plan defaults, then empty
        if (!string.IsNullOrWhiteSpace(modulesCsv))
        {
            _modules = modulesCsv
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .AsReadOnly();
        }
        else if (_plan.HasValue)
        {
            _modules = PlanDefinitions.Get(_plan.Value).Modules;
        }

        _resolved = tenantId.HasValue || isSuperAdmin;
    }
}

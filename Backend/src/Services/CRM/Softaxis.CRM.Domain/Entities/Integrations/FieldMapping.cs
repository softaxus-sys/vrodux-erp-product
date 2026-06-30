namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// Maps one source field from an external provider (e.g. Facebook "full_name") to a
/// canonical CRM lead field (e.g. "firstName"). Stored per integration so each tenant
/// can shape provider payloads to their CRM without any code change.
/// </summary>
public sealed class FieldMapping
{
    private FieldMapping() { }

    public FieldMapping(Guid integrationId, string sourceField, string targetField)
    {
        Id            = Guid.NewGuid();
        IntegrationId = integrationId;
        SourceField   = sourceField.Trim();
        TargetField   = targetField.Trim();
    }

    public Guid   Id            { get; private set; }
    public Guid   IntegrationId { get; private set; }
    public string SourceField   { get; private set; } = string.Empty;
    /// <summary>One of the canonical lead fields — see CanonicalLeadFields.</summary>
    public string TargetField   { get; private set; } = string.Empty;

    public void Update(string sourceField, string targetField)
    {
        SourceField = sourceField.Trim();
        TargetField = targetField.Trim();
    }
}

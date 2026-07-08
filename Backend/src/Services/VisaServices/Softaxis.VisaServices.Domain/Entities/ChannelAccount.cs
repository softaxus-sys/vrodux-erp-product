namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// A tenant's connection to a government submission channel (manual / UAE PASS / GDRFA /
/// ICP / MOHRE). Holds the establishment card + an account reference and an encrypted
/// secret (token/API key — stored via the secret protector, never in plaintext). One row
/// per (tenant, channel); tenant-isolated automatically.
/// </summary>
public sealed class ChannelAccount
{
    private ChannelAccount() { }

    public ChannelAccount(string channel, string? establishmentCard, string? accountRef, string? secretProtected)
    {
        Id                = Guid.NewGuid();
        Channel           = channel.Trim().ToLowerInvariant();
        EstablishmentCard = establishmentCard?.Trim();
        AccountRef        = accountRef?.Trim();
        SecretProtected   = secretProtected;
        Status            = "connected";
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    // manual | uaepass | gdrfa | icp | mohre
    public string    Channel           { get; private set; } = string.Empty;
    public string?   EstablishmentCard { get; private set; }
    public string?   AccountRef        { get; private set; }
    // Encrypted at rest (Data Protection). Never returned to the client.
    public string?   SecretProtected   { get; private set; }
    // connected | disconnected
    public string    Status            { get; private set; } = "connected";
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }

    public void Update(string? establishmentCard, string? accountRef, string? secretProtected)
    {
        EstablishmentCard = establishmentCard?.Trim();
        AccountRef        = accountRef?.Trim();
        // Only overwrite the secret when a new one is supplied (blank = keep existing).
        if (!string.IsNullOrEmpty(secretProtected)) SecretProtected = secretProtected;
        Status = "connected";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Disconnect() { Status = "disconnected"; UpdatedAt = DateTime.UtcNow; }
}

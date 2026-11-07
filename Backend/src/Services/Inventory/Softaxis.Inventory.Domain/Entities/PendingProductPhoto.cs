namespace Softaxis.Inventory.Domain.Entities;

/// <summary>
/// A picture an import file pointed at, waiting to be downloaded and attached to its stock item. Downloading
/// happens in the background, not during the import: a file can name hundreds of pictures on slow sites, and
/// the import must not wait on them or fail because one of them is down.
/// </summary>
public sealed class PendingProductPhoto
{
    public const string Pending = "pending";
    public const string Done    = "done";
    public const string Failed  = "failed";
    public const int MaxAttempts = 3;

    private PendingProductPhoto() { }

    public PendingProductPhoto(Guid productId, string url, int position)
    {
        Id            = Guid.NewGuid();
        ProductId     = productId;
        Url           = url.Trim();
        Position      = position;
        Status        = Pending;
        NextAttemptAt = DateTime.UtcNow;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      ProductId     { get; private set; }
    public string    Url           { get; private set; } = string.Empty;
    /// <summary>Order within the item's pictures in the file. The first one becomes the main photo.</summary>
    public int       Position      { get; private set; }
    public string    Status        { get; private set; } = Pending;
    /// <summary>Why it failed, in words a person can act on.</summary>
    public string?   Error         { get; private set; }
    public int       Attempts      { get; private set; }
    public DateTime  NextAttemptAt { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public void MarkDone() { Status = Done; Error = null; UpdatedAt = DateTime.UtcNow; }

    /// <summary>A retryable failure waits a little and tries again; after the last try it stays failed with the reason.</summary>
    public void MarkAttemptFailed(string error, bool retryable)
    {
        Attempts++;
        Error = error.Length > 300 ? error[..300] : error;
        if (!retryable || Attempts >= MaxAttempts) Status = Failed;
        else NextAttemptAt = DateTime.UtcNow.AddMinutes(2 * Attempts);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>"Retry failed" from the screen: gives a failed picture a fresh set of tries.</summary>
    public void Requeue() { Status = Pending; Attempts = 0; Error = null; NextAttemptAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow; }
}

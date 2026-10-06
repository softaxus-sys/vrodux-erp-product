namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// A photograph of a dish. Kept in its own table rather than on <see cref="MenuItem"/> so the menu
/// query — which every till loads — never drags image bytes across the wire; it carries ids only,
/// and each photo is fetched (and cached) on its own.
///
/// Same dual-storage shape as RealEstate's PropertyImage: bytes live in the shared bucket when
/// object storage is configured (<see cref="ObjectKey"/>), otherwise in <see cref="Data"/>. Never both.
/// </summary>
public sealed class MenuItemImage
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid MenuItemId { get; private set; }
    public byte[] Data { get; private set; } = [];
    public string? ObjectKey { get; private set; }
    public string ContentType { get; private set; } = "image/jpeg";
    public long SizeBytes { get; private set; }
    public string? FileName { get; private set; }
    public int SortOrder { get; private set; }
    /// <summary>The cover shot — the one shown on the till tile and anywhere a single image stands for the dish.</summary>
    public bool IsPrimary { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    private MenuItemImage() { }

    public MenuItemImage(Guid menuItemId, byte[] data, string contentType, string? fileName, int sortOrder)
    {
        MenuItemId = menuItemId;
        Data = data;
        ContentType = string.IsNullOrWhiteSpace(contentType) ? "image/jpeg" : contentType.Trim();
        SizeBytes = data.LongLength;
        FileName = string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim();
        SortOrder = sortOrder;
    }

    public void SetPrimary(bool primary) => IsPrimary = primary;
    public void Delete() => IsDeleted = true;

    /// <summary>Called once the bytes have landed in the bucket — clears <see cref="Data"/> so the
    /// photo is never paid for twice.</summary>
    public void SetObjectKey(string key, string contentType, long sizeBytes)
    {
        ObjectKey = key; ContentType = contentType; SizeBytes = sizeBytes; Data = [];
    }
}

namespace Softaxis.Inventory.Domain.Entities;

/// <summary>
/// One photo in a product's online gallery. Belongs to the <see cref="ProductTemplate"/>; when
/// <see cref="ProductId"/> is set it is the photo of that one variant (the red shirt), otherwise it
/// is shared by all of them.
///
/// <para>Bytes live in object storage when it is configured (<see cref="ObjectKey"/>) and in
/// <see cref="Data"/> otherwise — never both, so a photo is not paid for twice. This is the same
/// arrangement the Restaurant and Real Estate photo tables use.</para>
/// </summary>
public sealed class ProductImage
{
    private ProductImage() { }

    public ProductImage(Guid templateId, byte[] data, string contentType, string? fileName, int sortOrder, Guid? productId = null)
    {
        Id          = Guid.NewGuid();
        TemplateId  = templateId;
        ProductId   = productId;
        Data        = data;
        ContentType = string.IsNullOrWhiteSpace(contentType) ? "image/jpeg" : contentType.Trim();
        SizeBytes   = data.LongLength;
        FileName    = string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim();
        SortOrder   = sortOrder;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public Guid      TemplateId  { get; private set; }
    /// <summary>Null = shown for every variant.</summary>
    public Guid?     ProductId   { get; private set; }
    public byte[]    Data        { get; private set; } = [];
    public string?   ObjectKey   { get; private set; }
    public string    ContentType { get; private set; } = "image/jpeg";
    public long      SizeBytes   { get; private set; }
    public string?   FileName    { get; private set; }
    /// <summary>Describes the photo for screen readers and search engines.</summary>
    public string?   AltText     { get; private set; }
    public int       SortOrder   { get; private set; }
    /// <summary>The cover — the one shown on a card or list where a single photo stands for the product.</summary>
    public bool      IsPrimary   { get; private set; }
    public bool      IsDeleted   { get; private set; }
    public DateTime  CreatedAt   { get; private set; }

    public void SetPrimary(bool primary) => IsPrimary = primary;
    public void SetSortOrder(int order)  => SortOrder = order;
    public void Delete()                 => IsDeleted = true;

    public void Describe(string? altText, Guid? productId)
    {
        AltText   = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim();
        ProductId = productId;
    }

    /// <summary>Called once the bytes have landed in the bucket — clears <see cref="Data"/>.</summary>
    public void SetObjectKey(string key, string contentType, long sizeBytes)
    {
        ObjectKey = key; ContentType = contentType; SizeBytes = sizeBytes; Data = [];
    }
}

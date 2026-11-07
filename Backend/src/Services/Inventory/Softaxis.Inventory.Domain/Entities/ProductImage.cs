namespace Softaxis.Inventory.Domain.Entities;

/// <summary>
/// One photo. A photo with <see cref="ProductId"/> belongs to that stock item and stays with it for
/// life; while the item is part of an online listing, <see cref="TemplateId"/> also points at the
/// listing so the listing shows it, and it goes back to the stock item alone when the item leaves the
/// listing. A photo with no <see cref="ProductId"/> belongs to the listing and is shared by all variants.
///
/// <para>Bytes live in object storage when it is configured (<see cref="ObjectKey"/>) and in
/// <see cref="Data"/> otherwise — never both, so a photo is not paid for twice. This is the same
/// arrangement the Restaurant and Real Estate photo tables use.</para>
/// </summary>
public sealed class ProductImage
{
    private ProductImage() { }

    public ProductImage(Guid? templateId, byte[] data, string contentType, string? fileName, int sortOrder, Guid? productId = null)
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
    /// <summary>The listing showing this photo. Null = a stock-item photo not in any listing.</summary>
    public Guid?     TemplateId  { get; private set; }
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

    /// <summary>A stock item joined a listing: the listing now shows this photo too.</summary>
    public void AdoptInto(Guid templateId, int sortOrder) { TemplateId = templateId; SortOrder = sortOrder; IsPrimary = false; }

    /// <summary>The stock item left its listing: the photo stays with the item.</summary>
    public void Release() { TemplateId = null; IsPrimary = false; }

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

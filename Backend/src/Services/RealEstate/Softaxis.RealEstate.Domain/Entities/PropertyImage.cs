namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// A photograph of a property.
///
/// Stored as bytes in its own table rather than on <see cref="Property"/>, for two reasons:
/// a property carries many photos where an employee carries one avatar, and keeping them in a
/// child table means the list query can project the property columns without dragging several
/// megabytes of image data per row across the wire. No list projection may select
/// <see cref="Data"/> — that is the whole point of the separation.
///
/// Bytes, not a base64 data URI: base64 inflates by roughly a third, and these rows are the
/// largest in the schema. The API accepts a data URI from the browser (which is what a file
/// reader produces) and decodes it on the way in.
/// </summary>
public sealed class PropertyImage
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid PropertyId { get; private set; }

    public byte[] Data { get; private set; } = [];
    public string ContentType { get; private set; } = "image/jpeg";
    public string? FileName { get; private set; }
    public string? Caption { get; private set; }

    /// <summary>Display order in the gallery. The primary image is not necessarily first.</summary>
    public int SortOrder { get; private set; }

    /// <summary>The cover shot — used wherever a single image represents the property.</summary>
    public bool IsPrimary { get; private set; }

    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    private PropertyImage() { }

    public PropertyImage(Guid propertyId, byte[] data, string contentType, string? fileName, int sortOrder)
    {
        PropertyId = propertyId;
        Data = data;
        ContentType = string.IsNullOrWhiteSpace(contentType) ? "image/jpeg" : contentType.Trim();
        FileName = string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim();
        SortOrder = sortOrder;
    }

    public void SetPrimary(bool primary) => IsPrimary = primary;
    public void SetSortOrder(int order) => SortOrder = order;
    public void SetCaption(string? caption) => Caption = string.IsNullOrWhiteSpace(caption) ? null : caption.Trim();
    public void Delete() => IsDeleted = true;
}

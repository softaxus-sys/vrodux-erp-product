namespace Softaxis.BuildingBlocks.Domain.Primitives;

/// <summary>
/// Extends Entity with audit timestamps and soft-delete support.
/// </summary>
public abstract class AuditableEntity<TId> : Entity<TId>
    where TId : notnull
{
    protected AuditableEntity(TId id) : base(id) { }
    protected AuditableEntity() { }

    public DateTime CreatedAt  { get; set; }
    public string   CreatedBy  { get; set; } = "system";
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string?   DeletedBy { get; set; }
}

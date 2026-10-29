namespace Softaxis.Ecommerce.Application.Abstractions;

/// <summary>
/// Lets the owner see their store before it is opened. The public store endpoints are anonymous, but when a request also
/// carries a staff sign-in belonging to the store's own workspace (with permission to view the store), an unpublished
/// store is shown to them — and only them.
/// </summary>
public interface IShopPreview
{
    bool CanPreview(Guid storeTenantId);
}

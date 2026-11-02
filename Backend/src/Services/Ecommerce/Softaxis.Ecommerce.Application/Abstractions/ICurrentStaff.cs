namespace Softaxis.Ecommerce.Application.Abstractions;

/// <summary>The signed-in staff member behind a store-admin request, for the order timeline ("shipped by …").</summary>
public interface ICurrentStaff
{
    Guid? Id { get; }
    /// <summary>Display name; never empty.</summary>
    string Name { get; }
}

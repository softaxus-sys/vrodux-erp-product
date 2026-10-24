namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// A report or dashboard that takes the branch as a filter. For a user assigned to branches,
/// BranchQueryBehavior requires the filter to be one of their branches — leaving it empty would
/// otherwise report the whole group.
/// </summary>
public interface IBranchScopedQuery
{
    Guid? BranchId { get; }
}

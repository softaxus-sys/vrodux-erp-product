namespace Softaxis.BuildingBlocks.Domain.Pagination;

/// <summary>Wrapper for paginated response payloads — lives in Domain so repositories can use it.</summary>
public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items      { get; init; } = [];
    public int              Page       { get; init; }
    public int              PageSize   { get; init; }
    public int              TotalCount { get; init; }
    public int              TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool             HasNext    => Page < TotalPages;
    public bool             HasPrev    => Page > 1;

    public static PagedResult<T> Create(IReadOnlyList<T> items, int totalCount, int page, int pageSize) =>
        new() { Items = items, TotalCount = totalCount, Page = page, PageSize = pageSize };

    public static PagedResult<T> Empty(int page = 1, int pageSize = 20) =>
        new() { Items = [], TotalCount = 0, Page = page, PageSize = pageSize };
}

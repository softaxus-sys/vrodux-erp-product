// Re-export PagedResult from Domain for convenience
global using Softaxis.BuildingBlocks.Domain.Pagination;

namespace Softaxis.BuildingBlocks.Application.Pagination;

/// <summary>Base class for all paginated queries.</summary>
public abstract class PagedQuery
{
    private int _page = 1;
    private int _pageSize = 20;

    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > 200 ? 20 : value;
    }

    public string? Search   { get; set; }
    public string? SortBy   { get; set; }
    public bool    SortDesc { get; set; }
}

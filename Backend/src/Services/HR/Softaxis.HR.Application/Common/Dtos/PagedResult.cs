namespace Softaxis.HR.Application.Common.Dtos;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    bool HasNext,
    bool HasPrev)
{
    public static PagedResult<T> Create(IReadOnlyList<T> all, int page, int pageSize)
    {
        var total      = all.Count;
        var totalPages = (int)Math.Ceiling((double)total / pageSize);
        var items      = all.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new PagedResult<T>(items, page, pageSize, total, totalPages, page < totalPages, page > 1);
    }
}

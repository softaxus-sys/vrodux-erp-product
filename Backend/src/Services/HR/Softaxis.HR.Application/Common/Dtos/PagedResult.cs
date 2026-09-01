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
    /// <summary>
    /// Pages an already-materialised list. Only correct where the whole set was going to be read
    /// anyway — it does not save the database any work. Prefer the overload below.
    /// </summary>
    public static PagedResult<T> Create(IReadOnlyList<T> all, int page, int pageSize)
    {
        var total      = all.Count;
        var totalPages = (int)Math.Ceiling((double)total / pageSize);
        var items      = all.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new PagedResult<T>(items, page, pageSize, total, totalPages, page < totalPages, page > 1);
    }

    /// <summary>
    /// Wraps one page that was read with Skip/Take in SQL, alongside a separately-counted total.
    /// This is the form that actually keeps the query bounded.
    /// </summary>
    public static PagedResult<T> Create(IReadOnlyList<T> pageItems, int total, int page, int pageSize)
    {
        var totalPages = (int)Math.Ceiling((double)total / pageSize);
        return new PagedResult<T>(pageItems, page, pageSize, total, totalPages, page < totalPages, page > 1);
    }
}

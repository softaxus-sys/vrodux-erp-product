using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Queries;

/// <summary>
/// GET /api/restaurant/orders?status=&amp;page=&amp;pageSize=
///
/// <para>Pages in SQL. A restaurant produces orders every day and never deletes them, so this list
/// grows without bound — and each row is loaded with its items and their modifiers, so the cost per
/// row is not small either. Reading the whole history to render a screen stops working within weeks
/// of go-live.</para>
/// </summary>
/// <param name="Status">
/// A single status, or <c>"open"</c> for everything still live — that is, not paid and not
/// cancelled. The floor plan wants exactly that set and nothing else: it needs the order currently
/// sitting on each table, which is bounded by the number of tables, not by trading history.
/// </param>
public sealed record GetOrdersQuery(
    string? Status,
    int Page     = 1,
    int PageSize = 30) : IQuery<PagedResult<OrderDto>>;

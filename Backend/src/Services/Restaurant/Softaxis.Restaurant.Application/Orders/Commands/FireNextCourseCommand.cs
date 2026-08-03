using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>PATCH /api/restaurant/orders/{id}/fire-next-course — releases the next course's items
/// to the kitchen queue (bumps Order.CurrentCourse; the KDS ticket query filters on it).</summary>
public sealed record FireNextCourseCommand(Guid OrderId) : ICommand<OrderDto>;

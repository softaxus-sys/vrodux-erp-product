namespace Softaxis.Restaurant.Application.Kitchen.Dtos;

public sealed record KitchenTicketItemDto(
    Guid Id, string ItemName, int Quantity, string? Modifiers, string Status,
    int CourseNumber, Guid? ComboOrderItemId, Guid? KitchenStationId);

public sealed record KitchenTicketDto(
    Guid Id,
    string OrderNumber,
    string TableNumber,
    string Waiter,
    int Covers,
    string Status,
    DateTime CreatedAt,
    int WaitMinutes,
    int CurrentCourse,
    IReadOnlyList<KitchenTicketItemDto> Items);

public sealed record KitchenSummaryDto(
    int ActiveOrders,
    int SentToKitchen,
    int Ready,
    int PendingItems,
    int PreparingItems);

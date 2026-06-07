namespace Softaxis.Identity.Application.DTOs;

public sealed record BranchDto(
    Guid      Id,
    string    Code,
    string    Name,
    string    Type,
    string    City,
    string    Country,
    string    Flag,
    string?   Address,
    string?   Phone,
    string?   Email,
    string?   Manager,
    int       Staff,
    string    Status,
    string    Currency,
    string    Timezone,
    string?   OpenedDate,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

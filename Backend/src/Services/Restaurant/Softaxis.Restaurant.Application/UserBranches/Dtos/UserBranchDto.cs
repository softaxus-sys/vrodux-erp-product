namespace Softaxis.Restaurant.Application.UserBranches.Dtos;

public sealed record UserBranchDto(Guid Id, Guid UserId, string UserName, Guid BranchId, string Role, DateTime CreatedAt);

using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.GrantSelfService;

/// <summary>
/// Gives an existing login the tenant's "Employee (Self-Service)" role, so someone who already
/// signs in for another reason can also reach their own HR record — profile, leave, attendance
/// and payslips.
/// </summary>
/// <remarks>
/// Purely additive: it assigns one extra role and never removes or replaces what the user already
/// has. Their existing access is unchanged.
/// </remarks>
public sealed record GrantSelfServiceCommand(Guid UserId) : ICommand;

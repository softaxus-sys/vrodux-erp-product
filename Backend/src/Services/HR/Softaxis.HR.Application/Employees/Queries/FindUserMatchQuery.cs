using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Employees.Dtos;

namespace Softaxis.HR.Application.Employees.Queries;

/// <summary>
/// Looks for a login that might be the same person as the employee being created or edited.
/// Returns a <b>suggestion</b> for a human to confirm — the caller never links automatically.
/// </summary>
public sealed record FindUserMatchQuery(string Email) : IQuery<UserMatchDto?>;

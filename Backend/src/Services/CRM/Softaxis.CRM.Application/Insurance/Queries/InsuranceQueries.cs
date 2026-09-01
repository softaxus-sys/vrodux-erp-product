using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Insurance.Dtos;

namespace Softaxis.CRM.Application.Insurance.Queries;

public sealed record GetInsuranceSummaryQuery : IQuery<InsuranceSummaryDto>;

public sealed record GetPoliciesQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<PolicyDto>>;

public sealed record GetRenewalsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<PolicyRenewalDto>>;

public sealed record GetClaimsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<InsuranceClaimDto>>;

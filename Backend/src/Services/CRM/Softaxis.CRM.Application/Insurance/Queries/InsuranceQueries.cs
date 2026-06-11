using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Insurance.Dtos;

namespace Softaxis.CRM.Application.Insurance.Queries;

public sealed record GetInsuranceSummaryQuery : IQuery<InsuranceSummaryDto>;

public sealed record GetPoliciesQuery : IQuery<IReadOnlyList<PolicyDto>>;

public sealed record GetRenewalsQuery : IQuery<IReadOnlyList<PolicyRenewalDto>>;

public sealed record GetClaimsQuery : IQuery<IReadOnlyList<InsuranceClaimDto>>;

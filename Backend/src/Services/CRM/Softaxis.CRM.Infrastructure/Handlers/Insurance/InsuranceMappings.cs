using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal static class InsuranceMappings
{
    public static PolicyDto ToDto(Policy p) => new(
        p.Id, p.PolicyNumber, p.LeadId, p.DealId, p.CustomerId, p.HolderName, p.ProductType,
        p.Premium, p.SumInsured, p.StartDate, p.EndDate, p.Status, p.Agent, p.Notes, p.CreatedAt);

    public static PolicyRenewalDto ToDto(PolicyRenewal x) => new(
        x.Id, x.PolicyId, x.PolicyNumber, x.HolderName, x.RenewalDate, x.NewPremium, x.Status, x.Notes, x.CreatedAt);

    public static InsuranceClaimDto ToDto(InsuranceClaim c) => new(
        c.Id, c.ClaimNumber, c.PolicyId, c.PolicyNumber, c.CustomerId, c.HolderName, c.ClaimDate,
        c.ClaimAmount, c.ApprovedAmount, c.Status, c.Reason, c.Notes, c.CreatedAt);
}

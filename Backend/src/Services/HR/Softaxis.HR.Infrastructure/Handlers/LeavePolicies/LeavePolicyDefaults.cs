using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.LeavePolicies;

/// <summary>
/// Starting entitlements seeded the first time a tenant reads its leave policies
/// (UAE Labour Law baseline). A tenant edits these afterwards — they are a starting
/// point, not a constraint, and are never re-applied over an edited policy.
/// </summary>
internal static class LeavePolicyDefaults
{
    public static IEnumerable<LeavePolicy> Build() =>
    [
        new("annual",    30, true,  "30 calendar days after one year of service."),
        new("sick",      15, true,  "Paid sick leave; UAE law allows further unpaid/part-paid days."),
        new("maternity", 60, true,  "45 days full pay + 15 days half pay."),
        new("paternity",  5, true,  "5 working days within 6 months of birth."),
        new("emergency",  5, true,  "Compassionate / emergency leave."),
        new("hajj",      30, false, "Once during service, unpaid."),
        new("study",     10, true,  "For enrolled employees sitting exams."),
        new("unpaid",     0, false, "No entitlement — approved case by case."),
    ];
}

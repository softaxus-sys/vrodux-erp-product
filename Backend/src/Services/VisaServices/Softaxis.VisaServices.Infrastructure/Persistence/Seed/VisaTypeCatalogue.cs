using Softaxis.VisaServices.Domain.Entities;

namespace Softaxis.VisaServices.Infrastructure.Persistence.Seed;

/// <summary>
/// Default UAE visa-type catalogue. VisaType is now tenant-owned, so these are seeded
/// lazily into a tenant the first time it opens the module (each tenant gets its own
/// editable copy). Returns fresh instances on every call.
/// </summary>
public static class VisaTypeCatalogue
{
    public static IReadOnlyList<VisaType> BuildDefaults()
    {
        string[] personal    = ["Passport copy", "Passport photo (white background)"];
        string[] entryCommon = [.. personal, "Entry permit application form"];

        return
        [
            new("employment-new", "Employment Visa — New", "employment", "manual", 3000m, 1500m, 14,
                [.. personal, "Attested degree certificate", "Employment contract / offer letter",
                 "Company establishment card copy", "Medical fitness certificate", "Emirates ID application"]),
            new("employment-renewal", "Employment Visa — Renewal", "employment", "manual", 2500m, 1200m, 10,
                [.. personal, "Current visa copy", "Employment contract", "Medical fitness certificate",
                 "Emirates ID renewal application"]),
            new("employment-cancellation", "Employment Visa — Cancellation", "employment", "manual", 500m, 500m, 5,
                [.. personal, "Current visa copy", "Cancellation form signed by sponsor"]),
            new("family-residence", "Family Residence Visa", "family", "manual", 2500m, 1500m, 14,
                [.. entryCommon, "Attested marriage certificate", "Attested birth certificate (children)",
                 "Sponsor salary certificate", "Ejari / tenancy contract", "Medical fitness certificate (18+)"]),
            new("visit-30", "Visit Visa — 30 Days", "visit", "manual", 350m, 250m, 3,
                [.. entryCommon, "Return ticket copy"]),
            new("visit-60", "Visit Visa — 60 Days", "visit", "manual", 600m, 300m, 3,
                [.. entryCommon, "Return ticket copy"]),
            new("golden-10yr", "Golden Visa — 10 Years", "golden", "manual", 4750m, 5000m, 30,
                [.. personal, "Eligibility evidence (investment / talent / degree)",
                 "Bank statements (6 months)", "Medical fitness certificate", "Health insurance"]),
            new("freelance-permit", "Freelance Visa & Permit", "freelance", "manual", 7500m, 2500m, 21,
                [.. personal, "CV / portfolio", "Bank statement", "Qualification certificates"]),
            new("student-residence", "Student Residence Visa", "student", "manual", 1800m, 1000m, 14,
                [.. entryCommon, "University admission letter", "Tuition payment proof",
                 "Medical fitness certificate"]),
        ];
    }
}

using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence.Seed;

public static class CrmSeedData
{
    public static async Task SeedAsync(CrmDbContext db)
    {
        await SeedLeadsAsync(db);
        await SeedCustomersAsync(db);
        await SeedDealsAsync(db);
        await db.SaveChangesAsync();
        await SeedActivitiesAsync(db);
        await db.SaveChangesAsync();
    }

    private static async Task SeedActivitiesAsync(CrmDbContext db)
    {
        if (await db.Activities.IgnoreQueryFilters().AnyAsync()) return;

        var lead     = await db.Leads.AsNoTracking().OrderBy(x => x.CreatedAt).FirstOrDefaultAsync();
        var deal     = await db.Deals.AsNoTracking().OrderBy(x => x.CreatedAt).FirstOrDefaultAsync();
        var customer = await db.Customers.AsNoTracking().OrderBy(x => x.CreatedAt).FirstOrDefaultAsync();

        var today    = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var tomorrow = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");
        var yesterday= DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd");

        if (lead is not null)
        {
            db.Activities.Add(new Activity("note", "Lead captured from website form", "Requested a product demo for Q3.", "lead", lead.Id, lead.FullName, null, lead.AssignedTo));
            db.Activities.Add(new Activity("call", "Discovery call", "Discuss requirements and budget.", "lead", lead.Id, lead.FullName, today, lead.AssignedTo));
            db.Activities.Add(new Activity("task", "Send proposal follow-up", null, "lead", lead.Id, lead.FullName, yesterday, lead.AssignedTo)); // overdue
        }
        if (deal is not null)
        {
            db.Activities.Add(new Activity("meeting", "Solution walkthrough with stakeholders", "Present scope and timeline.", "deal", deal.Id, deal.Title, tomorrow, deal.AssignedTo));
            db.Activities.Add(new Activity("email", "Sent pricing summary", null, "deal", deal.Id, deal.Title, null, deal.AssignedTo));
        }
        if (customer is not null)
        {
            db.Activities.Add(new Activity("task", "Quarterly business review", "Review usage and renewal.", "customer", customer.Id, customer.Name, tomorrow, customer.AccountManager));
        }
    }

    private static async Task SeedLeadsAsync(CrmDbContext db)
    {
        if (await db.Leads.IgnoreQueryFilters().AnyAsync()) return;
        var leads = new[]
        {
            (new Guid("e1000001-0000-0000-0000-000000000001"), "Ahmed",   "Al-Rashid",  "CTO",     "Emirates Steel",     "Manufacturing", "a.rashid@emsteel.ae",   "+971-50-1234567", "UAE",  "Dubai",      "linkedin",       "qualified", "high",   85_000m),
            (new Guid("e1000001-0000-0000-0000-000000000002"), "Fatima",  "Hassan",     "CFO",     "Al Habtoor Group",   "Construction",  "f.hassan@habtoor.ae",   "+971-55-2345678", "UAE",  "Abu Dhabi",  "referral",       "new",       "medium", 120_000m),
            (new Guid("e1000001-0000-0000-0000-000000000003"), "Omar",    "Abdullah",   "CEO",     "Gulf Logistics",     "Logistics",     "o.abdullah@gulflog.ae", "+971-56-3456789", "UAE",  "Sharjah",    "cold_call",      "contacted", "medium", 45_000m),
            (new Guid("e1000001-0000-0000-0000-000000000004"), "Sarah",   "Mitchell",   "VP IT",   "DEWA",               "Utilities",     "s.mitchell@dewa.gov.ae","+971-4-1234567",  "UAE",  "Dubai",      "website",        "qualified", "high",   200_000m),
            (new Guid("e1000001-0000-0000-0000-000000000005"), "Khalid",  "Al-Mansoori","Director","Abu Dhabi Fund",     "Finance",       "k.mansoori@adf.ae",     "+971-2-9876543",  "UAE",  "Abu Dhabi",  "trade_show",     "new",       "high",   350_000m),
        };
        foreach (var (id, fn, ln, title, co, ind, email, phone, country, city, src, status, pri, val) in leads)
        {
            var l = new Lead(fn, ln, title, co, ind, email, phone, country, city, src, pri, val, "Tariq Khalil", null);
            SetId(l, id); l.UpdateStatus(status);
            db.Leads.Add(l);
        }
    }

    private static async Task SeedCustomersAsync(CrmDbContext db)
    {
        if (await db.Customers.IgnoreQueryFilters().AnyAsync()) return;
        var customers = new[]
        {
            (new Guid("e2000002-0000-0000-0000-000000000001"), "Emirates NBD",      "Banking",      "UAE", "Dubai",     "active",   "platinum", "Tariq Khalil",   2_850_000m, 3),
            (new Guid("e2000002-0000-0000-0000-000000000002"), "Majid Al Futtaim",  "Retail",       "UAE", "Dubai",     "active",   "gold",     "Maya Patel",     1_420_000m, 2),
            (new Guid("e2000002-0000-0000-0000-000000000003"), "ADNOC",             "Energy",       "UAE", "Abu Dhabi", "active",   "platinum", "Hassan Younis",  3_200_000m, 1),
            (new Guid("e2000002-0000-0000-0000-000000000004"), "Etisalat",          "Telecom",      "UAE", "Dubai",     "active",   "gold",     "Fatima Hassan",    680_000m, 1),
            (new Guid("e2000002-0000-0000-0000-000000000005"), "Dubai Properties",  "Real Estate",  "UAE", "Dubai",     "active",   "silver",   "Omar Abdullah",    450_000m, 2),
        };
        foreach (var (id, name, ind, country, city, status, tier, mgr, rev, openDeals) in customers)
        {
            var c = new CrmCustomer(name, ind, country, city, "N/A", "+971-4-0000000", $"info@{name.ToLower().Replace(" ","")}.ae", tier, mgr, $"{name} is a key enterprise client.");
            SetId(c, id); c.UpdateRevenue(rev);
            db.Customers.Add(c);
        }
    }

    private static async Task SeedDealsAsync(CrmDbContext db)
    {
        if (await db.Deals.IgnoreQueryFilters().AnyAsync()) return;
        var deals = new[]
        {
            (new Guid("e3000003-0000-0000-0000-000000000001"), "Emirates NBD ERP Expansion",  "Emirates NBD",     580_000m, "negotiation", "high",   75, "2026-06-30", "Tariq Khalil", "referral",   "Banking"),
            (new Guid("e3000003-0000-0000-0000-000000000002"), "MAF POS Rollout Phase 2",     "Majid Al Futtaim", 320_000m, "proposal",    "high",   60, "2026-07-15", "Maya Patel",   "linkedin",   "Retail"),
            (new Guid("e3000003-0000-0000-0000-000000000003"), "ADNOC Field Mobility",        "ADNOC",            750_000m, "qualified",   "medium", 40, "2026-08-31", "Hassan Younis","trade_show", "Energy"),
            (new Guid("e3000003-0000-0000-0000-000000000004"), "Etisalat CRM Module",         "Etisalat",         180_000m, "won",         "medium", 100,"2026-05-01", "Fatima Hassan","website",    "Telecom"),
            (new Guid("e3000003-0000-0000-0000-000000000005"), "Dubai Properties RE Module",  "Dubai Properties", 420_000m, "lead",        "low",    20, "2026-09-30", "Omar Abdullah","cold_call",  "Real Estate"),
        };
        foreach (var (id, title, co, val, stage, pri, prob, closeDate, assignedTo, src, ind) in deals)
        {
            var d = new Deal(title, co, val, stage, pri, prob, closeDate, assignedTo, src, ind, $"Strategic deal with {co}.");
            SetId(d, id);
            db.Deals.Add(d);
        }
    }

    private static void SetId(object e, Guid id) =>
        e.GetType().GetProperty("Id")!.SetValue(e, id);
}

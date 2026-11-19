using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Workflow.Application;
using Softaxis.Workflow.Domain.Entities;
using Softaxis.Workflow.Infrastructure.Persistence;
using Softaxis.Workflow.Infrastructure.Services;

namespace Softaxis.Workflow.Infrastructure.Handlers;

/// <summary>
/// A starter pack is a ready-made set of locations, positions, forms, approval chains and repository
/// document types. Installing one never overwrites anything: everything it adds is matched by key or
/// name first, so running it twice (or on top of your own setup) adds only what is missing.
/// </summary>
internal static class StarterPackCatalogue
{
    public const string MultiSite = "multi_site_ops";

    public static readonly IReadOnlyList<StarterPackDto> All =
    [
        new(MultiSite, "Multi-site operations (hospitality)",
            "Locations, ten operational request forms (asset transfer, property release, vendor comparison, petty cash, refunds, comps and more), " +
            "the standard Property → Finance → Manager → HQ approval chains, and the daily and monthly reconciliation document types."),
    ];

    private static readonly JsonSerializerOptions Out = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    private static string J(params FieldDef[] f) => JsonSerializer.Serialize(f, Out);

    private static FieldDef Text(string k, string l, bool req = false, string? help = null, ShowIfDef? show = null, bool title = false) =>
        new(k, l, "text", req, null, help, false, title, show);
    private static FieldDef Area(string k, string l, bool req = false, string? help = null, ShowIfDef? show = null) =>
        new(k, l, "textarea", req, null, help, false, false, show);
    private static FieldDef Date(string k, string l, bool req = false, ShowIfDef? show = null) => new(k, l, "date", req, null, null, false, false, show);
    private static FieldDef Money(string k, string l, bool req = false, bool amount = false, string? help = null, ShowIfDef? show = null) =>
        new(k, l, "money", req, null, help, amount, false, show);
    private static FieldDef Pick(string k, string l, string[] opts, bool req = true, ShowIfDef? show = null) => new(k, l, "select", req, opts, null, false, false, show);
    private static FieldDef Files(string k, string l, bool req = false, string? help = null) => new(k, l, "attachment", req, null, help);
    private static FieldDef Check(string k, string l) => new(k, l, "checkbox");
    private static FieldDef Table(string k, string l, bool req, params ColumnDef[] cols) => new(k, l, "lines", req, null, null, false, false, null, cols);
    private static ColumnDef Col(string k, string l, string t = "text", bool req = false, string[]? opts = null, string[]? product = null, bool amount = false) =>
        new(k, l, t, req, opts, product, amount);
    private static ShowIfDef If(string field, params string[] values) => new(field, values);

    private sealed record FormSpec(string Key, string Name, string Description, string Category, string Icon, string Fields, string[] Chain);

    private const string Dept = "Primary Department User", PM = "Property Manager", PF = "Property Finance", HQ = "HQ Finance", Sec = "Security";

    private static readonly string[] StandardChain = [Dept, PF, PM, HQ];

    private static readonly FormSpec[] Forms =
    [
        new("asset-transfer", "Asset Transfers / Disposals", "Record the 'from' and 'to' of an asset transfer or disposal, with the asset tag and pictures.", "Assets", "package",
            J(Pick("transferType", "Type", ["Transfer", "Disposal"]),
              Text("fromLocation", "From (location / department)", true),
              Text("toLocation", "To (location / department)", true, null, If("transferType", "Transfer")),
              Pick("disposalMethod", "Disposal method", ["Sale", "Scrap", "Donation", "Write-off", "Return to vendor"], true, If("transferType", "Disposal")),
              Table("assets", "Assets", true, Col("assetTag", "Asset tag", "text", true), Col("description", "Description", "text", true),
                  Col("quantity", "Qty", "number", true), Col("condition", "Condition", "select", false, ["New", "Good", "Fair", "Poor", "Damaged"]),
                  Col("bookValue", "Book value", "money")),
              Area("reason", "Reason", true),
              Files("photos", "Pictures of the asset(s)", false, "Attach a photo of each asset where applicable.")),
            [PM, PF, HQ]),

        new("property-release", "Property Release Form", "Keep a record of company property taken out of the premises.", "Assets", "log-out",
            J(Text("takenBy", "Taken out by", true, null, null, true), Date("releaseDate", "Date of release", true), Date("expectedReturn", "Expected return date"),
              Text("destination", "Destination"), Area("purpose", "Purpose", true),
              Table("items", "Items", true, Col("description", "Description", "text", true), Col("quantity", "Qty", "number", true), Col("tag", "Asset tag / serial no.")),
              Files("photos", "Photos (optional)")),
            [Dept, PF, PM, Sec]),

        new("vendor-comparison", "Technical / Commercial Comparison", "Compare vendors with supporting documents, so the procurement policy is followed.", "Procurement", "scale",
            J(Text("subject", "What is being purchased", true, null, null, true), Area("scope", "Scope / specification", true),
              Money("budget", "Approved budget"),
              Table("vendors", "Vendors compared", true, Col("vendor", "Vendor", "text", true), Col("amount", "Quoted amount", "money", true),
                  Col("delivery", "Delivery / lead time"), Col("terms", "Payment terms"), Col("compliant", "Meets specification", "select", true, ["Yes", "Partly", "No"])),
              Text("recommended", "Recommended vendor", true), Money("recommendedAmount", "Recommended amount", true, true),
              Area("justification", "Justification", true, "Why this vendor, and why not the others."),
              Files("quotations", "Quotations and supporting documents", true, "Attach each vendor's quotation.")),
            [PM, PF, HQ]),

        new("petty-cash", "Petty Cash Reimbursement and IOU", "Keep petty cash fully digital so accruals are possible by month-end.", "Finance", "wallet",
            J(Pick("requestType", "Type", ["Reimbursement", "IOU / advance"]), Text("payee", "Paid to / advanced to", true, null, null, true),
              Table("expenses", "Expenses", true, Col("date", "Date", "date", true), Col("description", "Description", "text", true),
                  Col("category", "Category", "select", false, ["Supplies", "Transport", "Meals", "Maintenance", "Fuel", "Other"]), Col("amount", "Amount", "money", true, null, null, true)),
              Date("settleBy", "Expected settlement date", false, If("requestType", "IOU / advance")),
              Files("receipts", "Receipts", false, "Required for reimbursements."),
              Area("notes", "Notes")),
            StandardChain),

        new("pos-menu-item", "POS / Menu Icon Creation", "Make sure prices and cost mapping are reviewed before an item is set up in the POS.", "Operations", "utensils",
            J(Text("outlet", "Outlet", true), Text("itemName", "Item name", true, null, null, true), Text("category", "Menu category", true),
              Money("sellingPrice", "Selling price", true), Money("costPrice", "Cost price", true),
              Pick("tax", "Tax treatment", ["Standard", "Zero-rated", "Exempt"]), Area("costMapping", "Cost / recipe mapping", true, "Which stock items and quantities make up this item."),
              Date("effectiveFrom", "Effective from", true), Files("image", "Item image / icon")),
            StandardChain),

        new("internal-transfer", "Internal Transfers", "Record inventory (beverage, food, linen, equipment, chemicals…) moving between business units, valued at WACC.", "Inventory", "repeat",
            J(Text("fromUnit", "From business unit", true), Text("toUnit", "To business unit", true), Date("transferDate", "Transfer date", true),
              Table("items", "Items", true, Col("item", "Item", "text", true),
                  Col("category", "Category", "select", true, ["Beverage", "Food", "Linen", "Equipment", "Chemicals", "Other"]),
                  Col("uom", "Unit"), Col("qty", "Qty", "number", true), Col("unitCost", "Unit cost (WACC)", "money", true),
                  Col("value", "Value", "money", false, null, ["qty", "unitCost"], true)),
              Area("reason", "Reason / notes")),
            StandardChain),

        new("refund", "Refund Requests", "Record every cash and refund request, with a revenue or deposit reversal, visible to all the departments involved.", "Finance", "undo",
            J(Pick("refundType", "Refund type", ["Cash refund", "Card refund", "Bank transfer"]), Pick("reversal", "Combined with", ["Revenue reversal", "Deposit reversal"]),
              Text("guest", "Guest / customer name", true, null, null, true), Text("reference", "Reservation / folio / receipt no.", true),
              Money("originalAmount", "Original amount"), Money("refundAmount", "Refund amount", true, true),
              Area("reason", "Reason for the refund", true), Files("support", "Supporting documents")),
            StandardChain),

        new("comp", "Comp Form", "Get complimentary meals, access or activities approved in advance — or afterwards, for exceptions only.", "Operations", "gift",
            J(Pick("compType", "What is being comped", ["Meal", "Accommodation", "Activity / access", "Other"]), Text("recipient", "Guest / recipient", true, null, null, true),
              Date("date", "Date", true), Money("value", "Estimated value", true, true), Area("reason", "Reason", true),
              Pick("timing", "Approved", ["In advance", "After the fact (exception)"]),
              Area("exception", "Why was it not approved in advance?", true, null, If("timing", "After the fact (exception)"))),
            StandardChain),

        new("equipment-it", "Equipment and IT Hardware Request", "Make sure purchases go through department heads before they reach procurement.", "Procurement", "monitor",
            J(Text("subject", "What is needed", true, null, null, true),
              Table("items", "Items", true, Col("description", "Description", "text", true), Col("qty", "Qty", "number", true), Col("unitCost", "Estimated unit cost", "money", true),
                  Col("total", "Estimated total", "money", false, null, ["qty", "unitCost"], true)),
              Area("justification", "Business justification", true), Date("neededBy", "Needed by"), Files("quotes", "Quotations (if any)")),
            StandardChain),

        new("contracted-labor", "Contracted Labor Request", "Prevent contracted labor being procured without prior approval. Every invoice must be submitted with the approved form.", "Procurement", "users",
            J(Text("agency", "Agency / contractor", true, null, null, true), Text("role", "Role or service", true), Text("headcount", "Number of people", true),
              Date("start", "Start date", true), Date("end", "End date", true),
              Pick("rateUnit", "Rate per", ["Hour", "Day", "Month", "Fixed fee"]), Money("rate", "Rate", true), Money("estimatedCost", "Estimated total cost", true, true),
              Area("scope", "Scope of work", true), Area("justification", "Why is contracted labor needed?", true)),
            StandardChain),
    ];

    private static readonly (string Name, string Frequency, string Description)[] DocTypes =
    [
        ("Daily Revenue Reconciliation", DocFrequency.Daily, "Confirms all revenue is interfaced correctly."),
        ("Cash and CC Over/Short Reconciliation", DocFrequency.Daily, "Confirms cash and credit cards balance for the day."),
        ("Voids, Discount and Comp Reconciliation", DocFrequency.Daily, "Confirms all transactions are accounted for in the restaurant and the adventure park."),
        ("TDF / Green Tax Daily Reconciliation", DocFrequency.Daily, "Confirms the tax component is recorded properly."),
        ("Inventory Variances, Sales Mix and Non-Moving Inventory", DocFrequency.Monthly, "Explains inventory variances against sales mix, and flags stock that is not moving."),
        ("Bank Reconciliations", DocFrequency.Monthly, "Reconciles bank balances."),
        ("Aging with Explanations (AR/AP)", DocFrequency.Monthly, "Receivables and payables aging, each with an explanation."),
        ("Financial Variance Analysis", DocFrequency.Monthly, "Heads of department give reasons for variances and an action plan for the next month."),
    ];

    private static readonly string[] Positions = [Dept, PM, PF, HQ, Sec];
    private static readonly (string Name, string Code, string Country)[] Bases = [("Kingdom of Saudi Arabia", "KSA", "Saudi Arabia"), ("Oman", "OMN", "Oman"), ("United Arab Emirates", "UAE", "United Arab Emirates")];
    private static readonly string[] Units = ["Accommodation", "Food & Beverage", "Adventure & Activities", "Wellness", "Engineering & Maintenance", "Finance", "Human Resources", "Sales & Marketing"];

    public static async Task<(int Forms, int Added)> InstallAsync(WorkflowDbContext db, string key, CancellationToken ct)
    {
        var added = 0;
        if (key != MultiSite) return (0, 0);

        foreach (var (name, code, country) in Bases)
            if (!await db.Bases.AnyAsync(b => b.Code == code && !b.IsDeleted, ct))
            { var b = new WfBase(code, name); b.Update(code, name, country, added, true); db.Bases.Add(b); added++; }
        var order = 0;
        foreach (var u in Units)
        {
            order++;
            if (!await db.Units.AnyAsync(x => x.Name == u && !x.IsDeleted, ct)) { var n = new WfUnit(u); n.Update(u, null, order, true); db.Units.Add(n); added++; }
        }
        var positions = new Dictionary<string, WfPosition>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in Positions)
        {
            var ex = await db.Positions.FirstOrDefaultAsync(x => x.Name == p && !x.IsDeleted, ct);
            if (ex is null) { ex = new WfPosition(p); db.Positions.Add(ex); added++; }
            positions[p] = ex;
        }
        order = 0;
        foreach (var f in Forms)
        {
            order++;
            var form = await db.Forms.FirstOrDefaultAsync(x => x.Key == f.Key && !x.IsDeleted, ct);
            if (form is not null) continue;
            form = new WfForm(f.Key, f.Name);
            form.Update(f.Name, f.Description, f.Category, f.Icon, f.Fields, order, true);
            form.SetBuiltIn();
            db.Forms.Add(form); added++;
            var flow = new WfFlow(form.Id, null, null);
            db.Flows.Add(flow);
            var n = 1;
            foreach (var step in f.Chain)
                db.FlowSteps.Add(new WfFlowStep(flow.Id, n++, StepKind.Approve, positions[step].Id, null, null));
        }
        order = 0;
        foreach (var (name, freq, desc) in DocTypes)
        {
            order++;
            if (await db.DocTypes.AnyAsync(d => d.Name == name && !d.IsDeleted, ct)) continue;
            var d = new WfDocType(name, freq); d.Update(name, freq, desc, order, true); db.DocTypes.Add(d); added++;
        }
        return (Forms.Length, added);
    }
}

internal sealed class GetStarterPackStatusHandler(WorkflowDbContext db) : IQueryHandler<GetStarterPackStatusQuery, StarterPackStatusDto>
{
    public async Task<Result<StarterPackStatusDto>> Handle(GetStarterPackStatusQuery q, CancellationToken ct) =>
        Result.Success(new StarterPackStatusDto((await Wf.SettingsAsync(db, ct)).StarterPack, StarterPackCatalogue.All));
}

internal sealed class InstallStarterPackHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<InstallStarterPackCommand, StarterPackStatusDto>
{
    public async Task<Result<StarterPackStatusDto>> Handle(InstallStarterPackCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<StarterPackStatusDto>(access) is { } no) return no;
        if (StarterPackCatalogue.All.All(p => p.Key != c.Key)) return Result.Failure<StarterPackStatusDto>(Wf.NotFound("Starter pack"));
        var (forms, added) = await StarterPackCatalogue.InstallAsync(db, c.Key, ct);
        var s = await Wf.SettingsAsync(db, ct);
        s.MarkStarterPack(c.Key);
        Wf.Log(db, user, "starterpack.installed", "settings", s.Id, null, $"{c.Key}: {added} items added ({forms} forms in the pack)");
        await db.SaveChangesAsync(ct);
        return Result.Success(new StarterPackStatusDto(c.Key, StarterPackCatalogue.All));
    }
}

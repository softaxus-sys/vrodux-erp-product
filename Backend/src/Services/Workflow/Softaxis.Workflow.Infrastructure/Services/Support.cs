using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Workflow.Application;
using Softaxis.Workflow.Domain.Entities;
using Softaxis.Workflow.Infrastructure.Persistence;

namespace Softaxis.Workflow.Infrastructure.Services;

/// <summary>Shared helpers: errors, dates, audit, request numbers.</summary>
internal static class Wf
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    public static Error NotFound(string what) => Error.Custom($"{what}.NotFound", $"{what} was not found.");
    public static Error Conflict(string what, string text) => Error.Custom($"{what}.Conflict", text);
    public static Error Invalid(string text) => Error.Custom("Validation.Failed", text);
    public static Error Forbidden(string text) => Error.Custom("Access.Forbidden", text);

    public static bool ValidDate(string? s) =>
        DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    public static async Task<WfSettings> SettingsAsync(WorkflowDbContext db, CancellationToken ct)
    {
        var s = await db.Settings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = WfSettings.CreateDefault();
        db.Settings.Add(s);
        await db.SaveChangesAsync(ct);
        return s;
    }

    public static TimeZoneInfo Zone(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch { return TimeZoneInfo.Utc; }
    }

    /// <summary>A UTC instant as the workspace's own clock reads it, for decision PDFs.</summary>
    public static string Local(DateTime utc, string tz)
    {
        var z = Zone(tz);
        var utcStamp = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utcStamp, z);
        var off = z.GetUtcOffset(utcStamp);
        var sign = off < TimeSpan.Zero ? "-" : "+";
        return $"{local:dd MMM yyyy, HH:mm} (UTC{sign}{Math.Abs(off.Hours):00}:{Math.Abs(off.Minutes):00})";
    }

    public static string NewNumber(string prefix) =>
        $"{prefix}-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";

    /// <summary>
    /// Adds one line to the audit trail. Callers save together with the change itself, so the trail and
    /// the change commit or fail as one.
    /// </summary>
    public static void Log(WorkflowDbContext db, ICurrentUser u, string action, string entityType, Guid? entityId,
        Guid? requestId = null, string? detail = null)
    {
        if (detail is { Length: > 1900 }) detail = detail[..1900];
        db.Audit.Add(new WfAudit(u.Id, u.Name, action, entityType, entityId, requestId, detail, u.Ip));
    }

    public static string Sanitise(string name)
    {
        var bad = Path.GetInvalidFileNameChars();
        var s = new string(name.Select(c => bad.Contains(c) ? '-' : c).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(s) ? "file" : s;
    }

    public const int MaxFileBytes = 10 * 1024 * 1024;
}

/// <summary>Who the caller is allowed to be in this module.</summary>
internal sealed class WfAccess(WorkflowDbContext db, ICurrentUser user)
{
    public Guid UserId => user.Id ?? Guid.Empty;
    public bool IsAdmin => user.IsSuperAdmin || user.HasPermission(WfPerm.AdminEdit);
    /// <summary>Sees every request in the workspace: admins, auditors and the people who may reassign approvals.</summary>
    public bool SeesAll => IsAdmin || user.HasPermission(WfPerm.AuditView) || user.HasPermission(WfPerm.Reassign);
    public bool CanReassign => user.IsSuperAdmin || user.HasPermission(WfPerm.Reassign) || user.HasPermission(WfPerm.AdminEdit);

    private HashSet<Guid>? _allowed;
    private bool _loaded;

    /// <summary>The Bases this person may use, or null for "all" (admins).</summary>
    public async Task<HashSet<Guid>?> AllowedBaseIdsAsync(CancellationToken ct)
    {
        if (IsAdmin) return null;
        if (_loaded) return _allowed;
        var me = UserId;
        _allowed = (await db.BaseAccess.AsNoTracking().Where(a => a.UserId == me).Select(a => a.BaseId).ToListAsync(ct)).ToHashSet();
        _loaded = true;
        return _allowed;
    }

    public async Task<bool> CanUseBaseAsync(Guid baseId, CancellationToken ct)
    {
        var allowed = await AllowedBaseIdsAsync(ct);
        return allowed is null || allowed.Contains(baseId);
    }
}

/// <summary>Company name for the letterhead on decision PDFs, read from Identity's settings (cached).</summary>
internal sealed class WfBranding(WorkflowDbContext db, IMemoryCache cache)
{
    private sealed class Row { public string SettingKey { get; set; } = ""; public string? Value { get; set; } }
    private sealed class TenantRow { public string Name { get; set; } = ""; }

    public sealed record Brand(string CompanyName, string? LegalName, string? Address, string? TaxNumber);

    public async Task<Brand> GetAsync(Guid? tenantId, CancellationToken ct)
    {
        if (tenantId is null) return new Brand("Your Company", null, null, null);
        var key = $"wf-brand::{tenantId}";
        if (cache.TryGetValue(key, out Brand? hit) && hit is not null) return hit;
        Brand brand;
        try
        {
            // "identity" is a reserved SQL Server keyword and MUST be bracketed.
            var rows = await db.Database.SqlQuery<Row>($"""
                SELECT [Key] AS SettingKey, [Value] FROM [identity].[app_settings]
                WHERE [TenantId] = {tenantId} AND [Category] IN ('company') AND [UserId] IS NULL
                """).ToListAsync(ct);
            var map = rows.Where(r => !string.IsNullOrWhiteSpace(r.Value))
                .GroupBy(r => r.SettingKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value!.Trim(), StringComparer.OrdinalIgnoreCase);
            string? Get(params string[] k) { foreach (var x in k) if (map.TryGetValue(x, out var v)) return v; return null; }
            var t = await db.Database.SqlQuery<TenantRow>($"SELECT TOP 1 [Name] FROM [identity].[tenants] WHERE [Id] = {tenantId}").FirstOrDefaultAsync(ct);
            brand = new Brand(Get("name", "companyName") ?? t?.Name ?? "Your Company", Get("legalName"), Get("address"), Get("taxNumber", "trn"));
        }
        catch { brand = new Brand("Your Company", null, null, null); }
        cache.Set(key, brand, TimeSpan.FromMinutes(5));
        return brand;
    }
}

/// <summary>Reads a form definition and checks a submission against it.</summary>
internal static class FormEngine
{
    public static List<FieldDef> Parse(string json)
    {
        try { return JsonSerializer.Deserialize<List<FieldDef>>(json, Wf.Json) ?? []; }
        catch { return []; }
    }

    /// <summary>The definition itself must be sound before it is saved: unique keys, known types, selects with options.</summary>
    public static string? CheckDefinition(string json)
    {
        List<FieldDef>? fields;
        try { fields = JsonSerializer.Deserialize<List<FieldDef>>(json, Wf.Json); }
        catch { return "The form fields are not valid."; }
        if (fields is null || fields.Count == 0) return "A form needs at least one field.";
        if (fields.Count > 60) return "A form can have at most 60 fields.";
        var types = new[] { "text", "textarea", "number", "money", "date", "select", "checkbox", "attachment", "lines" };
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var f in fields)
        {
            if (string.IsNullOrWhiteSpace(f.Key) || !System.Text.RegularExpressions.Regex.IsMatch(f.Key, "^[A-Za-z][A-Za-z0-9_]{0,39}$"))
                return $"Field key '{f.Key}' must start with a letter and use only letters, numbers and underscores.";
            if (!keys.Add(f.Key)) return $"Field key '{f.Key}' is used twice.";
            if (string.IsNullOrWhiteSpace(f.Label)) return $"Field '{f.Key}' needs a label.";
            if (!types.Contains(f.Type)) return $"Field '{f.Key}' has an unknown type '{f.Type}'.";
            if (f.Type == "select" && (f.Options is null || f.Options.Length == 0)) return $"Field '{f.Label}' needs at least one option.";
            if (f.Type == "lines")
            {
                if (f.Columns is null || f.Columns.Length == 0) return $"Table '{f.Label}' needs at least one column.";
                var ck = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var c in f.Columns)
                {
                    if (string.IsNullOrWhiteSpace(c.Key) || !ck.Add(c.Key)) return $"Table '{f.Label}' has a missing or repeated column key.";
                    if (c.Type is not ("text" or "number" or "money" or "date" or "select")) return $"Column '{c.Label}' has an unknown type.";
                    if (c.Type == "select" && (c.Options is null || c.Options.Length == 0)) return $"Column '{c.Label}' needs options.";
                }
            }
            if (f.ShowIf is { } s && !fields.Any(x => x.Key.Equals(s.Field, StringComparison.OrdinalIgnoreCase)))
                return $"Field '{f.Label}' depends on a field that does not exist.";
        }
        return null;
    }

    public sealed record Checked(JsonObject Data, decimal Amount, string? Title, List<string> Errors);

    public static Checked Check(IReadOnlyList<FieldDef> fields, JsonElement raw, ISet<string> attachmentKeys, bool strict)
    {
        var errors = new List<string>();
        var data = new JsonObject();
        decimal amount = 0; string? title = null;
        var src = raw.ValueKind == JsonValueKind.Object ? raw : default;

        JsonElement? Get(string key)
        {
            if (src.ValueKind != JsonValueKind.Object) return null;
            foreach (var p in src.EnumerateObject())
                if (p.Name.Equals(key, StringComparison.OrdinalIgnoreCase)) return p.Value;
            return null;
        }
        static string? Str(JsonElement? e) => e is null ? null : e.Value.ValueKind switch
        {
            JsonValueKind.String => e.Value.GetString()?.Trim(),
            JsonValueKind.Number => e.Value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null,
        };
        static bool Num(JsonElement? e, out decimal v)
        {
            v = 0;
            if (e is null) return false;
            if (e.Value.ValueKind == JsonValueKind.Number) return e.Value.TryGetDecimal(out v);
            if (e.Value.ValueKind == JsonValueKind.String)
                return decimal.TryParse(e.Value.GetString()?.Replace(",", ""), NumberStyles.Number, CultureInfo.InvariantCulture, out v);
            return false;
        }

        bool Visible(FieldDef f)
        {
            if (f.ShowIf is null) return true;
            var other = Str(Get(f.ShowIf.Field));
            return other is not null && f.ShowIf.In.Any(v => v.Equals(other, StringComparison.OrdinalIgnoreCase));
        }

        foreach (var f in fields)
        {
            if (!Visible(f)) continue;
            var v = Get(f.Key);
            switch (f.Type)
            {
                case "text" or "textarea" or "select" or "date":
                {
                    var s = Str(v);
                    if (string.IsNullOrEmpty(s)) { if (f.Required && strict) errors.Add($"{f.Label} is required."); break; }
                    if (s.Length > 4000) { errors.Add($"{f.Label} is too long."); break; }
                    if (f.Type == "select" && f.Options is not null)
                    {
                        var hit = f.Options.FirstOrDefault(o => o.Equals(s, StringComparison.OrdinalIgnoreCase));
                        if (hit is null) { errors.Add($"{f.Label}: '{s}' is not one of the choices."); break; }
                        s = hit;
                    }
                    if (f.Type == "date" && !Wf.ValidDate(s)) { errors.Add($"{f.Label} must be a date."); break; }
                    data[f.Key] = s;
                    if (f.IsTitle) title = s.Length > 120 ? s[..120] : s;
                    break;
                }
                case "number" or "money":
                {
                    if (v is null || Str(v) is null or "") { if (f.Required && strict) errors.Add($"{f.Label} is required."); break; }
                    if (!Num(v, out var n)) { errors.Add($"{f.Label} must be a number."); break; }
                    if (n < 0) { errors.Add($"{f.Label} cannot be negative."); break; }
                    data[f.Key] = n;
                    if (f.IsAmount) amount += n;
                    break;
                }
                case "checkbox":
                    data[f.Key] = v is { ValueKind: JsonValueKind.True } || Str(v) == "true";
                    break;
                case "attachment":
                    if (f.Required && strict && !attachmentKeys.Contains(f.Key)) errors.Add($"{f.Label}: please attach a file.");
                    break;
                case "lines":
                {
                    var rows = new JsonArray();
                    if (v is { ValueKind: JsonValueKind.Array } arr)
                    {
                        var rowNo = 0;
                        foreach (var row in arr.EnumerateArray())
                        {
                            if (row.ValueKind != JsonValueKind.Object) continue;
                            rowNo++;
                            var o = new JsonObject();
                            var empty = true; var rowOk = true;
                            var nums = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                            JsonElement? Cell(string k) { foreach (var p in row.EnumerateObject()) if (p.Name.Equals(k, StringComparison.OrdinalIgnoreCase)) return p.Value; return null; }
                            foreach (var c in f.Columns ?? [])
                            {
                                var cv = Cell(c.Key);
                                if (c.Product is { Length: 2 }) continue; // computed below
                                var cs = Str(cv);
                                if (string.IsNullOrEmpty(cs)) { if (c.Required && strict && !IsRowBlank(row)) { errors.Add($"{f.Label}, row {rowNo}: {c.Label} is required."); rowOk = false; } continue; }
                                empty = false;
                                if (c.Type is "number" or "money")
                                {
                                    if (!Num(cv, out var n) || n < 0) { errors.Add($"{f.Label}, row {rowNo}: {c.Label} must be a number."); rowOk = false; continue; }
                                    o[c.Key] = n; nums[c.Key] = n;
                                    if (c.IsAmount) amount += n;
                                }
                                else if (c.Type == "date")
                                {
                                    if (!Wf.ValidDate(cs)) { errors.Add($"{f.Label}, row {rowNo}: {c.Label} must be a date."); rowOk = false; continue; }
                                    o[c.Key] = cs;
                                }
                                else if (c.Type == "select" && c.Options is not null)
                                {
                                    var hit = c.Options.FirstOrDefault(x => x.Equals(cs, StringComparison.OrdinalIgnoreCase));
                                    if (hit is null) { errors.Add($"{f.Label}, row {rowNo}: '{cs}' is not one of the choices."); rowOk = false; continue; }
                                    o[c.Key] = hit;
                                }
                                else o[c.Key] = cs.Length > 1000 ? cs[..1000] : cs;
                            }
                            // Computed columns are always recomputed here, so a total can't be typed in wrongly.
                            foreach (var c in (f.Columns ?? []).Where(c => c.Product is { Length: 2 }))
                            {
                                if (nums.TryGetValue(c.Product![0], out var a) && nums.TryGetValue(c.Product[1], out var b))
                                {
                                    var p = Math.Round(a * b, 2);
                                    o[c.Key] = p;
                                    if (c.IsAmount) amount += p;
                                }
                            }
                            if (empty || !rowOk) continue;
                            rows.Add(o);
                            if (rows.Count >= 200) break;
                        }
                    }
                    if (rows.Count == 0 && f.Required && strict) errors.Add($"{f.Label}: add at least one row.");
                    data[f.Key] = rows;
                    break;
                }
            }
        }
        return new Checked(data, Math.Round(amount, 2), title, errors);
    }

    private static bool IsRowBlank(JsonElement row) =>
        row.EnumerateObject().All(p => p.Value.ValueKind is JsonValueKind.Null || (p.Value.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(p.Value.GetString())));
}

/// <summary>Finds the approval flow for a form, Base and unit, and who sits on each step.</summary>
internal sealed class FlowResolver(WorkflowDbContext db)
{
    public sealed record Holder(Guid UserId, string Name, string? Email, string? Designation);
    public sealed record Step(int Order, string Kind, Guid PositionId, string PositionName, string? Label, decimal? MinAmount,
        bool Applies, List<Holder> Holders);
    public sealed record Resolved(WfFlow? Flow, string Scope, List<Step> Steps, List<string> Problems);

    public async Task<Resolved> ResolveAsync(Guid formId, Guid baseId, Guid? unitId, decimal amount, string baseName, string? unitName, CancellationToken ct)
    {
        var flows = await db.Flows.AsNoTracking()
            .Where(f => f.FormId == formId && f.IsActive && !f.IsDeleted
                        && (f.BaseId == null || f.BaseId == baseId) && (f.UnitId == null || f.UnitId == unitId))
            .ToListAsync(ct);
        var flow = flows
            .OrderByDescending(f => (f.BaseId is null ? 0 : 2) + (f.UnitId is null ? 0 : 1))
            .ThenBy(f => f.CreatedAt).FirstOrDefault();
        if (flow is null)
            return new Resolved(null, "none", [], [$"There is no approval flow set up for this form at {baseName}. Ask an administrator to add one."]);

        var scope = flow.BaseId is null && flow.UnitId is null ? "Default for every Base"
            : flow.BaseId is not null && flow.UnitId is not null ? $"{baseName} · {unitName}"
            : flow.BaseId is not null ? baseName : (unitName ?? "unit");

        var steps = await db.FlowSteps.AsNoTracking().Where(s => s.FlowId == flow.Id).OrderBy(s => s.Order).ToListAsync(ct);
        var posIds = steps.Select(s => s.PositionId).Distinct().ToList();
        var positions = await db.Positions.AsNoTracking().Where(p => posIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var holders = await db.Holders.AsNoTracking().Where(h => posIds.Contains(h.PositionId)).ToListAsync(ct);

        var problems = new List<string>();
        var result = new List<Step>();
        foreach (var s in steps)
        {
            var pos = positions.GetValueOrDefault(s.PositionId);
            var name = pos?.Name ?? "(removed position)";
            var applies = s.MinAmount is null || amount >= s.MinAmount;
            var mine = holders.Where(h => h.PositionId == s.PositionId).ToList();
            // Most specific wins: Base+unit, then Base, then unit, then everywhere.
            var tier = mine.Where(h => h.BaseId == baseId && h.UnitId is not null && h.UnitId == unitId).ToList();
            if (tier.Count == 0) tier = mine.Where(h => h.BaseId == baseId && h.UnitId is null).ToList();
            if (tier.Count == 0) tier = mine.Where(h => h.BaseId is null && h.UnitId is not null && h.UnitId == unitId).ToList();
            if (tier.Count == 0) tier = mine.Where(h => h.BaseId is null && h.UnitId is null).ToList();
            var list = tier.Select(h => new Holder(h.UserId, h.UserName, h.Email, h.Designation)).ToList();
            if (applies && (pos is null || !pos.IsActive || pos.IsDeleted))
                problems.Add($"Step {s.Order} uses a position that no longer exists.");
            else if (applies && list.Count == 0)
                problems.Add($"No one holds \"{name}\" for {baseName}{(unitName is null ? "" : " / " + unitName)}.");
            result.Add(new Step(s.Order, s.Kind, s.PositionId, name, s.Label, s.MinAmount, applies, list));
        }
        if (result.Count == 0 || result.All(s => !s.Applies))
            problems.Add("This flow has no steps that apply, so nothing would be approved.");
        return new Resolved(flow, scope, result, problems);
    }
}

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Workflow.Application;
using Softaxis.Workflow.Domain.Entities;
using Softaxis.Workflow.Infrastructure.Persistence;
using Softaxis.Workflow.Infrastructure.Services;

namespace Softaxis.Workflow.Infrastructure.Handlers;

/// <summary>Setup is for administrators. Reads that feed the request screens are open to any module user.</summary>
internal static class Guard
{
    public static Result? RequireAdmin(WfAccess access) =>
        access.IsAdmin ? null : Result.Failure(Wf.Forbidden("Only a workflow administrator can change this."));
    public static Result<T>? RequireAdmin<T>(WfAccess access) =>
        access.IsAdmin ? null : Result.Failure<T>(Wf.Forbidden("Only a workflow administrator can change this."));
}

// ── Settings and the caller's own context ───────────────────────────────────

internal static class Map
{
    public static WfSettingsDto Settings(WfSettings s) =>
        new(s.LocationLabel, s.UnitLabel, s.DirectoryRefresh, s.DirectoryRefreshedAt, s.TimeZoneId, s.NumberPrefix, s.StarterPack);
    public static UnitDto Unit(WfUnit u) => new(u.Id, u.Name, u.Code, u.SortOrder, u.IsActive);
}

internal sealed class GetSettingsHandler(WorkflowDbContext db) : IQueryHandler<GetSettingsQuery, WfSettingsDto>
{
    public async Task<Result<WfSettingsDto>> Handle(GetSettingsQuery q, CancellationToken ct) =>
        Result.Success(Map.Settings(await Wf.SettingsAsync(db, ct)));
}

internal sealed class UpdateSettingsHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user)
    : ICommandHandler<UpdateSettingsCommand, WfSettingsDto>
{
    public async Task<Result<WfSettingsDto>> Handle(UpdateSettingsCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<WfSettingsDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.LocationLabel) || string.IsNullOrWhiteSpace(c.UnitLabel))
            return Result.Failure<WfSettingsDto>(Wf.Invalid("Both labels are required."));
        if (c.DirectoryRefresh is not ("biweekly" or "monthly"))
            return Result.Failure<WfSettingsDto>(Wf.Invalid("Directory refresh must be biweekly or monthly."));
        try { TimeZoneInfo.FindSystemTimeZoneById(c.TimeZoneId); }
        catch { return Result.Failure<WfSettingsDto>(Wf.Invalid("That time zone is not known.")); }
        if (string.IsNullOrWhiteSpace(c.NumberPrefix) || c.NumberPrefix.Trim().Length > 8)
            return Result.Failure<WfSettingsDto>(Wf.Invalid("The request number prefix must be 1 to 8 characters."));

        var s = await Wf.SettingsAsync(db, ct);
        s.Update(c.LocationLabel, c.UnitLabel, c.DirectoryRefresh, c.TimeZoneId, c.NumberPrefix);
        Wf.Log(db, user, "settings.updated", "settings", s.Id);
        await db.SaveChangesAsync(ct);
        return Result.Success(Map.Settings(s));
    }
}

internal sealed class GetMyContextHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user)
    : IQueryHandler<GetMyContextQuery, MyContextDto>
{
    public async Task<Result<MyContextDto>> Handle(GetMyContextQuery q, CancellationToken ct)
    {
        var settings = await Wf.SettingsAsync(db, ct);
        var allowed = await access.AllowedBaseIdsAsync(ct);
        var bases = await db.Bases.AsNoTracking().Where(b => !b.IsDeleted && b.IsActive)
            .OrderBy(b => b.SortOrder).ThenBy(b => b.Name).ToListAsync(ct);
        var mine = bases.Where(b => allowed is null || allowed.Contains(b.Id)).Select(b => new MyBaseDto(b.Id, b.Code, b.Name)).ToList();
        var units = await db.Units.AsNoTracking().Where(u => !u.IsDeleted && u.IsActive).OrderBy(u => u.SortOrder).ThenBy(u => u.Name).ToListAsync(ct);
        var setup = bases.Count > 0 && await db.Forms.AnyAsync(f => !f.IsDeleted, ct);
        return Result.Success(new MyContextDto(Map.Settings(settings), mine, units.Select(Map.Unit).ToList(), access.IsAdmin, access.SeesAll,
            user.IsSuperAdmin || user.HasPermission(WfPerm.RequestsCreate), user.IsSuperAdmin || user.HasPermission(WfPerm.Approve),
            setup, user.Id, user.Name));
    }
}

// ── Bases ───────────────────────────────────────────────────────────────────

internal sealed class GetBasesHandler(WorkflowDbContext db) : IQueryHandler<GetBasesQuery, IReadOnlyList<BaseDto>>
{
    public async Task<Result<IReadOnlyList<BaseDto>>> Handle(GetBasesQuery q, CancellationToken ct)
    {
        var bases = await db.Bases.AsNoTracking().Where(b => !b.IsDeleted).OrderBy(b => b.SortOrder).ThenBy(b => b.Name).ToListAsync(ct);
        var counts = await db.BaseAccess.AsNoTracking().GroupBy(a => a.BaseId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return Result.Success<IReadOnlyList<BaseDto>>(bases.Select(b => new BaseDto(b.Id, b.Code, b.Name, b.Country, b.SortOrder, b.IsActive, counts.GetValueOrDefault(b.Id))).ToList());
    }
}

internal sealed class SaveBaseHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveBaseCommand, BaseDto>
{
    public async Task<Result<BaseDto>> Handle(SaveBaseCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<BaseDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name))
            return Result.Failure<BaseDto>(Wf.Invalid("A code and a name are required."));
        var code = c.Code.Trim().ToUpperInvariant();
        if (await db.Bases.AnyAsync(b => b.Code == code && b.Id != c.Id && !b.IsDeleted, ct))
            return Result.Failure<BaseDto>(Wf.Conflict("Base", $"There is already a location with the code {code}."));

        WfBase b;
        if (c.Id is { } id)
        {
            b = (await db.Bases.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct))!;
            if (b is null) return Result.Failure<BaseDto>(Wf.NotFound("Base"));
            b.Update(c.Code, c.Name, c.Country, c.SortOrder, c.IsActive);
        }
        else
        {
            b = new WfBase(c.Code, c.Name);
            b.Update(c.Code, c.Name, c.Country, c.SortOrder, c.IsActive);
            db.Bases.Add(b);
        }
        Wf.Log(db, user, c.Id is null ? "base.created" : "base.updated", "base", b.Id, null, $"{b.Code} {b.Name}");
        await db.SaveChangesAsync(ct);
        var n = await db.BaseAccess.CountAsync(a => a.BaseId == b.Id, ct);
        return Result.Success(new BaseDto(b.Id, b.Code, b.Name, b.Country, b.SortOrder, b.IsActive, n));
    }
}

internal sealed class DeleteBaseHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteBaseCommand>
{
    public async Task<Result> Handle(DeleteBaseCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var b = await db.Bases.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Wf.NotFound("Base"));
        if (await db.Requests.AnyAsync(r => r.BaseId == b.Id && !r.IsDeleted, ct))
            return Result.Failure(Wf.Conflict("Base", "Requests exist for this location. Switch it off instead of deleting it."));
        db.Flows.RemoveRange(await db.Flows.Where(f => f.BaseId == b.Id).ToListAsync(ct));
        db.Holders.RemoveRange(await db.Holders.Where(h => h.BaseId == b.Id).ToListAsync(ct));
        db.BaseAccess.RemoveRange(await db.BaseAccess.Where(a => a.BaseId == b.Id).ToListAsync(ct));
        b.Delete();
        Wf.Log(db, user, "base.deleted", "base", b.Id, null, $"{b.Code} {b.Name}");
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Units ───────────────────────────────────────────────────────────────────

internal sealed class GetUnitsHandler(WorkflowDbContext db) : IQueryHandler<GetUnitsQuery, IReadOnlyList<UnitDto>>
{
    public async Task<Result<IReadOnlyList<UnitDto>>> Handle(GetUnitsQuery q, CancellationToken ct) =>
        Result.Success<IReadOnlyList<UnitDto>>((await db.Units.AsNoTracking().Where(u => !u.IsDeleted)
            .OrderBy(u => u.SortOrder).ThenBy(u => u.Name).ToListAsync(ct)).Select(Map.Unit).ToList());
}

internal sealed class SaveUnitHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveUnitCommand, UnitDto>
{
    public async Task<Result<UnitDto>> Handle(SaveUnitCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<UnitDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.Name)) return Result.Failure<UnitDto>(Wf.Invalid("A name is required."));
        var name = c.Name.Trim();
        if (await db.Units.AnyAsync(u => u.Name == name && u.Id != c.Id && !u.IsDeleted, ct))
            return Result.Failure<UnitDto>(Wf.Conflict("Unit", $"There is already one called {name}."));
        WfUnit u;
        if (c.Id is { } id)
        {
            u = (await db.Units.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct))!;
            if (u is null) return Result.Failure<UnitDto>(Wf.NotFound("Unit"));
        }
        else { u = new WfUnit(name); db.Units.Add(u); }
        u.Update(name, c.Code, c.SortOrder, c.IsActive);
        Wf.Log(db, user, c.Id is null ? "unit.created" : "unit.updated", "unit", u.Id, null, u.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success(Map.Unit(u));
    }
}

internal sealed class DeleteUnitHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteUnitCommand>
{
    public async Task<Result> Handle(DeleteUnitCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var u = await db.Units.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (u is null) return Result.Failure(Wf.NotFound("Unit"));
        if (await db.Requests.AnyAsync(r => r.UnitId == u.Id && !r.IsDeleted, ct))
            return Result.Failure(Wf.Conflict("Unit", "Requests exist for this unit. Switch it off instead of deleting it."));
        db.Flows.RemoveRange(await db.Flows.Where(f => f.UnitId == u.Id).ToListAsync(ct));
        db.Holders.RemoveRange(await db.Holders.Where(h => h.UnitId == u.Id).ToListAsync(ct));
        u.Delete();
        Wf.Log(db, user, "unit.deleted", "unit", u.Id, null, u.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Positions and who holds them ────────────────────────────────────────────

internal sealed class GetPositionsHandler(WorkflowDbContext db) : IQueryHandler<GetPositionsQuery, IReadOnlyList<PositionDto>>
{
    public async Task<Result<IReadOnlyList<PositionDto>>> Handle(GetPositionsQuery q, CancellationToken ct)
    {
        var list = await db.Positions.AsNoTracking().Where(p => !p.IsDeleted).OrderBy(p => p.Name).ToListAsync(ct);
        var holders = await db.Holders.AsNoTracking().GroupBy(h => h.PositionId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var flows = await db.FlowSteps.AsNoTracking().GroupBy(s => s.PositionId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return Result.Success<IReadOnlyList<PositionDto>>(list.Select(p =>
            new PositionDto(p.Id, p.Name, p.Description, p.IsActive, holders.GetValueOrDefault(p.Id), flows.GetValueOrDefault(p.Id))).ToList());
    }
}

internal sealed class SavePositionHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SavePositionCommand, PositionDto>
{
    public async Task<Result<PositionDto>> Handle(SavePositionCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<PositionDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.Name)) return Result.Failure<PositionDto>(Wf.Invalid("A name is required."));
        var name = c.Name.Trim();
        if (await db.Positions.AnyAsync(p => p.Name == name && p.Id != c.Id && !p.IsDeleted, ct))
            return Result.Failure<PositionDto>(Wf.Conflict("Position", $"There is already a position called {name}."));
        WfPosition p;
        if (c.Id is { } id)
        {
            p = (await db.Positions.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct))!;
            if (p is null) return Result.Failure<PositionDto>(Wf.NotFound("Position"));
        }
        else { p = new WfPosition(name); db.Positions.Add(p); }
        p.Update(name, c.Description, c.IsActive);
        Wf.Log(db, user, c.Id is null ? "position.created" : "position.updated", "position", p.Id, null, p.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success(new PositionDto(p.Id, p.Name, p.Description, p.IsActive,
            await db.Holders.CountAsync(h => h.PositionId == p.Id, ct), await db.FlowSteps.CountAsync(s => s.PositionId == p.Id, ct)));
    }
}

internal sealed class DeletePositionHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeletePositionCommand>
{
    public async Task<Result> Handle(DeletePositionCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var p = await db.Positions.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure(Wf.NotFound("Position"));
        if (await db.FlowSteps.AnyAsync(s => s.PositionId == p.Id, ct))
            return Result.Failure(Wf.Conflict("Position", "An approval flow still uses this position. Remove it from the flows first."));
        db.Holders.RemoveRange(await db.Holders.Where(h => h.PositionId == p.Id).ToListAsync(ct));
        p.Delete();
        Wf.Log(db, user, "position.deleted", "position", p.Id, null, p.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetHoldersHandler(WorkflowDbContext db) : IQueryHandler<GetHoldersQuery, IReadOnlyList<HolderDto>>
{
    public async Task<Result<IReadOnlyList<HolderDto>>> Handle(GetHoldersQuery q, CancellationToken ct)
    {
        var query = db.Holders.AsNoTracking().AsQueryable();
        if (q.PositionId is { } p) query = query.Where(h => h.PositionId == p);
        var list = await query.OrderBy(h => h.UserName).ToListAsync(ct);
        var pos = await db.Positions.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var bases = await db.Bases.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var units = await db.Units.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        return Result.Success<IReadOnlyList<HolderDto>>(list.Select(h => new HolderDto(h.Id, h.PositionId, pos.GetValueOrDefault(h.PositionId, "?"),
            h.BaseId, h.BaseId is { } b ? bases.GetValueOrDefault(b) : null, h.UnitId, h.UnitId is { } u ? units.GetValueOrDefault(u) : null,
            h.UserId, h.UserName, h.Email, h.Designation)).ToList());
    }
}

internal sealed class SaveHolderHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveHolderCommand, HolderDto>
{
    public async Task<Result<HolderDto>> Handle(SaveHolderCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<HolderDto>(access) is { } no) return no;
        var pos = await db.Positions.FirstOrDefaultAsync(p => p.Id == c.PositionId && !p.IsDeleted, ct);
        if (pos is null) return Result.Failure<HolderDto>(Wf.NotFound("Position"));
        if (c.UserId == Guid.Empty || string.IsNullOrWhiteSpace(c.UserName)) return Result.Failure<HolderDto>(Wf.Invalid("Choose a person."));
        if (c.BaseId is { } bid && !await db.Bases.AnyAsync(b => b.Id == bid && !b.IsDeleted, ct)) return Result.Failure<HolderDto>(Wf.NotFound("Base"));
        if (c.UnitId is { } uid && !await db.Units.AnyAsync(u => u.Id == uid && !u.IsDeleted, ct)) return Result.Failure<HolderDto>(Wf.NotFound("Unit"));

        WfPositionHolder h;
        if (c.Id is { } id)
        {
            h = (await db.Holders.FirstOrDefaultAsync(x => x.Id == id, ct))!;
            if (h is null) return Result.Failure<HolderDto>(Wf.NotFound("Holder"));
            db.Holders.Remove(h);   // identity fields are init-only: replace the row
        }
        if (await db.Holders.AnyAsync(x => x.PositionId == c.PositionId && x.UserId == c.UserId && x.BaseId == c.BaseId && x.UnitId == c.UnitId && x.Id != c.Id, ct))
            return Result.Failure<HolderDto>(Wf.Conflict("Holder", "This person already holds that position there."));
        h = new WfPositionHolder(c.PositionId, c.BaseId, c.UnitId, c.UserId, c.UserName.Trim());
        h.SetDetails(c.Email, c.Designation);
        db.Holders.Add(h);
        // Holding a position at a Base implies being allowed to use it.
        if (c.BaseId is { } b2 && !await db.BaseAccess.AnyAsync(a => a.BaseId == b2 && a.UserId == c.UserId, ct))
            db.BaseAccess.Add(new WfBaseAccess(b2, c.UserId, c.UserName.Trim()));
        Wf.Log(db, user, "position.holder.set", "position", pos.Id, null, $"{c.UserName} → {pos.Name}");
        await db.SaveChangesAsync(ct);
        var bn = c.BaseId is { } x ? (await db.Bases.FindAsync([x], ct))?.Name : null;
        var un = c.UnitId is { } y ? (await db.Units.FindAsync([y], ct))?.Name : null;
        return Result.Success(new HolderDto(h.Id, pos.Id, pos.Name, h.BaseId, bn, h.UnitId, un, h.UserId, h.UserName, h.Email, h.Designation));
    }
}

internal sealed class DeleteHolderHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteHolderCommand>
{
    public async Task<Result> Handle(DeleteHolderCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var h = await db.Holders.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (h is null) return Result.Failure(Wf.NotFound("Holder"));
        db.Holders.Remove(h);
        Wf.Log(db, user, "position.holder.removed", "position", h.PositionId, null, h.UserName);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Base access ─────────────────────────────────────────────────────────────

internal sealed class GetBaseAccessHandler(WorkflowDbContext db, WfAccess access) : IQueryHandler<GetBaseAccessQuery, BaseAccessDto>
{
    public async Task<Result<BaseAccessDto>> Handle(GetBaseAccessQuery q, CancellationToken ct)
    {
        if (Guard.RequireAdmin<BaseAccessDto>(access) is { } no) return no;
        var users = await db.BaseAccess.AsNoTracking().Where(a => a.BaseId == q.BaseId).OrderBy(a => a.UserName)
            .Select(a => new AccessUserDto(a.UserId, a.UserName)).ToListAsync(ct);
        return Result.Success(new BaseAccessDto(q.BaseId, users));
    }
}

internal sealed class SetBaseAccessHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SetBaseAccessCommand, BaseAccessDto>
{
    public async Task<Result<BaseAccessDto>> Handle(SetBaseAccessCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<BaseAccessDto>(access) is { } no) return no;
        var b = await db.Bases.FirstOrDefaultAsync(x => x.Id == c.BaseId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<BaseAccessDto>(Wf.NotFound("Base"));
        var existing = await db.BaseAccess.Where(a => a.BaseId == c.BaseId).ToListAsync(ct);
        var want = c.Users.Where(u => u.UserId != Guid.Empty).GroupBy(u => u.UserId).Select(g => g.First()).ToList();
        db.BaseAccess.RemoveRange(existing.Where(e => want.All(w => w.UserId != e.UserId)));
        foreach (var w in want.Where(w => existing.All(e => e.UserId != w.UserId)))
            db.BaseAccess.Add(new WfBaseAccess(c.BaseId, w.UserId, w.UserName));
        Wf.Log(db, user, "base.access.set", "base", b.Id, null, $"{b.Name}: {want.Count} people");
        await db.SaveChangesAsync(ct);
        return Result.Success(new BaseAccessDto(c.BaseId, want));
    }
}

internal sealed class GetUserBasesHandler(WorkflowDbContext db, WfAccess access) : IQueryHandler<GetUserBasesQuery, IReadOnlyList<Guid>>
{
    public async Task<Result<IReadOnlyList<Guid>>> Handle(GetUserBasesQuery q, CancellationToken ct)
    {
        if (Guard.RequireAdmin<IReadOnlyList<Guid>>(access) is { } no) return no;
        return Result.Success<IReadOnlyList<Guid>>(await db.BaseAccess.AsNoTracking().Where(a => a.UserId == q.UserId).Select(a => a.BaseId).ToListAsync(ct));
    }
}

internal sealed class SetUserBasesHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SetUserBasesCommand>
{
    public async Task<Result> Handle(SetUserBasesCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var live = (await db.Bases.Where(b => !b.IsDeleted).Select(b => b.Id).ToListAsync(ct)).ToHashSet();
        var want = c.BaseIds.Where(live.Contains).Distinct().ToList();
        var existing = await db.BaseAccess.Where(a => a.UserId == c.UserId).ToListAsync(ct);
        db.BaseAccess.RemoveRange(existing.Where(e => !want.Contains(e.BaseId)));
        foreach (var id in want.Where(id => existing.All(e => e.BaseId != id))) db.BaseAccess.Add(new WfBaseAccess(id, c.UserId, c.UserName));
        Wf.Log(db, user, "user.bases.set", "user", c.UserId, null, $"{c.UserName}: {want.Count} locations");
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Forms ───────────────────────────────────────────────────────────────────

internal static class FormMap
{
    public static FormDto Dto(WfForm f, int requests, int flows) =>
        new(f.Id, f.Key, f.Name, f.Description, f.Category, f.Icon, f.FieldsJson, f.Version, f.SortOrder, f.IsActive, f.IsBuiltIn, requests, flows);
}

internal sealed class GetFormsHandler(WorkflowDbContext db) : IQueryHandler<GetFormsQuery, IReadOnlyList<FormDto>>
{
    public async Task<Result<IReadOnlyList<FormDto>>> Handle(GetFormsQuery q, CancellationToken ct)
    {
        var query = db.Forms.AsNoTracking().Where(f => !f.IsDeleted);
        if (q.ActiveOnly) query = query.Where(f => f.IsActive);
        var list = await query.OrderBy(f => f.SortOrder).ThenBy(f => f.Name).ToListAsync(ct);
        var reqs = await db.Requests.AsNoTracking().Where(r => !r.IsDeleted).GroupBy(r => r.FormId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var flows = await db.Flows.AsNoTracking().Where(f => !f.IsDeleted).GroupBy(f => f.FormId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return Result.Success<IReadOnlyList<FormDto>>(list.Select(f => FormMap.Dto(f, reqs.GetValueOrDefault(f.Id), flows.GetValueOrDefault(f.Id))).ToList());
    }
}

internal sealed class GetFormHandler(WorkflowDbContext db) : IQueryHandler<GetFormQuery, FormDto>
{
    public async Task<Result<FormDto>> Handle(GetFormQuery q, CancellationToken ct)
    {
        var f = await db.Forms.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (f is null) return Result.Failure<FormDto>(Wf.NotFound("Form"));
        return Result.Success(FormMap.Dto(f, await db.Requests.CountAsync(r => r.FormId == f.Id && !r.IsDeleted, ct), await db.Flows.CountAsync(x => x.FormId == f.Id && !x.IsDeleted, ct)));
    }
}

internal sealed class SaveFormHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveFormCommand, FormDto>
{
    public async Task<Result<FormDto>> Handle(SaveFormCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<FormDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.Name)) return Result.Failure<FormDto>(Wf.Invalid("A name is required."));
        if (FormEngine.CheckDefinition(c.FieldsJson) is { } bad) return Result.Failure<FormDto>(Wf.Invalid(bad));

        WfForm f;
        if (c.Id is { } id)
        {
            f = (await db.Forms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct))!;
            if (f is null) return Result.Failure<FormDto>(Wf.NotFound("Form"));
        }
        else
        {
            var key = Slug(string.IsNullOrWhiteSpace(c.Key) ? c.Name : c.Key!);
            if (key.Length == 0) return Result.Failure<FormDto>(Wf.Invalid("Give the form a name."));
            var baseKey = key; var n = 2;
            while (await db.Forms.AnyAsync(x => x.Key == key && !x.IsDeleted, ct)) key = $"{baseKey}-{n++}";
            f = new WfForm(key, c.Name);
            db.Forms.Add(f);
        }
        f.Update(c.Name, c.Description, c.Category, c.Icon, c.FieldsJson, c.SortOrder, c.IsActive);
        Wf.Log(db, user, c.Id is null ? "form.created" : "form.updated", "form", f.Id, null, $"{f.Name} v{f.Version}");
        await db.SaveChangesAsync(ct);
        return Result.Success(FormMap.Dto(f, await db.Requests.CountAsync(r => r.FormId == f.Id && !r.IsDeleted, ct),
            await db.Flows.CountAsync(x => x.FormId == f.Id && !x.IsDeleted, ct)));
    }

    internal static string Slug(string s)
    {
        var chars = s.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray();
        return System.Text.RegularExpressions.Regex.Replace(new string(chars), "-+", "-").Trim('-');
    }
}

internal sealed class DuplicateFormHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DuplicateFormCommand, FormDto>
{
    public async Task<Result<FormDto>> Handle(DuplicateFormCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<FormDto>(access) is { } no) return no;
        var src = await db.Forms.AsNoTracking().FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (src is null) return Result.Failure<FormDto>(Wf.NotFound("Form"));
        var key = $"{src.Key}-copy"; var n = 2;
        while (await db.Forms.AnyAsync(x => x.Key == key && !x.IsDeleted, ct)) key = $"{src.Key}-copy-{n++}";
        var copy = new WfForm(key, $"{src.Name} (copy)");
        copy.Update(copy.Name, src.Description, src.Category, src.Icon, src.FieldsJson, src.SortOrder + 1, false);
        db.Forms.Add(copy);
        // The copy starts with the same approval chains, so duplicating a form is a real shortcut.
        var flows = await db.Flows.AsNoTracking().Where(f => f.FormId == src.Id && !f.IsDeleted).ToListAsync(ct);
        foreach (var fl in flows)
        {
            var nf = new WfFlow(copy.Id, fl.BaseId, fl.UnitId);
            db.Flows.Add(nf);
            foreach (var s in await db.FlowSteps.AsNoTracking().Where(s => s.FlowId == fl.Id).ToListAsync(ct))
                db.FlowSteps.Add(new WfFlowStep(nf.Id, s.Order, s.Kind, s.PositionId, s.Label, s.MinAmount));
        }
        Wf.Log(db, user, "form.duplicated", "form", copy.Id, null, $"from {src.Name}");
        await db.SaveChangesAsync(ct);
        return Result.Success(FormMap.Dto(copy, 0, flows.Count));
    }
}

internal sealed class DeleteFormHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteFormCommand>
{
    public async Task<Result> Handle(DeleteFormCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var f = await db.Forms.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (f is null) return Result.Failure(Wf.NotFound("Form"));
        if (await db.Requests.AnyAsync(r => r.FormId == f.Id && !r.IsDeleted, ct))
            return Result.Failure(Wf.Conflict("Form", "Requests have been made with this form. Switch it off instead of deleting it."));
        var flows = await db.Flows.Where(x => x.FormId == f.Id).ToListAsync(ct);
        var ids = flows.Select(x => x.Id).ToList();
        db.FlowSteps.RemoveRange(await db.FlowSteps.Where(s => ids.Contains(s.FlowId)).ToListAsync(ct));
        db.Flows.RemoveRange(flows);
        f.Delete();
        Wf.Log(db, user, "form.deleted", "form", f.Id, null, f.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Approval matrix ─────────────────────────────────────────────────────────

internal static class FlowMap
{
    public static async Task<List<FlowDto>> LoadAsync(WorkflowDbContext db, Guid? formId, Guid? flowId, CancellationToken ct)
    {
        var q = db.Flows.AsNoTracking().Where(f => !f.IsDeleted);
        if (formId is { } fid) q = q.Where(f => f.FormId == fid);
        if (flowId is { } id) q = q.Where(f => f.Id == id);
        var flows = await q.ToListAsync(ct);
        var ids = flows.Select(f => f.Id).ToList();
        var steps = await db.FlowSteps.AsNoTracking().Where(s => ids.Contains(s.FlowId)).OrderBy(s => s.Order).ToListAsync(ct);
        var pos = await db.Positions.AsNoTracking().ToDictionaryAsync(p => p.Id, p => p.Name, ct);
        var forms = await db.Forms.AsNoTracking().ToDictionaryAsync(f => f.Id, f => f.Name, ct);
        var bases = await db.Bases.AsNoTracking().ToDictionaryAsync(b => b.Id, b => b.Name, ct);
        var units = await db.Units.AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.Name, ct);
        return flows
            .OrderBy(f => forms.GetValueOrDefault(f.FormId)).ThenBy(f => f.BaseId is null ? 0 : 1).ThenBy(f => f.UnitId is null ? 0 : 1)
            .Select(f => new FlowDto(f.Id, f.FormId, forms.GetValueOrDefault(f.FormId, "?"),
                f.BaseId, f.BaseId is { } b ? bases.GetValueOrDefault(b) : null, f.UnitId, f.UnitId is { } u ? units.GetValueOrDefault(u) : null, f.IsActive,
                steps.Where(s => s.FlowId == f.Id).Select(s => new FlowStepDto(s.Order, s.Kind, s.PositionId, pos.GetValueOrDefault(s.PositionId, "?"), s.Label, s.MinAmount)).ToList()))
            .ToList();
    }
}

internal sealed class GetFlowsHandler(WorkflowDbContext db) : IQueryHandler<GetFlowsQuery, IReadOnlyList<FlowDto>>
{
    public async Task<Result<IReadOnlyList<FlowDto>>> Handle(GetFlowsQuery q, CancellationToken ct) =>
        Result.Success<IReadOnlyList<FlowDto>>(await FlowMap.LoadAsync(db, q.FormId, null, ct));
}

internal sealed class SaveFlowHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveFlowCommand, FlowDto>
{
    public async Task<Result<FlowDto>> Handle(SaveFlowCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<FlowDto>(access) is { } no) return no;
        if (!await db.Forms.AnyAsync(f => f.Id == c.FormId && !f.IsDeleted, ct)) return Result.Failure<FlowDto>(Wf.NotFound("Form"));
        if (c.BaseId is { } b && !await db.Bases.AnyAsync(x => x.Id == b && !x.IsDeleted, ct)) return Result.Failure<FlowDto>(Wf.NotFound("Base"));
        if (c.UnitId is { } u && !await db.Units.AnyAsync(x => x.Id == u && !x.IsDeleted, ct)) return Result.Failure<FlowDto>(Wf.NotFound("Unit"));
        if (c.Steps.Count == 0) return Result.Failure<FlowDto>(Wf.Invalid("A flow needs at least one step."));
        if (c.Steps.Count > 12) return Result.Failure<FlowDto>(Wf.Invalid("A flow can have at most 12 steps."));
        if (c.Steps.Any(s => !StepKind.Valid(s.Kind))) return Result.Failure<FlowDto>(Wf.Invalid("A step must be a review or an approval."));
        var posIds = c.Steps.Select(s => s.PositionId).Distinct().ToList();
        if (await db.Positions.CountAsync(p => posIds.Contains(p.Id) && !p.IsDeleted && p.IsActive, ct) != posIds.Count)
            return Result.Failure<FlowDto>(Wf.Invalid("A step uses a position that does not exist or is switched off."));
        if (c.Steps.All(s => s.Kind != StepKind.Approve))
            return Result.Failure<FlowDto>(Wf.Invalid("A flow needs at least one approval step (reviews alone cannot approve a request)."));
        if (await db.Flows.AnyAsync(f => f.FormId == c.FormId && f.BaseId == c.BaseId && f.UnitId == c.UnitId && f.Id != c.Id && !f.IsDeleted, ct))
            return Result.Failure<FlowDto>(Wf.Conflict("Flow", "There is already a flow for this form at that Base and unit. Edit it instead."));

        WfFlow flow;
        if (c.Id is { } id)
        {
            flow = (await db.Flows.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted, ct))!;
            if (flow is null) return Result.Failure<FlowDto>(Wf.NotFound("Flow"));
            flow.Update(c.BaseId, c.UnitId, c.IsActive);
            db.FlowSteps.RemoveRange(await db.FlowSteps.Where(s => s.FlowId == flow.Id).ToListAsync(ct));
        }
        else
        {
            flow = new WfFlow(c.FormId, c.BaseId, c.UnitId);
            flow.Update(c.BaseId, c.UnitId, c.IsActive);
            db.Flows.Add(flow);
        }
        var order = 1;
        foreach (var s in c.Steps)
            db.FlowSteps.Add(new WfFlowStep(flow.Id, order++, s.Kind, s.PositionId, s.Label, s.MinAmount is > 0 ? s.MinAmount : null));
        Wf.Log(db, user, c.Id is null ? "flow.created" : "flow.updated", "flow", flow.Id, null, $"{c.Steps.Count} steps");
        await db.SaveChangesAsync(ct);
        return Result.Success((await FlowMap.LoadAsync(db, null, flow.Id, ct)).First());
    }
}

internal sealed class DeleteFlowHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteFlowCommand>
{
    public async Task<Result> Handle(DeleteFlowCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var f = await db.Flows.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (f is null) return Result.Failure(Wf.NotFound("Flow"));
        db.FlowSteps.RemoveRange(await db.FlowSteps.Where(s => s.FlowId == f.Id).ToListAsync(ct));
        f.Delete();
        Wf.Log(db, user, "flow.deleted", "flow", f.Id);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ResolveFlowHandler(WorkflowDbContext db, FlowResolver resolver, WfAccess access) : IQueryHandler<ResolveFlowQuery, ResolvedFlowDto>
{
    public async Task<Result<ResolvedFlowDto>> Handle(ResolveFlowQuery q, CancellationToken ct)
    {
        if (!await access.CanUseBaseAsync(q.BaseId, ct)) return Result.Failure<ResolvedFlowDto>(Wf.Forbidden("You do not have access to that location."));
        var b = await db.Bases.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.BaseId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<ResolvedFlowDto>(Wf.NotFound("Base"));
        var unitName = q.UnitId is { } u ? (await db.Units.AsNoTracking().FirstOrDefaultAsync(x => x.Id == u, ct))?.Name : null;
        var r = await resolver.ResolveAsync(q.FormId, q.BaseId, q.UnitId, q.Amount ?? 0, b.Name, unitName, ct);
        return Result.Success(new ResolvedFlowDto(r.Flow?.Id, r.Scope,
            r.Steps.Select(s => new ResolvedStepDto(s.Order, s.Kind, s.PositionName, s.Label, s.MinAmount, s.Applies,
                s.Holders.Select(h => new HolderLiteDto(h.UserId, h.Name, h.Designation)).ToList(),
                s.Applies && s.Holders.Count == 0 ? $"No one holds {s.PositionName} here" : null)).ToList(), r.Problems));
    }
}

// ── Employee directory ──────────────────────────────────────────────────────

internal static class EmpMap
{
    public static EmployeeDto Dto(WfEmployee e, Dictionary<Guid, string> bases, Dictionary<Guid, string> units) =>
        new(e.Id, e.Code, e.Name, e.Email, e.Phone, e.Designation, e.Department, e.ManagerName,
            e.BaseId, e.BaseId is { } b ? bases.GetValueOrDefault(b) : null, e.UnitId, e.UnitId is { } u ? units.GetValueOrDefault(u) : null,
            e.IsActive, e.Source, e.LastSyncedAt, e.UserId is not null);
}

internal sealed class GetEmployeesHandler(WorkflowDbContext db) : IQueryHandler<GetEmployeesQuery, Paged<EmployeeDto>>
{
    public async Task<Result<Paged<EmployeeDto>>> Handle(GetEmployeesQuery q, CancellationToken ct)
    {
        var query = db.Employees.AsNoTracking().Where(e => !e.IsDeleted);
        if (q.BaseId is { } b) query = query.Where(e => e.BaseId == b);
        if (q.Active is { } a) query = query.Where(e => e.IsActive == a);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(e => e.Name.Contains(s) || (e.Email != null && e.Email.Contains(s)) || (e.Code != null && e.Code.Contains(s))
                                     || (e.Designation != null && e.Designation.Contains(s)) || (e.Department != null && e.Department.Contains(s)));
        }
        var total = await query.CountAsync(ct);
        var size = Math.Clamp(q.PageSize, 1, 200); var page = Math.Max(1, q.Page);
        var list = await query.OrderBy(e => e.Name).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var bases = await db.Bases.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var units = await db.Units.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        return Result.Success(new Paged<EmployeeDto>(list.Select(e => EmpMap.Dto(e, bases, units)).ToList(), total, page, size));
    }
}

internal sealed class SaveEmployeeHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<SaveEmployeeCommand, EmployeeDto>
{
    public async Task<Result<EmployeeDto>> Handle(SaveEmployeeCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<EmployeeDto>(access) is { } no) return no;
        if (string.IsNullOrWhiteSpace(c.Name)) return Result.Failure<EmployeeDto>(Wf.Invalid("A name is required."));
        var email = string.IsNullOrWhiteSpace(c.Email) ? null : c.Email.Trim().ToLowerInvariant();
        if (email is not null && await db.Employees.AnyAsync(e => e.Email == email && e.Id != c.Id && !e.IsDeleted, ct))
            return Result.Failure<EmployeeDto>(Wf.Conflict("Employee", $"{email} is already in the directory."));
        WfEmployee e;
        if (c.Id is { } id)
        {
            e = (await db.Employees.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct))!;
            if (e is null) return Result.Failure<EmployeeDto>(Wf.NotFound("Employee"));
        }
        else { e = new WfEmployee(c.Name); e.MarkSynced("manual"); db.Employees.Add(e); }
        e.Update(c.Code, c.Name, email, c.Phone, c.Designation, c.Department, c.ManagerName, c.BaseId, c.UnitId, c.IsActive);
        Wf.Log(db, user, c.Id is null ? "employee.created" : "employee.updated", "employee", e.Id, null, e.Name);
        await db.SaveChangesAsync(ct);
        var bases = await db.Bases.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var units = await db.Units.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        return Result.Success(EmpMap.Dto(e, bases, units));
    }
}

internal sealed class DeleteEmployeeHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user) : ICommandHandler<DeleteEmployeeCommand>
{
    public async Task<Result> Handle(DeleteEmployeeCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin(access) is { } no) return no;
        var e = await db.Employees.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (e is null) return Result.Failure(Wf.NotFound("Employee"));
        e.Delete();
        Wf.Log(db, user, "employee.deleted", "employee", e.Id, null, e.Name);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ImportEmployeesHandler(WorkflowDbContext db, WfAccess access, ICurrentUser user)
    : ICommandHandler<ImportEmployeesCommand, ImportEmployeesResult>
{
    public async Task<Result<ImportEmployeesResult>> Handle(ImportEmployeesCommand c, CancellationToken ct)
    {
        if (Guard.RequireAdmin<ImportEmployeesResult>(access) is { } no) return no;
        if (c.Rows.Count == 0) return Result.Failure<ImportEmployeesResult>(Wf.Invalid("The file has no rows."));
        if (c.Rows.Count > 5000) return Result.Failure<ImportEmployeesResult>(Wf.Invalid("Import at most 5,000 people at a time."));

        var bases = (await db.Bases.AsNoTracking().Where(b => !b.IsDeleted).ToListAsync(ct));
        var units = (await db.Units.AsNoTracking().Where(u => !u.IsDeleted).ToListAsync(ct));
        Guid? BaseOf(string? s) => string.IsNullOrWhiteSpace(s) ? null : bases.FirstOrDefault(b =>
            b.Code.Equals(s.Trim(), StringComparison.OrdinalIgnoreCase) || b.Name.Equals(s.Trim(), StringComparison.OrdinalIgnoreCase))?.Id;
        Guid? UnitOf(string? s) => string.IsNullOrWhiteSpace(s) ? null : units.FirstOrDefault(u =>
            u.Name.Equals(s.Trim(), StringComparison.OrdinalIgnoreCase) || (u.Code ?? "").Equals(s.Trim(), StringComparison.OrdinalIgnoreCase))?.Id;

        var existing = await db.Employees.Where(e => !e.IsDeleted).ToListAsync(ct);
        var byEmail = existing.Where(e => e.Email != null).GroupBy(e => e.Email!).ToDictionary(g => g.Key, g => g.First());
        var byCode = existing.Where(e => e.Code != null).GroupBy(e => e.Code!, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var created = 0; var updated = 0; var failed = 0; var errors = new List<ImportError>();
        var seen = new HashSet<Guid>();
        var rowNo = 1;
        foreach (var r in c.Rows)
        {
            rowNo++;
            if (string.IsNullOrWhiteSpace(r.Name)) { failed++; if (errors.Count < 100) errors.Add(new ImportError(rowNo, "No name.")); continue; }
            var email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();
            if (email is not null && !email.Contains('@')) { failed++; if (errors.Count < 100) errors.Add(new ImportError(rowNo, $"'{r.Email}' is not an email address.")); continue; }
            var code = string.IsNullOrWhiteSpace(r.Code) ? null : r.Code.Trim();
            WfEmployee? e = null;
            if (email is not null) byEmail.TryGetValue(email, out e);
            if (e is null && code is not null) byCode.TryGetValue(code, out e);
            var baseId = BaseOf(r.Base); var unitId = UnitOf(r.Unit);
            if (e is null)
            {
                e = new WfEmployee(r.Name!);
                e.Update(code, r.Name!, email, r.Phone, r.Designation, r.Department, r.Manager, baseId, unitId, true);
                e.MarkSynced("import");
                db.Employees.Add(e);
                if (email is not null) byEmail[email] = e;
                if (code is not null) byCode[code] = e;
                created++;
            }
            else
            {
                e.Update(code ?? e.Code, r.Name!, email ?? e.Email, r.Phone ?? e.Phone, r.Designation ?? e.Designation, r.Department ?? e.Department,
                    r.Manager ?? e.ManagerName, baseId ?? e.BaseId, unitId ?? e.UnitId, true);
                e.MarkSynced("import");
                updated++;
            }
            seen.Add(e.Id);
        }

        var deactivated = 0;
        if (c.IsFullList)
            foreach (var e in existing.Where(e => e.IsActive && e.Source != "manual" && !seen.Contains(e.Id))) { e.Deactivate(); deactivated++; }

        var settings = await Wf.SettingsAsync(db, ct);
        settings.MarkDirectoryRefreshed();
        Wf.Log(db, user, "directory.imported", "employee", null, null, $"{created} new, {updated} updated, {deactivated} no longer active, {failed} failed");
        await db.SaveChangesAsync(ct);
        return Result.Success(new ImportEmployeesResult(created, updated, deactivated, failed, errors));
    }
}

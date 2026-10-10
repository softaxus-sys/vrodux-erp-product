using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Catalogue;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Catalogue;

internal static class TitleReader
{
    public static async Task<TitleDetailDto> ToDetailAsync(LibraryDbContext db, BookTitle t, CancellationToken ct)
    {
        var copies = await db.Copies.AsNoTracking()
            .Where(c => c.TitleId == t.Id && !c.IsDeleted)
            .OrderBy(c => c.Barcode).ToListAsync(ct);
        var waiting = await db.Reservations.CountAsync(
            r => r.TitleId == t.Id && r.Status == ReservationStatus.Waiting, ct);

        return new TitleDetailDto(
            t.Id, t.Title, t.Subtitle, t.Authors, t.Isbn, t.Publisher, t.PublicationYear, t.Edition, t.Language,
            t.Category, t.MaterialType, t.Description, t.ReplacementCost, waiting,
            await CopyReader.ToDtosAsync(db, copies, ct));
    }

    public static Task<bool> BranchExistsAsync(LibraryDbContext db, Guid branchId, CancellationToken ct) =>
        db.Branches.AnyAsync(b => b.Id == branchId && !b.IsDeleted, ct);
}

// ── Titles ──────────────────────────────────────────────────────────────────

internal sealed class GetTitlesHandler(LibraryDbContext db) : IQueryHandler<GetTitlesQuery, PagedDto<TitleSummaryDto>>
{
    public async Task<Result<PagedDto<TitleSummaryDto>>> Handle(GetTitlesQuery q, CancellationToken ct)
    {
        var copies = db.Copies.AsNoTracking().Where(c => !c.IsDeleted);
        if (q.BranchId is { } branchId) copies = copies.Where(c => c.BranchId == branchId);

        var titles = db.Titles.AsNoTracking().Where(t => !t.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            // A scanned barcode finds the title it belongs to.
            titles = titles.Where(t =>
                t.Title.Contains(s) || t.Authors.Contains(s)
                || (t.Isbn != null && t.Isbn.Contains(s))
                || (t.Subtitle != null && t.Subtitle.Contains(s))
                || db.Copies.Any(c => c.TitleId == t.Id && !c.IsDeleted && c.Barcode == s));
        }

        if (!string.IsNullOrWhiteSpace(q.Category)) titles = titles.Where(t => t.Category == q.Category);

        // With a branch chosen, the list is that branch's shelf — not the whole catalogue.
        if (q.BranchId is not null) titles = titles.Where(t => copies.Any(c => c.TitleId == t.Id));
        if (q.AvailableOnly)
            titles = titles.Where(t => copies.Any(c => c.TitleId == t.Id && c.Status == CopyStatus.Available));

        var total    = await titles.CountAsync(ct);
        var pageSize = Math.Clamp(q.PageSize, 1, 200);
        var page     = Math.Max(q.Page, 1);

        var rows = await titles
            .OrderBy(t => t.Title)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(t => new
            {
                Title     = t,
                Total     = copies.Count(c => c.TitleId == t.Id),
                Available = copies.Count(c => c.TitleId == t.Id && c.Status == CopyStatus.Available),
                Waiting   = db.Reservations.Count(r => r.TitleId == t.Id && r.Status == ReservationStatus.Waiting),
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new TitleSummaryDto(
            r.Title.Id, r.Title.Title, r.Title.Subtitle, r.Title.Authors, r.Title.Isbn, r.Title.Category,
            r.Title.MaterialType, r.Title.Publisher, r.Title.PublicationYear, r.Title.Language,
            r.Total, r.Available, r.Waiting)).ToList();

        return Result.Success(new PagedDto<TitleSummaryDto>(items, total));
    }
}

internal sealed class GetTitleByIdHandler(LibraryDbContext db) : IQueryHandler<GetTitleByIdQuery, TitleDetailDto>
{
    public async Task<Result<TitleDetailDto>> Handle(GetTitleByIdQuery q, CancellationToken ct)
    {
        var title = await db.Titles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == q.Id && !t.IsDeleted, ct);
        return title is null
            ? Result.Failure<TitleDetailDto>(Error.NotFoundById("Title", q.Id))
            : Result.Success(await TitleReader.ToDetailAsync(db, title, ct));
    }
}

internal sealed class GetCategoriesHandler(LibraryDbContext db) : IQueryHandler<GetCategoriesQuery, IReadOnlyList<string>>
{
    public async Task<Result<IReadOnlyList<string>>> Handle(GetCategoriesQuery q, CancellationToken ct)
    {
        var categories = await db.Titles.AsNoTracking()
            .Where(t => !t.IsDeleted && t.Category != null)
            .Select(t => t.Category!).Distinct().OrderBy(c => c).ToListAsync(ct);
        return Result.Success<IReadOnlyList<string>>(categories);
    }
}

internal sealed class CreateTitleHandler(LibraryDbContext db) : ICommandHandler<CreateTitleCommand, TitleDetailDto>
{
    public async Task<Result<TitleDetailDto>> Handle(CreateTitleCommand cmd, CancellationToken ct)
    {
        // The same ISBN twice is almost always the same book entered again; its copies belong
        // on the existing title.
        if (!string.IsNullOrWhiteSpace(cmd.Isbn))
        {
            var isbn = cmd.Isbn.Trim();
            var existing = await db.Titles.AsNoTracking()
                .Where(t => !t.IsDeleted && t.Isbn == isbn).Select(t => t.Title).FirstOrDefaultAsync(ct);
            if (existing is not null)
                return Result.Failure<TitleDetailDto>(Error.Custom("Title.Duplicate",
                    $"\"{existing}\" already has ISBN {isbn}. Add copies to that title instead."));
        }

        if (cmd.Copies > 0 && !await TitleReader.BranchExistsAsync(db, cmd.BranchId!.Value, ct))
            return Result.Failure<TitleDetailDto>(Error.NotFoundById("Branch", cmd.BranchId!.Value));

        var title = new BookTitle(cmd.Title);
        title.SetDetails(cmd.Title, cmd.Subtitle, cmd.Authors, cmd.Isbn, cmd.Publisher, cmd.PublicationYear,
            cmd.Edition, cmd.Language, cmd.Category, cmd.MaterialType, cmd.Description, cmd.ReplacementCost);
        db.Titles.Add(title);

        if (cmd.Copies > 0)
            foreach (var barcode in await LibraryRules.NextBarcodesAsync(db, cmd.Copies, ct))
                db.Copies.Add(new BookCopy(title.Id, cmd.BranchId!.Value, barcode, cmd.ShelfLocation, cmd.ReplacementCost, null));

        await db.SaveChangesAsync(ct);
        return Result.Success(await TitleReader.ToDetailAsync(db, title, ct));
    }
}

internal sealed class UpdateTitleHandler(LibraryDbContext db) : ICommandHandler<UpdateTitleCommand, TitleDetailDto>
{
    public async Task<Result<TitleDetailDto>> Handle(UpdateTitleCommand cmd, CancellationToken ct)
    {
        var title = await db.Titles.FirstOrDefaultAsync(t => t.Id == cmd.Id && !t.IsDeleted, ct);
        if (title is null) return Result.Failure<TitleDetailDto>(Error.NotFoundById("Title", cmd.Id));

        if (!string.IsNullOrWhiteSpace(cmd.Isbn))
        {
            var isbn = cmd.Isbn.Trim();
            if (await db.Titles.AnyAsync(t => !t.IsDeleted && t.Id != cmd.Id && t.Isbn == isbn, ct))
                return Result.Failure<TitleDetailDto>(Error.Custom("Title.Duplicate",
                    $"Another title already has ISBN {isbn}."));
        }

        title.SetDetails(cmd.Title, cmd.Subtitle, cmd.Authors, cmd.Isbn, cmd.Publisher, cmd.PublicationYear,
            cmd.Edition, cmd.Language, cmd.Category, cmd.MaterialType, cmd.Description, cmd.ReplacementCost);
        await db.SaveChangesAsync(ct);
        return Result.Success(await TitleReader.ToDetailAsync(db, title, ct));
    }
}

internal sealed class DeleteTitleHandler(LibraryDbContext db) : ICommandHandler<DeleteTitleCommand>
{
    public async Task<Result> Handle(DeleteTitleCommand cmd, CancellationToken ct)
    {
        var title = await db.Titles.FirstOrDefaultAsync(t => t.Id == cmd.Id && !t.IsDeleted, ct);
        if (title is null) return Result.Failure(Error.NotFoundById("Title", cmd.Id));

        var copies = await db.Copies.Where(c => c.TitleId == cmd.Id && !c.IsDeleted).ToListAsync(ct);
        var out_   = copies.Count(c => c.Status == CopyStatus.OnLoan);
        if (out_ > 0)
            return Result.Failure(Error.Custom("Title.Conflict",
                $"{out_} copies of this title are out on loan. They must come back before it can be removed."));

        foreach (var copy in copies) copy.Delete();

        var open = await db.Reservations
            .Where(r => r.TitleId == cmd.Id
                        && (r.Status == ReservationStatus.Waiting || r.Status == ReservationStatus.Ready))
            .ToListAsync(ct);
        foreach (var r in open) r.Cancel();

        title.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Copies ──────────────────────────────────────────────────────────────────

internal sealed class GetCopyByBarcodeHandler(LibraryDbContext db) : IQueryHandler<GetCopyByBarcodeQuery, CopyDto>
{
    public async Task<Result<CopyDto>> Handle(GetCopyByBarcodeQuery q, CancellationToken ct)
    {
        var barcode = q.Barcode.Trim();
        var copy = await db.Copies.AsNoTracking().FirstOrDefaultAsync(c => !c.IsDeleted && c.Barcode == barcode, ct);
        return copy is null
            ? Result.Failure<CopyDto>(Error.Custom("Copy.NotFound", $"No copy has barcode \"{barcode}\"."))
            : Result.Success(await CopyReader.ToDtoAsync(db, copy, ct));
    }
}

internal sealed class GetCopiesInTransitHandler(LibraryDbContext db)
    : IQueryHandler<GetCopiesInTransitQuery, IReadOnlyList<CopyDto>>
{
    public async Task<Result<IReadOnlyList<CopyDto>>> Handle(GetCopiesInTransitQuery q, CancellationToken ct)
    {
        var copies = await db.Copies.AsNoTracking()
            .Where(c => !c.IsDeleted && c.Status == CopyStatus.InTransit)
            .OrderBy(c => c.UpdatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<CopyDto>>(await CopyReader.ToDtosAsync(db, copies, ct));
    }
}

internal sealed class AddCopiesHandler(LibraryDbContext db) : ICommandHandler<AddCopiesCommand, TitleDetailDto>
{
    public async Task<Result<TitleDetailDto>> Handle(AddCopiesCommand cmd, CancellationToken ct)
    {
        var title = await db.Titles.FirstOrDefaultAsync(t => t.Id == cmd.TitleId && !t.IsDeleted, ct);
        if (title is null) return Result.Failure<TitleDetailDto>(Error.NotFoundById("Title", cmd.TitleId));

        if (!await TitleReader.BranchExistsAsync(db, cmd.BranchId, ct))
            return Result.Failure<TitleDetailDto>(Error.NotFoundById("Branch", cmd.BranchId));

        List<string> barcodes;
        if (cmd.Barcodes is { Count: > 0 })
        {
            barcodes = cmd.Barcodes.Select(b => b.Trim()).ToList();

            var repeated = barcodes.GroupBy(b => b, StringComparer.OrdinalIgnoreCase).FirstOrDefault(g => g.Count() > 1);
            if (repeated is not null)
                return Result.Failure<TitleDetailDto>(Error.Custom("Copy.Duplicate",
                    $"Barcode \"{repeated.Key}\" is entered more than once."));

            var taken = await db.Copies.Where(c => !c.IsDeleted && barcodes.Contains(c.Barcode))
                                       .Select(c => c.Barcode).ToListAsync(ct);
            if (taken.Count > 0)
                return Result.Failure<TitleDetailDto>(Error.Custom("Copy.Duplicate",
                    $"Barcode already in use: {string.Join(", ", taken)}."));
        }
        else
        {
            barcodes = await LibraryRules.NextBarcodesAsync(db, cmd.Count, ct);
        }

        var acquiredOn = LibraryDates.Clean(cmd.AcquiredOn);
        var today      = LibraryDates.Today(null);
        foreach (var barcode in barcodes)
        {
            var copy = new BookCopy(title.Id, cmd.BranchId, barcode, cmd.ShelfLocation, cmd.Price, acquiredOn);
            db.Copies.Add(copy);
            // A new copy may be exactly what someone has been waiting for.
            await LibraryRules.HoldForNextReservationAsync(db, copy, today, ct);
            await db.SaveChangesAsync(ct);
        }

        return Result.Success(await TitleReader.ToDetailAsync(db, title, ct));
    }
}

internal sealed class UpdateCopyHandler(LibraryDbContext db) : ICommandHandler<UpdateCopyCommand, CopyDto>
{
    public async Task<Result<CopyDto>> Handle(UpdateCopyCommand cmd, CancellationToken ct)
    {
        var copy = await db.Copies.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (copy is null) return Result.Failure<CopyDto>(Error.NotFoundById("Copy", cmd.Id));

        var barcode = cmd.Barcode.Trim();
        if (await db.Copies.AnyAsync(c => !c.IsDeleted && c.Id != cmd.Id && c.Barcode == barcode, ct))
            return Result.Failure<CopyDto>(Error.Custom("Copy.Duplicate", $"Barcode \"{barcode}\" is already in use."));

        copy.Update(barcode, cmd.ShelfLocation, cmd.Condition, cmd.Price, LibraryDates.Clean(cmd.AcquiredOn), cmd.Notes);

        var status = cmd.Status?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(status) && status != copy.Status)
        {
            // On loan, held and in transit are set by circulation; changing them by hand would
            // leave a loan or a reservation pointing at a copy that says something else.
            if (!CopyStatus.Manual.Contains(copy.Status))
                return Result.Failure<CopyDto>(Error.Custom("Copy.Conflict",
                    $"This copy is {copy.Status.Replace('_', ' ')}. Its status changes when it is returned, collected or received."));
            if (!CopyStatus.Manual.Contains(status))
                return Result.Failure<CopyDto>(Error.Custom("Copy.InvalidStatus",
                    "A copy can be set to available, damaged, lost or withdrawn."));

            copy.SetStatus(status);
            await LibraryRules.HoldForNextReservationAsync(db, copy, LibraryDates.Today(null), ct);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(await CopyReader.ToDtoAsync(db, copy, ct));
    }
}

internal sealed class DeleteCopyHandler(LibraryDbContext db) : ICommandHandler<DeleteCopyCommand>
{
    public async Task<Result> Handle(DeleteCopyCommand cmd, CancellationToken ct)
    {
        var copy = await db.Copies.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (copy is null) return Result.Failure(Error.NotFoundById("Copy", cmd.Id));

        if (!CopyStatus.Manual.Contains(copy.Status))
            return Result.Failure(Error.Custom("Copy.Conflict",
                $"This copy is {copy.Status.Replace('_', ' ')} and cannot be removed yet."));

        copy.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class TransferCopyHandler(LibraryDbContext db) : ICommandHandler<TransferCopyCommand, CopyDto>
{
    public async Task<Result<CopyDto>> Handle(TransferCopyCommand cmd, CancellationToken ct)
    {
        var copy = await db.Copies.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (copy is null) return Result.Failure<CopyDto>(Error.NotFoundById("Copy", cmd.Id));

        if (copy.Status != CopyStatus.Available)
            return Result.Failure<CopyDto>(Error.Custom("Copy.Conflict",
                $"Only a copy that is on the shelf can be sent to another branch. This one is {copy.Status.Replace('_', ' ')}."));
        if (copy.BranchId == cmd.ToBranchId)
            return Result.Failure<CopyDto>(Error.Custom("Copy.Conflict", "The copy is already at that branch."));

        var target = await db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == cmd.ToBranchId && !b.IsDeleted, ct);
        if (target is null) return Result.Failure<CopyDto>(Error.NotFoundById("Branch", cmd.ToBranchId));
        if (!target.IsActive)
            return Result.Failure<CopyDto>(Error.Custom("Copy.Conflict", $"{target.Name} is inactive."));

        copy.SendTo(cmd.ToBranchId);
        await db.SaveChangesAsync(ct);
        return Result.Success(await CopyReader.ToDtoAsync(db, copy, ct));
    }
}

internal sealed class ReceiveCopyHandler(LibraryDbContext db) : ICommandHandler<ReceiveCopyCommand, CopyDto>
{
    public async Task<Result<CopyDto>> Handle(ReceiveCopyCommand cmd, CancellationToken ct)
    {
        var copy = await db.Copies.FirstOrDefaultAsync(c => c.Id == cmd.Id && !c.IsDeleted, ct);
        if (copy is null) return Result.Failure<CopyDto>(Error.NotFoundById("Copy", cmd.Id));

        if (copy.Status != CopyStatus.InTransit || copy.TransitToBranchId is not { } destination)
            return Result.Failure<CopyDto>(Error.Custom("Copy.Conflict", "This copy is not in transit."));

        copy.ShelveAt(destination);
        // Often the reason it was sent: someone at this branch is waiting for it.
        await LibraryRules.HoldForNextReservationAsync(db, copy, LibraryDates.Today(cmd.Today), ct);

        await db.SaveChangesAsync(ct);
        return Result.Success(await CopyReader.ToDtoAsync(db, copy, ct));
    }
}

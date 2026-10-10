using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Import;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Import;

internal static class ImportText
{
    public const int MaxErrors = 100;

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Descriptive fields are cut to fit rather than failing the row over a long publisher name.</summary>
    public static string? Fit(string? value, int max)
    {
        var v = Clean(value);
        return v is null || v.Length <= max ? v : v[..max];
    }

    /// <summary>Case- and spacing-insensitive key for matching names typed by different people.</summary>
    public static string Key(string? value) =>
        string.Join(' ', (value ?? string.Empty).Trim().ToLowerInvariant()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

    /// <summary>ISBNs are written with and without hyphens; they are the same number.</summary>
    public static string? IsbnKey(string? isbn)
    {
        var v = Clean(isbn);
        return v is null ? null : v.Replace("-", string.Empty).Replace(" ", string.Empty).ToUpperInvariant();
    }

    private static readonly string[] DateFormats =
    [
        "yyyy-MM-dd", "yyyy/MM/dd",
        // Day first: how dates are written by hand in the regions this product is sold in.
        "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "dd-MM-yyyy", "d.M.yyyy",
        "d MMM yyyy", "dd MMM yyyy", "d-MMM-yyyy", "dd-MMM-yyyy", "d MMMM yyyy",
    ];

    /// <summary>
    /// A date as yyyy-MM-dd, or null when it cannot be read. Never guesses: "03/04/2025" with a
    /// two-digit year or month-first order is refused rather than silently read a month out.
    /// </summary>
    public static string? Date(string? value)
    {
        var v = Clean(value);
        if (v is null) return null;
        return DateOnly.TryParseExact(v, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : null;
    }
}

internal sealed class ImportTitlesHandler(LibraryDbContext db) : ICommandHandler<ImportTitlesCommand, ImportResultDto>
{
    private static readonly char[] BarcodeSeparators = [',', ';', '|', '\n', '\r', '\t'];
    private static readonly string[] MaterialTypes = ["book", "reference", "journal", "magazine", "dvd", "audio", "other"];

    public async Task<Result<ImportResultDto>> Handle(ImportTitlesCommand cmd, CancellationToken ct)
    {
        // Everything the rows are matched against is read once, then kept current in memory, so a
        // thousand rows cost a handful of queries and rows within the file see each other.
        var branches = await db.Branches.Where(b => !b.IsDeleted).ToListAsync(ct);
        var branchByKey = new Dictionary<string, LibraryBranch>();
        foreach (var b in branches)
        {
            branchByKey.TryAdd(ImportText.Key(b.Name), b);
            if (b.Code is not null) branchByKey.TryAdd(ImportText.Key(b.Code), b);
        }
        var defaultBranch = branches.FirstOrDefault(b => b.Id == cmd.DefaultBranchId)
                            ?? branches.Where(b => b.IsActive).OrderBy(b => b.CreatedAt).FirstOrDefault();

        var known = await db.Titles.AsNoTracking().Where(t => !t.IsDeleted)
            .Select(t => new { t.Id, t.Isbn, t.Title, t.Authors }).ToListAsync(ct);
        var titleByIsbn = new Dictionary<string, Guid>();
        var titleByName = new Dictionary<string, Guid>();
        foreach (var t in known)
        {
            if (ImportText.IsbnKey(t.Isbn) is { } isbn) titleByIsbn.TryAdd(isbn, t.Id);
            titleByName.TryAdd(NameKey(t.Title, t.Authors), t.Id);
        }

        var barcodes = new HashSet<string>(
            await db.Copies.AsNoTracking().Where(c => !c.IsDeleted).Select(c => c.Barcode).ToListAsync(ct),
            StringComparer.OrdinalIgnoreCase);

        var held = (await db.Copies.AsNoTracking().Where(c => !c.IsDeleted)
                .GroupBy(c => new { c.TitleId, c.BranchId })
                .Select(g => new { g.Key.TitleId, g.Key.BranchId, Count = g.Count() }).ToListAsync(ct))
            .ToDictionary(x => (x.TitleId, x.BranchId), x => x.Count);

        var nextBarcode = await db.Copies.CountAsync(ct) + 1;

        int created = 0, existing = 0, copiesAdded = 0, failed = 0, branchesCreated = 0;
        var errors = new List<ImportRowError>();
        void Fail(int row, string message)
        {
            failed++;
            if (errors.Count < ImportText.MaxErrors) errors.Add(new ImportRowError(row, message));
        }

        foreach (var row in cmd.Rows)
        {
            var name = ImportText.Clean(row.Title);
            if (name is null) { Fail(row.Row, "Title is missing."); continue; }
            if (name.Length > 400) { Fail(row.Row, "Title is longer than 400 characters."); continue; }

            // ── Branch ──────────────────────────────────────────────────────
            LibraryBranch? branch;
            if (ImportText.Clean(row.Branch) is { } branchName)
            {
                if (!branchByKey.TryGetValue(ImportText.Key(branchName), out branch))
                {
                    if (!cmd.CreateBranches)
                    {
                        Fail(row.Row, $"Branch \"{branchName}\" does not exist.");
                        continue;
                    }
                    if (branchName.Length > 200) { Fail(row.Row, "Branch name is longer than 200 characters."); continue; }

                    branch = new LibraryBranch(branchName, null, null, null, null);
                    db.Branches.Add(branch);
                    branchByKey[ImportText.Key(branchName)] = branch;
                    branchesCreated++;
                }
            }
            else
            {
                branch = defaultBranch;
            }
            if (branch is null) { Fail(row.Row, "No branch given, and the library has no branch to default to."); continue; }

            // ── Barcodes (validated before anything is created for the row) ──
            var typed = (row.Barcodes ?? string.Empty)
                .Split(BarcodeSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (typed.FirstOrDefault(b => b.Length > 60) is { } tooLong)
            {
                Fail(row.Row, $"Barcode \"{tooLong[..20]}…\" is longer than 60 characters.");
                continue;
            }

            // ── Title: the same ISBN, or failing that the same title and author, is the same book ──
            var isbnKey = ImportText.IsbnKey(row.Isbn);
            var nameKey = NameKey(name, row.Authors);
            Guid titleId;
            if ((isbnKey is not null && titleByIsbn.TryGetValue(isbnKey, out titleId))
                || (isbnKey is null && titleByName.TryGetValue(nameKey, out titleId)))
            {
                existing++;
            }
            else
            {
                var material = ImportText.Clean(row.MaterialType)?.ToLowerInvariant();
                var title = new BookTitle(name);
                title.SetDetails(name, ImportText.Fit(row.Subtitle, 400), ImportText.Fit(row.Authors, 500),
                    ImportText.Fit(row.Isbn, 30), ImportText.Fit(row.Publisher, 200),
                    row.PublicationYear is >= 1000 and <= 2200 ? row.PublicationYear : null,
                    ImportText.Fit(row.Edition, 60), ImportText.Fit(row.Language, 60), ImportText.Fit(row.Category, 120),
                    material is not null && MaterialTypes.Contains(material) ? material : "book",
                    ImportText.Fit(row.Description, 4000), Math.Max(0, row.ReplacementCost ?? 0));
                db.Titles.Add(title);

                titleId = title.Id;
                if (isbnKey is not null) titleByIsbn[isbnKey] = titleId;
                titleByName.TryAdd(nameKey, titleId);
                created++;
            }

            // ── Copies ──────────────────────────────────────────────────────
            var price = Math.Max(0, row.Price ?? row.ReplacementCost ?? 0);
            var shelf = ImportText.Fit(row.ShelfLocation, 100);
            var have  = held.GetValueOrDefault((titleId, branch.Id));

            List<string> toAdd;
            if (typed.Count > 0)
            {
                // A barcode already in the library is a copy already imported — skipped, not an error.
                toAdd = typed.Where(b => !barcodes.Contains(b)).ToList();
            }
            else
            {
                // "Copies" is how many the branch should hold, not how many to add: importing the
                // same sheet again tops up to that number instead of doubling the shelf.
                var want = Math.Clamp(row.Copies ?? 1, 0, 500);
                toAdd = [];
                while (toAdd.Count < want - have)
                {
                    var candidate = $"BK{nextBarcode++:D6}";
                    if (!barcodes.Contains(candidate)) toAdd.Add(candidate);
                }
            }

            foreach (var barcode in toAdd)
            {
                db.Copies.Add(new BookCopy(titleId, branch.Id, barcode, shelf, price, null));
                barcodes.Add(barcode);
            }
            held[(titleId, branch.Id)] = have + toAdd.Count;
            copiesAdded += toAdd.Count;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new ImportResultDto(created, existing, copiesAdded, failed, branchesCreated, errors));
    }

    private static string NameKey(string title, string? authors) => $"{ImportText.Key(title)}|{ImportText.Key(authors)}";
}

internal sealed class ImportMembersHandler(LibraryDbContext db) : ICommandHandler<ImportMembersCommand, ImportResultDto>
{
    public async Task<Result<ImportResultDto>> Handle(ImportMembersCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);
        await LibraryDefaults.EnsureMembershipTypesAsync(db, ct);

        var types = await db.MembershipTypes.AsNoTracking().Where(t => !t.IsDeleted).ToListAsync(ct);
        var typeByKey = new Dictionary<string, MembershipType>();
        foreach (var t in types) typeByKey.TryAdd(ImportText.Key(t.Name), t);
        var defaultType = types.FirstOrDefault(t => t.Id == cmd.DefaultMembershipTypeId);

        var branchByKey = new Dictionary<string, Guid>();
        foreach (var b in await db.Branches.AsNoTracking().Where(b => !b.IsDeleted).ToListAsync(ct))
        {
            branchByKey.TryAdd(ImportText.Key(b.Name), b.Id);
            if (b.Code is not null) branchByKey.TryAdd(ImportText.Key(b.Code), b.Id);
        }

        var known = await db.Members.AsNoTracking().Where(m => !m.IsDeleted)
            .Select(m => new { m.MemberNumber, m.Email, m.FullName, m.Phone }).ToListAsync(ct);
        var numbers = new HashSet<string>(known.Select(m => m.MemberNumber), StringComparer.OrdinalIgnoreCase);
        var emails  = new HashSet<string>(known.Where(m => m.Email != null).Select(m => m.Email!), StringComparer.OrdinalIgnoreCase);
        var people  = new HashSet<string>(known.Where(m => m.Phone != null).Select(m => PersonKey(m.FullName, m.Phone!)));

        var nextNumber = await db.Members.CountAsync(ct) + 1;

        int created = 0, existing = 0, failed = 0;
        var errors = new List<ImportRowError>();
        void Fail(int row, string message)
        {
            failed++;
            if (errors.Count < ImportText.MaxErrors) errors.Add(new ImportRowError(row, message));
        }

        foreach (var row in cmd.Rows)
        {
            var name = ImportText.Clean(row.FullName);
            if (name is null) { Fail(row.Row, "Name is missing."); continue; }
            if (name.Length > 200) { Fail(row.Row, "Name is longer than 200 characters."); continue; }

            var number = ImportText.Clean(row.MemberNumber);
            var email  = ImportText.Clean(row.Email);
            var phone  = ImportText.Fit(row.Phone, 50);

            if (number is { Length: > 40 }) { Fail(row.Row, "Card number is longer than 40 characters."); continue; }
            if (email is not null && (!email.Contains('@') || email.Length > 320))
            {
                Fail(row.Row, $"Email \"{email}\" is not valid.");
                continue;
            }

            // Already a member? With a card number that is the test. Without one, the same email —
            // or the same name and phone — is taken to be the same person.
            var alreadyThere = number is not null
                ? numbers.Contains(number)
                : (email is not null && emails.Contains(email))
                  || (phone is not null && people.Contains(PersonKey(name, phone)));
            if (alreadyThere) { existing++; continue; }

            // An unknown type is refused rather than replaced: importing "Student" as "Standard"
            // would quietly give those members the wrong limits and fines.
            MembershipType? type;
            if (ImportText.Clean(row.MembershipType) is { } typeName)
            {
                if (!typeByKey.TryGetValue(ImportText.Key(typeName), out type))
                {
                    Fail(row.Row, $"Membership type \"{typeName}\" does not exist. Add it under Branches & Rules, or clear the column to use the default.");
                    continue;
                }
            }
            else
            {
                type = defaultType;
            }
            if (type is null) { Fail(row.Row, "No membership type given, and no default was chosen."); continue; }

            var joined = ImportText.Date(row.JoinedOn);
            if (joined is null && ImportText.Clean(row.JoinedOn) is { } badJoined)
            {
                Fail(row.Row, $"Joining date \"{badJoined}\" could not be read. Use YYYY-MM-DD or DD/MM/YYYY.");
                continue;
            }
            // A blank expiry means "does not expire"; an unreadable one must not be taken for blank.
            var expires = ImportText.Date(row.ExpiresOn);
            if (expires is null && ImportText.Clean(row.ExpiresOn) is { } badExpiry)
            {
                Fail(row.Row, $"Expiry date \"{badExpiry}\" could not be read. Use YYYY-MM-DD or DD/MM/YYYY.");
                continue;
            }

            if (number is null)
            {
                do { number = $"LM{nextNumber++:D5}"; } while (numbers.Contains(number));
            }

            Guid? homeBranch = ImportText.Clean(row.HomeBranch) is { } branchName
                               && branchByKey.TryGetValue(ImportText.Key(branchName), out var branchId)
                ? branchId
                : null;

            var status = ImportText.Key(row.Status) is "suspended" or "blocked" or "inactive"
                ? MemberStatus.Suspended
                : MemberStatus.Active;

            var member = new Member(number, name, type.Id, joined ?? today);
            member.SetDetails(number, name, email, phone, ImportText.Fit(row.Address, 500),
                ImportText.Fit(row.IdNumber, 60), type.Id, homeBranch, expires, status, ImportText.Fit(row.Notes, 2000));
            db.Members.Add(member);

            numbers.Add(number);
            if (email is not null) emails.Add(email);
            if (phone is not null) people.Add(PersonKey(name, phone));
            created++;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new ImportResultDto(created, existing, 0, failed, 0, errors));
    }

    private static string PersonKey(string name, string phone) =>
        $"{ImportText.Key(name)}|{new string(phone.Where(char.IsDigit).ToArray())}";
}

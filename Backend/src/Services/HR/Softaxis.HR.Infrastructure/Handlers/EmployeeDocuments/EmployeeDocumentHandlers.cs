using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.EmployeeDocuments.Commands;
using Softaxis.HR.Application.EmployeeDocuments.Dtos;
using Softaxis.HR.Application.EmployeeDocuments.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.EmployeeDocuments;

/// <summary>Object-storage plumbing for EmployeeDocument — same shape as RealEstate's
/// PropertyImageStorage, duplicated rather than shared because HR and RealEstate are separate
/// Infrastructure projects with no reference between them.</summary>
internal static class EmployeeDocumentStorage
{
    public static string BuildKey(Guid tenantId, Guid employeeId, Guid documentId) =>
        $"hr/{tenantId:N}/{employeeId:N}/{documentId:N}";

    public static async Task<EmployeeDocumentContentDto> LoadAsync(
        byte[] data, string fileName, string contentType, string? objectKey,
        IObjectStorage storage, CancellationToken ct)
    {
        if (objectKey is not null)
        {
            var file = await storage.GetAsync(objectKey, ct);
            if (file is not null) return new EmployeeDocumentContentDto(file.Data, fileName, file.ContentType);
        }
        return new EmployeeDocumentContentDto(data, fileName, contentType);
    }
}

internal static class EmployeeDocumentMappings
{
    /// <summary>The single Employee-document mapper. Never projects <c>Data</c>.</summary>
    public static EmployeeDocumentDto ToDto(EmployeeDocument d) => new(
        d.Id, d.EmployeeId, d.FileName, d.ContentType, d.SizeBytes,
        d.DocumentType, d.Description, d.ExpiryDate, d.UploadedByName, d.CreatedAt);
}

internal sealed class GetEmployeeDocumentsHandler(HrDbContext db)
    : IQueryHandler<GetEmployeeDocumentsQuery, IReadOnlyList<EmployeeDocumentDto>>
{
    public async Task<Result<IReadOnlyList<EmployeeDocumentDto>>> Handle(
        GetEmployeeDocumentsQuery query, CancellationToken ct)
    {
        // Metadata only — Data is deliberately absent from the projection so the blobs never
        // travel with a list request.
        var items = await db.EmployeeDocuments
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.EmployeeId == query.EmployeeId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new EmployeeDocumentDto(
                x.Id, x.EmployeeId, x.FileName, x.ContentType, x.SizeBytes,
                x.DocumentType, x.Description, x.ExpiryDate, x.UploadedByName, x.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<EmployeeDocumentDto>>(items);
    }
}

internal sealed class GetEmployeeDocumentContentHandler(HrDbContext db, IObjectStorage storage)
    : IQueryHandler<GetEmployeeDocumentContentQuery, EmployeeDocumentContentDto>
{
    public async Task<Result<EmployeeDocumentContentDto>> Handle(
        GetEmployeeDocumentContentQuery query, CancellationToken ct)
    {
        // Scoped by employee as well as id so a document id cannot be pulled through
        // another employee's route.
        var row = await db.EmployeeDocuments
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.Id == query.DocumentId && x.EmployeeId == query.EmployeeId)
            .Select(x => new { x.Data, x.FileName, x.ContentType, x.ObjectKey })
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return Result.Failure<EmployeeDocumentContentDto>(Error.NotFoundById("EmployeeDocument", query.DocumentId));

        return Result.Success(await EmployeeDocumentStorage.LoadAsync(
            row.Data, row.FileName, row.ContentType, row.ObjectKey, storage, ct));
    }
}

internal sealed class UploadEmployeeDocumentHandler(
    HrDbContext db, IObjectStorage storage, IImageProcessor imageProcessor,
    ILogger<UploadEmployeeDocumentHandler> logger)
    : ICommandHandler<UploadEmployeeDocumentCommand, EmployeeDocumentDto>
{
    public async Task<Result<EmployeeDocumentDto>> Handle(
        UploadEmployeeDocumentCommand cmd, CancellationToken ct)
    {
        var employeeExists = await db.Employees
            .AnyAsync(e => e.Id == cmd.EmployeeId && !e.IsDeleted, ct);
        if (!employeeExists)
            return Result.Failure<EmployeeDocumentDto>(Error.NotFoundById("Employee", cmd.EmployeeId));

        // Passport/visa photos routinely arrive at several MB from a phone camera; a scanned PDF
        // contract does not benefit (usually already compressed) and is left untouched — see
        // IImageProcessor's own remarks on why this is content-type gated, not blanket.
        var (data, contentType) = imageProcessor.IsCompressibleImage(cmd.ContentType)
            ? imageProcessor.Compress(cmd.Data, cmd.ContentType)
            : (cmd.Data, cmd.ContentType);

        var doc = new EmployeeDocument(
            cmd.EmployeeId, cmd.FileName, contentType, data,
            cmd.DocumentType, cmd.Description, cmd.ExpiryDate,
            cmd.UploadedByUserId, cmd.UploadedByName);

        if (storage.IsConfigured && TenantAmbient.TenantId is { } tenantId)
        {
            var key = EmployeeDocumentStorage.BuildKey(tenantId, cmd.EmployeeId, doc.Id);
            try
            {
                await storage.PutAsync(key, data, contentType, ct);
                doc.SetObjectKey(key); // clears Data — see EmployeeDocument.SetObjectKey
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Employee document upload to object storage failed (key {Key}, employee {EmployeeId})",
                    key, cmd.EmployeeId);
                return Result.Failure<EmployeeDocumentDto>(Error.Custom("EmployeeDocument.UploadFailed",
                    $"'{cmd.FileName}' could not be uploaded. Please try again."));
            }
        }

        db.EmployeeDocuments.Add(doc);
        await db.SaveChangesAsync(ct);

        return Result.Success(EmployeeDocumentMappings.ToDto(doc));
    }
}

internal sealed class UpdateEmployeeDocumentHandler(HrDbContext db)
    : ICommandHandler<UpdateEmployeeDocumentCommand>
{
    public async Task<Result> Handle(UpdateEmployeeDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.EmployeeDocuments.FirstOrDefaultAsync(
            x => x.Id == cmd.DocumentId && x.EmployeeId == cmd.EmployeeId && !x.IsDeleted, ct);
        if (doc is null)
            return Result.Failure(Error.NotFoundById("EmployeeDocument", cmd.DocumentId));

        doc.Update(cmd.DocumentType, cmd.Description, cmd.ExpiryDate);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteEmployeeDocumentHandler(HrDbContext db, IObjectStorage storage)
    : ICommandHandler<DeleteEmployeeDocumentCommand>
{
    public async Task<Result> Handle(DeleteEmployeeDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.EmployeeDocuments.FirstOrDefaultAsync(
            x => x.Id == cmd.DocumentId && x.EmployeeId == cmd.EmployeeId && !x.IsDeleted, ct);
        if (doc is null)
            return Result.Failure(Error.NotFoundById("EmployeeDocument", cmd.DocumentId));

        var objectKey = doc.ObjectKey;
        doc.Delete();
        await db.SaveChangesAsync(ct);

        // After, not before — the tenant's own delete must never be blocked by the bucket being
        // slow or unreachable. A failed bucket delete just leaves an orphaned object.
        if (objectKey is not null) await storage.DeleteAsync(objectKey, ct);

        return Result.Success();
    }
}

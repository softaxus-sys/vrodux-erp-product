using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.EmployeeDocuments.Commands;
using Softaxis.HR.Application.EmployeeDocuments.Dtos;
using Softaxis.HR.Application.EmployeeDocuments.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.EmployeeDocuments;

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

internal sealed class GetEmployeeDocumentContentHandler(HrDbContext db)
    : IQueryHandler<GetEmployeeDocumentContentQuery, EmployeeDocumentContentDto>
{
    public async Task<Result<EmployeeDocumentContentDto>> Handle(
        GetEmployeeDocumentContentQuery query, CancellationToken ct)
    {
        // Scoped by employee as well as id so a document id cannot be pulled through
        // another employee's route.
        var doc = await db.EmployeeDocuments
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.Id == query.DocumentId && x.EmployeeId == query.EmployeeId)
            .Select(x => new EmployeeDocumentContentDto(x.Data, x.FileName, x.ContentType))
            .FirstOrDefaultAsync(ct);

        return doc is null
            ? Result.Failure<EmployeeDocumentContentDto>(Error.NotFoundById("EmployeeDocument", query.DocumentId))
            : Result.Success(doc);
    }
}

internal sealed class UploadEmployeeDocumentHandler(HrDbContext db)
    : ICommandHandler<UploadEmployeeDocumentCommand, EmployeeDocumentDto>
{
    public async Task<Result<EmployeeDocumentDto>> Handle(
        UploadEmployeeDocumentCommand cmd, CancellationToken ct)
    {
        var employeeExists = await db.Employees
            .AnyAsync(e => e.Id == cmd.EmployeeId && !e.IsDeleted, ct);
        if (!employeeExists)
            return Result.Failure<EmployeeDocumentDto>(Error.NotFoundById("Employee", cmd.EmployeeId));

        var doc = new EmployeeDocument(
            cmd.EmployeeId, cmd.FileName, cmd.ContentType, cmd.Data,
            cmd.DocumentType, cmd.Description, cmd.ExpiryDate,
            cmd.UploadedByUserId, cmd.UploadedByName);

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

internal sealed class DeleteEmployeeDocumentHandler(HrDbContext db)
    : ICommandHandler<DeleteEmployeeDocumentCommand>
{
    public async Task<Result> Handle(DeleteEmployeeDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await db.EmployeeDocuments.FirstOrDefaultAsync(
            x => x.Id == cmd.DocumentId && x.EmployeeId == cmd.EmployeeId && !x.IsDeleted, ct);
        if (doc is null)
            return Result.Failure(Error.NotFoundById("EmployeeDocument", cmd.DocumentId));

        doc.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

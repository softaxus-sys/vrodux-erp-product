using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Application.Documents.Commands;
using Softaxis.CRM.Application.Documents.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Documents;

internal static class CrmDocumentMappings
{
    public static CrmDocumentDto ToDto(CrmDocument d) => new(
        d.Id, d.RelatedToType, d.RelatedToId, d.RelatedToName,
        d.FileName, d.ContentType, d.SizeBytes,
        d.DocumentType, d.Description, d.UploadedByName, d.CreatedAt);

    /// <summary>
    /// Denormalises the owning record's display name onto the document (same idea as
    /// <c>Activity.RelatedToName</c>) so document lists can be rendered without joining back to
    /// four different tables. Returns null when the record does not exist.
    /// </summary>
    public static async Task<string?> ResolveRelatedNameAsync(
        CrmDbContext db, string relatedToType, Guid relatedToId, CancellationToken ct)
        => relatedToType.Trim().ToLowerInvariant() switch
        {
            // NOTE: Lead.FullName / Contact.FullName are computed properties and cannot be used in
            // an EF projection — concatenate the stored columns instead.
            CrmDocumentTargets.Lead => await db.Leads
                .Where(x => x.Id == relatedToId && !x.IsDeleted)
                .Select(x => x.FirstName + " " + x.LastName).FirstOrDefaultAsync(ct),

            CrmDocumentTargets.Deal => await db.Deals
                .Where(x => x.Id == relatedToId && !x.IsDeleted)
                .Select(x => x.Title).FirstOrDefaultAsync(ct),

            CrmDocumentTargets.Customer => await db.Customers
                .Where(x => x.Id == relatedToId && !x.IsDeleted)
                .Select(x => x.Name).FirstOrDefaultAsync(ct),

            CrmDocumentTargets.Contact => await db.Contacts
                .Where(x => x.Id == relatedToId && !x.IsDeleted)
                .Select(x => x.FirstName + " " + x.LastName).FirstOrDefaultAsync(ct),

            _ => null,
        };
}

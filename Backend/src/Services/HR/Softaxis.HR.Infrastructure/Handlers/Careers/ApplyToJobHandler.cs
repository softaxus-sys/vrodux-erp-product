using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.HR.Application.Careers.Commands;
using Softaxis.HR.Application.Careers.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Careers;

internal sealed class ApplyToJobHandler(HrDbContext db)
    : ICommandHandler<ApplyToJobCommand, ApplyResultDto>
{
    public async Task<Result<ApplyResultDto>> Handle(ApplyToJobCommand cmd, CancellationToken ct)
    {
        var tenant = await CareersMappings.ResolveTenantAsync(db, cmd.TenantSlug, ct);
        if (tenant is null)
            return Result.Failure<ApplyResultDto>(Error.Custom("Company.NotFound", "Company not found."));

        var job = await db.JobPostings
            .FirstOrDefaultAsync(x => x.Id == cmd.JobId && x.Status == "open"
                && EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id, ct);
        if (job is null)
            return Result.Failure<ApplyResultDto>(Error.Custom("JobPosting.NotFound", "Job posting not found or no longer open."));

        var applicant = new Applicant(
            job.Id, job.Title, cmd.Name, cmd.Email, cmd.Phone, cmd.Nationality,
            cmd.CurrentRole, cmd.CurrentCompany, cmd.Experience ?? 0,
            "careers_portal", cmd.CoverNote);

        // Stamp the tenant directly — this request is anonymous, so TenantAmbient
        // is unresolved and StampTenantId() (called from SaveChangesAsync) is a no-op.
        db.Entry(applicant).Property(TenantIsolation.Column).CurrentValue = tenant.Id;

        if (cmd.Resume is not null)
        {
            var dir = Path.Combine(cmd.AppDataRoot, "resumes", tenant.Id.ToString());
            Directory.CreateDirectory(dir);

            var storedName = $"{applicant.Id}{cmd.Resume.Extension}";
            var fullPath = Path.Combine(dir, storedName);
            await using (var stream = File.Create(fullPath))
                await cmd.Resume.Content.CopyToAsync(stream, ct);

            applicant.AttachResume(cmd.Resume.FileName, Path.Combine("resumes", tenant.Id.ToString(), storedName));
        }

        job.IncrementApplicants();
        db.Applicants.Add(applicant);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ApplyResultDto(applicant.Id, "Application submitted successfully."));
    }
}

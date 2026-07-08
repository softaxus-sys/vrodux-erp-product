using System.Text;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaTypes.Commands;
using Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;
using Softaxis.VisaServices.Infrastructure.Persistence;
using DomainVisaType = Softaxis.VisaServices.Domain.Entities.VisaType;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaTypes;

internal sealed class CreateVisaTypeHandler(VisaDbContext db)
    : ICommandHandler<CreateVisaTypeCommand, VisaTypeDto>
{
    public async Task<Result<VisaTypeDto>> Handle(CreateVisaTypeCommand cmd, CancellationToken ct)
    {
        // Code is a per-tenant stable slug derived from the name (+ short suffix for uniqueness).
        var code = $"{Slug(cmd.Name)}-{Guid.NewGuid().ToString("N")[..4]}";
        var t = new DomainVisaType(code, cmd.Name, cmd.Category, cmd.Channel, cmd.DefaultGovtFee,
            cmd.DefaultServiceFee, cmd.ProcessingDays, cmd.RequiredDocuments);
        db.VisaTypes.Add(t);
        await db.SaveChangesAsync(ct);
        return Result.Success(VisaCaseMappings.ToDto(t));
    }

    private static string Slug(string name)
    {
        var sb = new StringBuilder();
        foreach (var ch in name.Trim().ToLowerInvariant())
            sb.Append(char.IsLetterOrDigit(ch) ? ch : '-');
        var slug = sb.ToString().Trim('-');
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        return string.IsNullOrEmpty(slug) ? "visa-type" : slug[..Math.Min(slug.Length, 40)];
    }
}

internal sealed class UpdateVisaTypeHandler(VisaDbContext db) : ICommandHandler<UpdateVisaTypeCommand>
{
    public async Task<Result> Handle(UpdateVisaTypeCommand cmd, CancellationToken ct)
    {
        var t = await db.VisaTypes.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (t is null)
            return Result.Failure(Error.NotFoundById("VisaType", cmd.Id));

        t.Update(cmd.Name, cmd.Category, cmd.Channel, cmd.DefaultGovtFee, cmd.DefaultServiceFee,
            cmd.ProcessingDays, cmd.RequiredDocuments);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteVisaTypeHandler(VisaDbContext db) : ICommandHandler<DeleteVisaTypeCommand>
{
    public async Task<Result> Handle(DeleteVisaTypeCommand cmd, CancellationToken ct)
    {
        var t = await db.VisaTypes.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (t is null)
            return Result.Failure(Error.NotFoundById("VisaType", cmd.Id));

        t.SetActive(false);   // soft delete — reads filter on IsActive
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.Abstractions;
using Softaxis.VisaServices.Application.Channels;
using Softaxis.VisaServices.Application.Channels.Commands;
using Softaxis.VisaServices.Application.Channels.Dtos;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.Channels;

internal sealed class ConnectChannelHandler(VisaDbContext db, IVisaSecretProtector protector)
    : ICommandHandler<ConnectChannelCommand>
{
    public async Task<Result> Handle(ConnectChannelCommand cmd, CancellationToken ct)
    {
        if (ChannelCatalogue.Find(cmd.Channel) is null)
            return Result.Failure(Error.Custom("Channel.NotFound", $"Unknown channel '{cmd.Channel}'."));

        var protectedSecret = protector.Protect(cmd.Secret);
        var acct = await db.ChannelAccounts.FirstOrDefaultAsync(a => a.Channel == cmd.Channel.ToLower(), ct);
        if (acct is null)
            db.ChannelAccounts.Add(new ChannelAccount(cmd.Channel, cmd.EstablishmentCard, cmd.AccountRef, protectedSecret));
        else
            acct.Update(cmd.EstablishmentCard, cmd.AccountRef, protectedSecret);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DisconnectChannelHandler(VisaDbContext db) : ICommandHandler<DisconnectChannelCommand>
{
    public async Task<Result> Handle(DisconnectChannelCommand cmd, CancellationToken ct)
    {
        var acct = await db.ChannelAccounts.FirstOrDefaultAsync(a => a.Channel == cmd.Channel.ToLower(), ct);
        if (acct is null) return Result.Success();   // already absent — idempotent
        acct.Disconnect();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class CreateSubmissionHandler(VisaDbContext db)
    : ICommandHandler<CreateSubmissionCommand, GovtSubmissionDto>
{
    public async Task<Result<GovtSubmissionDto>> Handle(CreateSubmissionCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.CaseId], ct);
        if (vcase is null || vcase.IsDeleted)
            return Result.Failure<GovtSubmissionDto>(Error.NotFoundById("VisaCase", cmd.CaseId));

        var sub = new GovtSubmission(cmd.CaseId, cmd.Channel, cmd.SubmissionType, cmd.ExternalReference, cmd.Notes);
        db.GovtSubmissions.Add(sub);
        db.CaseStatusEvents.Add(new CaseStatusEvent(cmd.CaseId, "submission", null, null,
            $"{cmd.SubmissionType} submitted via {cmd.Channel}" + (string.IsNullOrWhiteSpace(cmd.ExternalReference) ? "" : $" — {cmd.ExternalReference}"),
            cmd.ByName));

        await db.SaveChangesAsync(ct);
        return Result.Success(new GovtSubmissionDto(sub.Id, sub.VisaCaseId, sub.Channel, sub.SubmissionType,
            sub.ExternalReference, sub.Status, sub.Notes, sub.SubmittedAt, sub.UpdatedAt));
    }
}

internal sealed class UpdateSubmissionStatusHandler(VisaDbContext db)
    : ICommandHandler<UpdateSubmissionStatusCommand>
{
    public async Task<Result> Handle(UpdateSubmissionStatusCommand cmd, CancellationToken ct)
    {
        var sub = await db.GovtSubmissions.FirstOrDefaultAsync(s => s.Id == cmd.SubmissionId && s.VisaCaseId == cmd.CaseId, ct);
        if (sub is null) return Result.Failure(Error.NotFoundById("GovtSubmission", cmd.SubmissionId));

        sub.SetStatus(cmd.Status, cmd.ExternalReference, cmd.Notes);
        db.CaseStatusEvents.Add(new CaseStatusEvent(cmd.CaseId, "submission", null, null,
            $"{sub.SubmissionType} → {cmd.Status}", cmd.ByName));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

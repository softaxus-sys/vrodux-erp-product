using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;

namespace Softaxis.CRM.Application.PropertyFinderImport.Commands;

/// <summary>
/// Import the Property Finder lead history into this tenant's CRM.
///
/// <para><b>One lead per person PER AGENT, not per enquiry.</b> 6,962 enquiries in the connected
/// account are 6,040 person-and-agent pairs: buyers commonly message the same agent several times
/// about different listings, and 433 of them contacted more than one agent.</para>
///
/// <para>Repeat contact with the same agent merges — the most recent enquiry becomes the lead and
/// each earlier one is written as an <c>Activity</c>, so which listing, which channel and when all
/// stay on the timeline. Contact with a DIFFERENT agent does not merge: Property Finder gave each
/// of those agents an enquiry, so each gets their own lead to work. Merging on the phone number
/// alone handed the person to whichever agent was most recent and left the rest with nothing.</para>
///
/// <para><b>Ownership.</b> A lead references its agent only by <c>publicProfile.id</c>, so
/// <see cref="Assignments"/> carries the mapping from that id to the Vrodux user created for the
/// agent. Leads whose agent has left Property Finder (they no longer appear in the user list) fall
/// back to <see cref="FallbackUserId"/> rather than being silently left ownerless — an unowned
/// lead is invisible to everyone except full-access roles.</para>
///
/// <para>Re-runnable: intake dedupes on the Property Finder lead id, so a second run creates
/// nothing new. <see cref="DryRun"/> reports what would happen and writes nothing at all.</para>
/// </summary>
public sealed record ImportPropertyFinderLeadsCommand(
    IReadOnlyList<PfAgentAssignment> Assignments,
    Guid?   FallbackUserId,
    string? FallbackUserName,
    Guid?   TeamId,
    bool    DryRun,
    int     Skip = 0,
    int     Take = 250) : ICommand<PfLeadImportResultDto>;

public sealed class ImportPropertyFinderLeadsCommandValidator : AbstractValidator<ImportPropertyFinderLeadsCommand>
{
    public ImportPropertyFinderLeadsCommandValidator()
    {
        RuleFor(x => x.Assignments).NotNull();
        RuleForEach(x => x.Assignments).ChildRules(a =>
        {
            a.RuleFor(x => x.UserId).NotEmpty().WithMessage("Each mapped agent needs a Vrodux user.");
            a.RuleFor(x => x.UserName).NotEmpty();
        });
        RuleFor(x => x.FallbackUserName)
            .NotEmpty()
            .When(x => x.FallbackUserId is not null)
            .WithMessage("A fallback owner needs a display name.");
    }
}

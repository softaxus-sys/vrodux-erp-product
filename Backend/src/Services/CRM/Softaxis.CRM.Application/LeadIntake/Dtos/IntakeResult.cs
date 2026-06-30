namespace Softaxis.CRM.Application.LeadIntake.Dtos;

/// <summary>Outcome of pushing one canonical lead through the intake pipeline.</summary>
public sealed record IntakeResult(IntakeOutcome Outcome, Guid? LeadId, string? Message)
{
    public static IntakeResult Created(Guid leadId)        => new(IntakeOutcome.Created, leadId, null);
    public static IntakeResult Duplicate(Guid? existingId) => new(IntakeOutcome.Duplicate, existingId, "Duplicate lead — skipped.");
    public static IntakeResult Rejected(string message)    => new(IntakeOutcome.Rejected, null, message);
}

public enum IntakeOutcome
{
    Created,
    Duplicate,
    Rejected,
}

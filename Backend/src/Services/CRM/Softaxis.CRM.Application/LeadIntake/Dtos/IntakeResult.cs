namespace Softaxis.CRM.Application.LeadIntake.Dtos;

/// <summary>Outcome of pushing one canonical lead through the intake pipeline.</summary>
public sealed record IntakeResult(IntakeOutcome Outcome, Guid? LeadId, string? Message)
{
    public static IntakeResult Created(Guid leadId) => new(IntakeOutcome.Created, leadId, null);

    /// <summary>
    /// A repeat contact from someone already in the CRM: the existing lead was enriched rather than
    /// a second one created, and the new enquiry is on its timeline.
    ///
    /// <para>This exists because "duplicate — skipped" was silently losing real work. On a property
    /// portal a quarter of enquiries come from a number already known, usually the same day, as a
    /// buyer messages several agents at once. Dropping them meant the second and third agent were
    /// never told an enquiry had happened at all.</para>
    /// </summary>
    public static IntakeResult Updated(Guid leadId) => new(IntakeOutcome.Updated, leadId, null);

    /// <summary>The very same source record arriving twice — a genuine no-op.</summary>
    public static IntakeResult Duplicate(Guid? existingId) =>
        new(IntakeOutcome.Duplicate, existingId, "Already received — skipped.");

    public static IntakeResult Rejected(string message) => new(IntakeOutcome.Rejected, null, message);
}

public enum IntakeOutcome
{
    Created,
    /// <summary>An existing lead was enriched with a repeat contact.</summary>
    Updated,
    Duplicate,
    Rejected,
}

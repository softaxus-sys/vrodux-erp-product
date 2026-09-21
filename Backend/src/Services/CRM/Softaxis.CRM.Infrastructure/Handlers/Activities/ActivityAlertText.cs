namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

/// <summary>
/// Wording and deep links for activity assignment alerts, shared by create and update so the two
/// cannot drift into saying different things about the same event.
/// </summary>
internal static class ActivityAlertText
{
    /// <summary>"Task"/"Call"/… — the alert title reads better as the thing than as the word "activity".</summary>
    public static string Label(string type) => type switch
    {
        "call"    => "Call",
        "meeting" => "Meeting",
        "email"   => "Email",
        "note"    => "Note",
        _         => "Task",
    };

    /// <summary>
    /// Opens the RECORD the activity hangs off, not an activity screen — an activity is only
    /// meaningful next to the lead or deal it belongs to, and that is where it can be acted on.
    /// Falls back to the activities list when the relation is unrecognised.
    /// </summary>
    public static string LinkFor(string relatedToType, Guid relatedToId) => relatedToType switch
    {
        "lead"     => $"/crm/leads?lead={relatedToId}",
        "deal"     => $"/crm/pipeline?deal={relatedToId}",
        "customer" => $"/crm/customers?customer={relatedToId}",
        _          => "/crm/activities",
    };
}

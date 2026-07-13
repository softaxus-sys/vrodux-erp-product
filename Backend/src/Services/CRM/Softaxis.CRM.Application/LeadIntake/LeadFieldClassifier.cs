using Softaxis.CRM.Application.LeadIntake.Dtos;

namespace Softaxis.CRM.Application.LeadIntake;

/// <summary>
/// Classifies a source field NAME (from a Meta/webhook/CSV lead form) to a canonical lead field, by
/// normalized keyword matching — so real-world question names like "your_budget?",
/// "when_are_you_planning_to_buy?", "what_are_you_interested_in?", "whatsapp_number" are captured even
/// though they don't equal a fixed synonym. Used by every provider so field capture is robust without
/// the tenant having to hand-map each question.
/// </summary>
public static class LeadFieldClassifier
{
    /// <summary>Returns a <see cref="CanonicalLeadFields"/> target for a field name, or null if unknown.</summary>
    public static string? Classify(string? fieldName)
    {
        if (string.IsNullOrWhiteSpace(fieldName)) return null;
        var n = Normalize(fieldName);
        if (n.Length == 0) return null;

        // Order matters — most specific first.
        if (n.Contains("whatsapp"))                                                   return CanonicalLeadFields.WhatsApp;
        if (n.Contains("email") || n == "mail")                                       return CanonicalLeadFields.Email;
        if (n.Contains("firstname") || n == "fname")                                  return CanonicalLeadFields.FirstName;
        if (n.Contains("lastname") || n.Contains("surname") || n == "lname")          return CanonicalLeadFields.LastName;
        if (n.Contains("fullname") || n == "name" || n == "leadname" || n == "contactname") return CanonicalLeadFields.FullName;
        if (n.Contains("phone") || n.Contains("mobile") || n.Contains("contactnumber") || n.Contains("cellnumber")) return CanonicalLeadFields.Phone;
        if (n.Contains("budget") || n.Contains("pricerange") || n.Contains("yourprice")) return CanonicalLeadFields.Budget;
        // "when … buy/invest/purchase/plan/move" → timeframe.
        if (n.Contains("when") && (n.Contains("buy") || n.Contains("invest") || n.Contains("purchas") || n.Contains("plan") || n.Contains("move")))
                                                                                      return CanonicalLeadFields.Timeframe;
        if (n.Contains("timeframe") || n.Contains("timeline") || n.Contains("urgency")) return CanonicalLeadFields.Timeframe;
        if (n.Contains("interested") || n.Contains("buyingfor") || n.Contains("lookingfor")
            || n.Contains("propertytype") || n.Contains("unittype") || n.Contains("project")) return CanonicalLeadFields.InterestedIn;
        if (n.Contains("company") || n.Contains("organization") || n.Contains("organisation") || n.Contains("business")) return CanonicalLeadFields.Company;
        if (n.Contains("jobtitle") || n.Contains("designation"))                      return CanonicalLeadFields.Title;
        if (n.Contains("industry") || n.Contains("sector"))                           return CanonicalLeadFields.Industry;
        if (n.Contains("city") || n.Contains("town"))                                 return CanonicalLeadFields.City;
        if (n.Contains("country"))                                                    return CanonicalLeadFields.Country;
        if (n.Contains("formname"))                                                   return CanonicalLeadFields.FormName;
        if (n.Contains("campaign"))                                                   return CanonicalLeadFields.Campaign;
        if (n.Contains("message") || n.Contains("ask") || n.Contains("comment") || n.Contains("query")
            || n.Contains("question") || n.Contains("enquiry") || n.Contains("inquiry") || n.Contains("details") || n.Contains("note")) return CanonicalLeadFields.Message;
        return null;
    }

    /// <summary>Classify <paramref name="fieldName"/> and assign <paramref name="value"/> to the matching
    /// canonical field on <paramref name="lc"/> (only when that field is still empty — first writer wins).</summary>
    public static void Apply(CanonicalLead lc, string? fieldName, string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        switch (Classify(fieldName))
        {
            case CanonicalLeadFields.FirstName:    lc.FirstName    ??= value; break;
            case CanonicalLeadFields.LastName:     lc.LastName     ??= value; break;
            case CanonicalLeadFields.FullName:     lc.FullName     ??= value; break;
            case CanonicalLeadFields.Email:        lc.Email        ??= value; break;
            case CanonicalLeadFields.Phone:        lc.Phone        ??= value; break;
            case CanonicalLeadFields.WhatsApp:     lc.WhatsApp     ??= value; break;
            case CanonicalLeadFields.Company:      lc.Company      ??= value; break;
            case CanonicalLeadFields.Title:        lc.Title        ??= value; break;
            case CanonicalLeadFields.Industry:     lc.Industry     ??= value; break;
            case CanonicalLeadFields.City:         lc.City         ??= value; break;
            case CanonicalLeadFields.Country:      lc.Country      ??= value; break;
            case CanonicalLeadFields.InterestedIn: lc.InterestedIn ??= value; break;
            case CanonicalLeadFields.Budget:       lc.Budget       ??= value; break;
            case CanonicalLeadFields.Timeframe:    lc.Timeframe    ??= value; break;
            case CanonicalLeadFields.Message:      lc.Message      ??= value; break;
            case CanonicalLeadFields.FormName:     lc.FormName     ??= value; break;
            case CanonicalLeadFields.Campaign:     lc.Campaign     ??= value; break;
        }
    }

    private static string Normalize(string s)
    {
        Span<char> buf = stackalloc char[s.Length];
        var n = 0;
        foreach (var c in s) if (char.IsLetterOrDigit(c)) buf[n++] = char.ToLowerInvariant(c);
        return new string(buf[..n]);
    }
}

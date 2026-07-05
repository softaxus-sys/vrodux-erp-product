using System.Text;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Voice;

/// <summary>
/// Builds the per-call system prompt and greeting from the tenant's voice-agent persona plus the
/// lead's own form context — the personal touch ("you enquired about…") is what makes the call
/// feel like a real employee following up, not a robocall.
/// </summary>
internal static class VoiceCallPromptBuilder
{
    public static string BuildSystemPrompt(TenantVoiceSettings settings, ScheduledCall call)
    {
        var agent   = settings.AgentName ?? "Alex";
        var company = settings.CompanyName ?? "the company";
        var sb = new StringBuilder();

        sb.AppendLine($"You are {agent}, a friendly and professional representative of {company}, " +
                      "making a follow-up phone call to a person who just submitted an enquiry.");
        if (!string.IsNullOrEmpty(settings.Industry))
            sb.AppendLine($"The company operates in the {settings.Industry} industry — speak like an experienced {settings.Industry} agent.");
        if (!string.IsNullOrEmpty(settings.CompanyDescription))
            sb.AppendLine($"About the company: {settings.CompanyDescription}");
        sb.AppendLine();

        sb.AppendLine($"You are calling {call.LeadName}. They recently submitted an enquiry, so they expect to hear from the company.");
        if (!string.IsNullOrEmpty(call.LeadContext))
            sb.AppendLine($"What you know about them (from their enquiry): {call.LeadContext}");
        sb.AppendLine();

        sb.AppendLine("Your goals for this call, in order:");
        sb.AppendLine("1. Confirm you are speaking with the right person and thank them for their enquiry.");
        sb.AppendLine("2. Understand what they are looking for: their needs, budget, timeline, and preferences.");
        sb.AppendLine("3. Answer their questions using ONLY the knowledge below — never invent prices, availability, or commitments.");
        sb.AppendLine("4. If they are interested, tell them a team member will follow up shortly to take it further, and ask for their preferred time.");
        sb.AppendLine("5. If they ask for a callback, note the requested time. If they are not interested, thank them politely and end the call.");
        sb.AppendLine();

        if (!string.IsNullOrEmpty(settings.Knowledge))
        {
            sb.AppendLine("Knowledge you may use to answer questions:");
            sb.AppendLine(settings.Knowledge);
            sb.AppendLine();
        }

        sb.AppendLine("Rules: keep replies short and conversational (one or two sentences — this is a phone call). " +
                      "Never negotiate prices or make binding promises. Never reveal you are an AI unless directly asked; " +
                      "if asked directly, answer honestly. If the person is busy, offer to call back later. " +
                      "If you reach a voicemail, leave a brief message with the company name and say you will try again.");
        sb.Append($"Speak {LanguageName(call.Language)} throughout the call.");

        return sb.ToString();
    }

    public static string BuildFirstMessage(TenantVoiceSettings settings, ScheduledCall call)
    {
        var agent   = settings.AgentName ?? "Alex";
        var company = settings.CompanyName ?? "our company";
        var name    = FirstNameOf(call.LeadName);
        return string.IsNullOrEmpty(name)
            ? $"Hello! This is {agent} from {company}, calling about the enquiry you sent us. Is now a good time to talk?"
            : $"Hello, is this {name}? This is {agent} from {company}, calling about the enquiry you sent us. Is now a good time to talk?";
    }

    private static string FirstNameOf(string fullName)
    {
        var trimmed = fullName.Trim();
        if (trimmed.Length == 0) return "";
        var space = trimmed.IndexOf(' ');
        return space > 0 ? trimmed[..space] : trimmed;
    }

    private static string LanguageName(string code) => code switch
    {
        "ur" => "Urdu",
        "ar" => "Arabic",
        _    => "English",
    };
}

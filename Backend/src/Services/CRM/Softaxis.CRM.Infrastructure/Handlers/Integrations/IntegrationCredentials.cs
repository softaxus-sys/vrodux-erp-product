using System.Text.Json;
using System.Text.Json.Nodes;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// The small JSON envelope an integration's encrypted credentials are stored in.
///
/// <para>Field NAMES are surfaced to the client so a settings screen can say which credentials are
/// configured; values never leave the server.</para>
/// </summary>
internal static class IntegrationCredentials
{
    /// <summary>
    /// Marks that the provider issued the signing secret and it has been entered — as opposed to
    /// the placeholder generated when the integration was created, which every integration has.
    /// </summary>
    public const string ProviderSigningSecretField = "providerSigningSecret";

    /// <summary>The decrypted envelope with one field set. Tolerates null/blank/corrupt input.</summary>
    public static string With(string? decryptedEnvelope, string field, string value)
    {
        JsonObject obj;
        try
        {
            obj = string.IsNullOrWhiteSpace(decryptedEnvelope)
                ? []
                : JsonNode.Parse(decryptedEnvelope) as JsonObject ?? [];
        }
        catch (JsonException) { obj = []; }   // unreadable = start over rather than fail the save

        obj[field] = value;
        return obj.ToJsonString();
    }

    /// <summary>Which credential fields are present. Names only — never the values.</summary>
    public static IReadOnlyList<string> FieldNames(string? decryptedEnvelope)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(decryptedEnvelope)) return [];
            return JsonNode.Parse(decryptedEnvelope) is JsonObject obj
                ? [.. obj.Where(p => p.Value is not null).Select(p => p.Key)]
                : [];
        }
        catch (JsonException) { return []; }
    }
}

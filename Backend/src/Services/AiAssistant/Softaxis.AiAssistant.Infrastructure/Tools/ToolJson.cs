using System.Text.Json;
using System.Text.Json.Nodes;

namespace Softaxis.AiAssistant.Infrastructure.Tools;

/// <summary>
/// Argument readers shared by the hand-written tools (the ones whose body has a nested array of
/// line items, which the data-driven catalog cannot express). Every reader is total — a missing or
/// wrong-typed argument yields the empty/zero value rather than throwing, so a model that omits an
/// optional field produces a clean request instead of a tool crash.
/// </summary>
internal static class ToolJson
{
    public static string Str(JsonElement e, string key) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";

    public static decimal Num(JsonElement e, string key) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(key, out var v)
        && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? d : 0m;

    public static int Int(JsonElement e, string key) => (int)Num(e, key);

    /// <summary>The string value, or JSON null when blank — for nullable backend fields.</summary>
    public static JsonNode? StrOrNull(JsonElement e, string key)
    {
        var s = Str(e, key);
        return string.IsNullOrWhiteSpace(s) ? null : JsonValue.Create(s);
    }

    public static IEnumerable<JsonElement> Array(JsonElement e, string key) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Array
            ? v.EnumerateArray() : [];
}

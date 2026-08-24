using System.Text.Json;

namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// A capability the assistant can invoke. Each tool maps to a scoped action against tenant
/// data. Tools execute as the current user (their bearer token / permissions), so a tool can
/// never return data the caller isn't allowed to see, and can never cross tenants.
/// </summary>
public interface IAiTool
{
    /// <summary>Unique tool name the model calls (snake_case, e.g. "crm_list_leads").</summary>
    string Name { get; }

    /// <summary>Natural-language description — the model uses this to decide when to call it.</summary>
    string Description { get; }

    /// <summary>JSON Schema (object) for the tool's arguments.</summary>
    string ParametersJsonSchema { get; }

    /// <summary>
    /// True for pure reads. Mutating tools (false) require explicit human confirmation in
    /// interactive channels before they run.
    /// </summary>
    bool IsReadOnly { get; }

    /// <summary>Which module/agent this tool belongs to (e.g. "crm"). Drives call-by-name routing.</summary>
    string Agent { get; }

    /// <summary>
    /// True to offer this tool in "Auto" mode (no agent picked/detected). Every tool must decide
    /// explicitly — there's no default — because Auto mode's total tool-schema payload goes into
    /// every request as JSON, and on a small-TPM free-tier model that payload alone can exceed the
    /// token budget once dozens of tools exist (this is exactly what happened when the tool catalog
    /// grew from ~12 to 65+: an "Auto" query started tripping Groq's TPM limit before the model even
    /// saw the user's question). Keep this true only for the small, cheap, cross-module read/summary
    /// set that answers general questions; every write tool and every deep/module-specific read
    /// should be false and only reachable once the user (or the text/call-by-name heuristic) has
    /// named a specific agent — see AiOrchestrator.DetectAgent and the agent picker in the chat UI.
    /// </summary>
    bool IncludeInAutoMode { get; }

    /// <summary>Permission the caller must hold for this tool to be offered/executed (null = any authenticated user).</summary>
    string? RequiredPermission { get; }

    /// <summary>Execute the tool and return a result string (typically JSON) to feed back to the model.</summary>
    Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct);
}

/// <summary>Supplies the set of tools available for a given agent + caller.</summary>
public interface IAiToolRegistry
{
    /// <summary>
    /// Tools the caller may use, optionally filtered to a named agent (e.g. "crm"). Tools whose
    /// <see cref="IAiTool.RequiredPermission"/> the caller lacks are excluded.
    /// </summary>
    IReadOnlyList<IAiTool> GetTools(string? agent);

    /// <summary>Resolve a tool by name for execution (null if unknown or not permitted).</summary>
    IAiTool? Resolve(string name);
}

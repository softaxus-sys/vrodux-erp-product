namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>
/// One field of a generic create tool's body. <see cref="JsonType"/> is a JSON-Schema primitive
/// type ("string" | "number" | "integer" | "boolean"). <see cref="DefaultRaw"/> (parsed back into
/// the right JSON kind at execution time) lets a field be required by the backend command but
/// optional for the model to specify — e.g. "isActive" defaults to true so the AI never has to
/// think about it unless the user says otherwise.
/// </summary>
public sealed record AiFieldSpec(
    string Name,
    string JsonType,
    string Description,
    bool Required = false,
    string? DefaultRaw = null);

/// <summary>A read-only "list everything" tool over one module resource.</summary>
public sealed record AiListSpec(
    string ToolName,
    string Description,
    string Agent,
    string Path,
    string Permission);

/// <summary>A read-only "get one by id" tool over one module resource.</summary>
public sealed record AiGetByIdSpec(
    string ToolName,
    string Description,
    string Agent,
    string PathTemplate, // contains literal "{id}"
    string IdParamName,
    string Permission);

/// <summary>
/// A WRITE "create one" tool with a flat (no nested object arrays) body — held for user
/// confirmation before it runs, same as every other write tool (IsReadOnly = false is the only
/// thing the orchestrator needs to gate a tool behind confirm/reject; see AiOrchestrator).
/// </summary>
public sealed record AiCreateSpec(
    string ToolName,
    string Description,
    string Agent,
    string Path,
    string Permission,
    IReadOnlyList<AiFieldSpec> Fields);

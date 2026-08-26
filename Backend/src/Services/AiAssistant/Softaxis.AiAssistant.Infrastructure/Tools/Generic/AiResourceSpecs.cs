namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>
/// One field of a generic tool's body (or, for the write specs, a path placeholder — see
/// <see cref="AiActionSpec"/>). <see cref="JsonType"/> is a JSON-Schema primitive type
/// ("string" | "number" | "integer" | "boolean"). <see cref="DefaultRaw"/> (parsed back into the
/// right JSON kind at execution time) lets a field be required by the backend command but
/// optional for the model to specify — e.g. "isActive" defaults to true so the AI never has to
/// think about it unless the user says otherwise.
/// </summary>
public sealed record AiFieldSpec(
    string Name,
    string JsonType,
    string Description,
    bool Required = false,
    string? DefaultRaw = null);

/// <summary>
/// A read-only "list everything" tool over one module resource. <see cref="QueryParams"/> become
/// optional (unless marked required) querystring arguments — some list endpoints genuinely need
/// one (issues are always scoped to a project), and the rest benefit from letting the model filter
/// server-side instead of pulling everything and hitting the tool-output cap.
/// </summary>
public sealed record AiListSpec(
    string ToolName,
    string Description,
    string Agent,
    string Path,
    /// <summary>Null = any authenticated user with the module (shared lookup feeds that every form needs).</summary>
    string? Permission,
    IReadOnlyList<AiFieldSpec>? QueryParams = null);

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

/// <summary>
/// A WRITE "modify an existing record" tool. Almost every PUT endpoint in this codebase REPLACES
/// the whole record, so sending only the one field the user asked to change would blank everything
/// else. <see cref="GenericUpdateTool"/> therefore reads the record first and merges the model's
/// fields over it, which is why <see cref="Fields"/> only needs to list the fields worth exposing
/// to the model rather than the endpoint's entire request shape.
/// <para>
/// <see cref="PathTemplate"/> contains "{id}" and is used for both the read and the write unless
/// <see cref="GetPathTemplate"/> overrides the read.
/// </para>
/// </summary>
public sealed record AiUpdateSpec(
    string ToolName,
    string Description,
    string Agent,
    string PathTemplate,
    string Permission,
    IReadOnlyList<AiFieldSpec> Fields,
    string Method = "PUT",
    string? GetPathTemplate = null,
    string IdParamName = "id");

/// <summary>
/// A WRITE "run one operation on a record" tool — approve, reject, change status, move stage, and
/// so on. Any "{placeholder}" in <see cref="PathTemplate"/> is filled from the same-named field in
/// <see cref="Fields"/> and then excluded from the body, so one field list drives both the route
/// and the payload.
/// <para>
/// <see cref="RawBodyField"/> covers the handful of endpoints that bind a bare value
/// (<c>[FromBody] string status</c>) rather than an object: the named field's value is posted on
/// its own instead of being wrapped in a JSON object.
/// </para>
/// </summary>
public sealed record AiActionSpec(
    string ToolName,
    string Description,
    string Agent,
    string Method, // POST | PATCH | PUT
    string PathTemplate,
    string Permission,
    IReadOnlyList<AiFieldSpec> Fields,
    string? RawBodyField = null);

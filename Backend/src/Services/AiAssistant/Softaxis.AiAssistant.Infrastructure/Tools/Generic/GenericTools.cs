using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>
/// Shared JSON-Schema construction and argument reading for the data-driven tools. Both the schema
/// the model sees and the body sent to the gateway are built from the same <see cref="AiFieldSpec"/>
/// list, so they can never drift apart.
/// </summary>
/// <summary>
/// Sentinel <see cref="AiFieldSpec.DefaultRaw"/> values that the tool fills from the caller's own
/// identity instead of asking the model for them. Several endpoints require an "approverId" /
/// "requestedBy" / "by" that is simply *whoever is doing this* — a value the model cannot know and
/// would otherwise invent a GUID for. Fields defaulted this way are deliberately left out of the
/// JSON schema entirely, so the model is never even tempted to supply one.
/// </summary>
public static class AiFieldDefaults
{
    public const string CurrentUserId   = "@me.id";
    public const string CurrentUserName = "@me.name";

    internal static bool IsToken(string? defaultRaw) => defaultRaw is not null && defaultRaw.StartsWith('@');
}

internal static class AiFieldJson
{
    public static string BuildSchema(IEnumerable<AiFieldSpec> fields)
    {
        var props = new JsonObject();
        var required = new JsonArray();
        foreach (var f in fields)
        {
            if (AiFieldDefaults.IsToken(f.DefaultRaw)) continue; // filled from the caller, never asked for
            props[f.Name] = new JsonObject
            {
                ["type"]        = f.JsonType,
                ["description"] = f.Description,
            };
            if (f.Required) required.Add(f.Name);
        }
        return new JsonObject
        {
            ["type"]                 = "object",
            ["properties"]           = props,
            ["required"]             = required,
            ["additionalProperties"] = false,
        }.ToJsonString();
    }

    /// <summary>The argument the model supplied, coerced to the field's JSON type (null if absent/blank/wrong kind).</summary>
    public static JsonNode? Read(JsonElement args, AiFieldSpec f)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(f.Name, out var v))
            return null;

        return f.JsonType switch
        {
            "number" or "integer" => v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? JsonValue.Create(d) : null,
            "boolean"             => v.ValueKind is JsonValueKind.True or JsonValueKind.False ? JsonValue.Create(v.GetBoolean()) : null,
            _                     => v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? JsonValue.Create(v.GetString()) : null,
        };
    }

    public static JsonNode? Default(AiFieldSpec f, ICurrentUser user)
    {
        if (f.DefaultRaw is null) return null;
        if (AiFieldDefaults.IsToken(f.DefaultRaw))
            return f.DefaultRaw switch
            {
                AiFieldDefaults.CurrentUserId   => user.Id is { } id ? JsonValue.Create(id.ToString()) : null,
                AiFieldDefaults.CurrentUserName => JsonValue.Create(user.Username ?? user.Email ?? ""),
                _                               => null,
            };

        return f.JsonType switch
        {
            "number" or "integer" => JsonValue.Create(decimal.Parse(f.DefaultRaw)),
            "boolean"             => JsonValue.Create(bool.Parse(f.DefaultRaw)),
            _                     => JsonValue.Create(f.DefaultRaw),
        };
    }

    /// <summary>The value to send for a field: a caller-identity token wins, then the model's argument, then a literal default.</summary>
    public static JsonNode? Resolve(JsonElement args, AiFieldSpec f, ICurrentUser user) =>
        AiFieldDefaults.IsToken(f.DefaultRaw)
            ? Default(f, user)
            : Read(args, f) ?? Default(f, user);

    /// <summary>Raw string value of an argument, for path/query substitution.</summary>
    public static string ReadRaw(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v))
            return "";
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString() ?? "",
            JsonValueKind.Null or JsonValueKind.Undefined => "",
            _ => v.ToString(),
        };
    }
}

/// <summary>Data-driven "list everything" tool, with optional querystring filters. See <see cref="AiListSpec"/>.</summary>
public sealed class GenericListTool(AiListSpec spec, GatewayToolClient gateway) : IAiTool
{
    public string  Name                 => spec.ToolName;
    public string  Description          => spec.Description;
    public string  Agent                => spec.Agent;
    public bool    IsReadOnly           => true;
    public bool    IncludeInAutoMode    => false; // part of the large catalog — keep Auto mode's payload small
    public string? RequiredPermission   => spec.Permission;
    public string  ParametersJsonSchema => AiFieldJson.BuildSchema(spec.QueryParams ?? []);

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var path = spec.Path;
        if (spec.QueryParams is { Count: > 0 })
        {
            // A param named in the path (e.g. ".../projects/{projectId}/columns") is a route
            // segment, not a querystring entry — same rule as GenericActionTool, so one param list
            // can describe either shape.
            foreach (var p in spec.QueryParams)
            {
                var placeholder = $"{{{p.Name}}}";
                if (!path.Contains(placeholder, StringComparison.Ordinal)) continue;
                var raw = AiFieldJson.ReadRaw(arguments, p.Name);
                if (string.IsNullOrWhiteSpace(raw))
                    return Task.FromResult($"{{\"error\":\"'{p.Name}' is required for this list.\"}}");
                path = path.Replace(placeholder, Uri.EscapeDataString(raw));
            }

            var query = spec.QueryParams
                .Where(p => !spec.Path.Contains($"{{{p.Name}}}", StringComparison.Ordinal))
                .Select(p => (p.Name, Value: AiFieldJson.ReadRaw(arguments, p.Name)))
                .Where(p => !string.IsNullOrWhiteSpace(p.Value))
                .Select(p => $"{Uri.EscapeDataString(p.Name)}={Uri.EscapeDataString(p.Value)}")
                .ToList();
            if (query.Count > 0)
                path += (path.Contains('?') ? "&" : "?") + string.Join("&", query);
        }
        return gateway.GetAsync(path, ct);
    }
}

/// <summary>Data-driven "get one by id" tool. See <see cref="AiGetByIdSpec"/>.</summary>
public sealed class GenericGetByIdTool(AiGetByIdSpec spec, GatewayToolClient gateway) : IAiTool
{
    public string  Name                 => spec.ToolName;
    public string  Description          => spec.Description;
    public string  Agent                => spec.Agent;
    public bool    IsReadOnly           => true;
    public bool    IncludeInAutoMode    => false; // deep single-record read, needs an id — not general-question-worthy
    public string? RequiredPermission   => spec.Permission;
    public string  ParametersJsonSchema =>
        AiFieldJson.BuildSchema([new AiFieldSpec(spec.IdParamName, "string", "The record's id (GUID)", true)]);

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var id = AiFieldJson.ReadRaw(arguments, spec.IdParamName);
        return gateway.GetAsync(spec.PathTemplate.Replace("{id}", Uri.EscapeDataString(id)), ct);
    }
}

/// <summary>Data-driven "create one" WRITE tool with a flat body. See <see cref="AiCreateSpec"/>.</summary>
public sealed class GenericCreateTool(AiCreateSpec spec, GatewayToolClient gateway, ICurrentUser currentUser) : IAiTool
{
    public string  Name                 => spec.ToolName;
    public string  Description          => spec.Description;
    public string  Agent                => spec.Agent;
    public bool    IsReadOnly           => false;
    public bool    IncludeInAutoMode    => false; // write — reached via use_module or by naming the agent
    public string? RequiredPermission   => spec.Permission;
    public string  ParametersJsonSchema => AiFieldJson.BuildSchema(spec.Fields);

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var body = new JsonObject();
        foreach (var f in spec.Fields)
        {
            var node = AiFieldJson.Resolve(arguments, f, currentUser);
            if (node is not null || f.DefaultRaw is not null)
                body[f.Name] = node;
        }
        return gateway.PostAsync(spec.Path, body.ToJsonString(), ct);
    }
}

/// <summary>
/// Data-driven "modify an existing record" WRITE tool. Reads the record, merges the model's fields
/// over the current values, then writes the whole thing back — see <see cref="AiUpdateSpec"/> for
/// why a partial PUT would be destructive here. Merging from the full read result (rather than
/// re-listing every field of the endpoint's request shape) also preserves what a flat field list
/// cannot express, such as tag arrays, without the model having to restate it.
/// </summary>
public sealed class GenericUpdateTool(AiUpdateSpec spec, GatewayToolClient gateway) : IAiTool
{
    public string  Name               => spec.ToolName;
    public string  Description        => spec.Description;
    public string  Agent              => spec.Agent;
    public bool    IsReadOnly         => false;
    public bool    IncludeInAutoMode  => false;
    public string? RequiredPermission => spec.Permission;

    public string ParametersJsonSchema => AiFieldJson.BuildSchema(
        new[] { new AiFieldSpec(spec.IdParamName, "string", "Id (GUID) of the record to update (required)", true) }
            .Concat(spec.Fields));

    public async Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var id = AiFieldJson.ReadRaw(arguments, spec.IdParamName);
        if (string.IsNullOrWhiteSpace(id))
            return $"{{\"error\":\"'{spec.IdParamName}' is required — look the record up first to get its id.\"}}";

        var encoded  = Uri.EscapeDataString(id);
        var readPath = (spec.GetPathTemplate ?? spec.PathTemplate).Replace("{id}", encoded);
        var current  = await gateway.GetAsync(readPath, ct);

        JsonObject? body = null;
        try
        {
            body = JsonNode.Parse(current) as JsonObject;
            // POS wraps every response in ApiResponse<T> ({ success, data, ... }); merging the
            // envelope instead of the record would send back a body with none of the real fields.
            if (body is not null && body["data"] is JsonObject wrapped)
                body = wrapped.DeepClone() as JsonObject;
        }
        catch { /* handled below */ }

        if (body is null)
            // The read failed (404/403) or returned something that is not a single record — say so
            // rather than writing a body assembled only from what the model guessed.
            return $"{{\"error\":\"Could not read the current record to update it.\",\"detail\":{JsonSerializer.Serialize(current)}}}";

        var changed = false;
        foreach (var f in spec.Fields)
        {
            var node = AiFieldJson.Read(arguments, f);
            if (node is null) continue;
            body[f.Name] = node;
            changed = true;
        }

        if (!changed)
            return "{\"error\":\"No fields to change were supplied. Say which field(s) to update.\"}";

        var writePath = spec.PathTemplate.Replace("{id}", encoded);
        return await gateway.SendJsonAsync(spec.Method, writePath, body.ToJsonString(), ct);
    }
}

/// <summary>
/// Data-driven "run one operation on a record" WRITE tool — approve, reject, change status, move
/// stage, and so on. See <see cref="AiActionSpec"/>.
/// </summary>
public sealed class GenericActionTool(AiActionSpec spec, GatewayToolClient gateway, ICurrentUser currentUser) : IAiTool
{
    public string  Name                 => spec.ToolName;
    public string  Description          => spec.Description;
    public string  Agent                => spec.Agent;
    public bool    IsReadOnly           => false;
    public bool    IncludeInAutoMode    => false;
    public string? RequiredPermission   => spec.Permission;
    public string  ParametersJsonSchema => AiFieldJson.BuildSchema(spec.Fields);

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var path    = spec.PathTemplate;
        var body    = new JsonObject();
        string? rawBody = null;

        foreach (var f in spec.Fields)
        {
            var placeholder = $"{{{f.Name}}}";
            if (path.Contains(placeholder, StringComparison.Ordinal))
            {
                var raw = AiFieldJson.ReadRaw(arguments, f.Name);
                if (string.IsNullOrWhiteSpace(raw))
                    return Task.FromResult($"{{\"error\":\"'{f.Name}' is required — look the record up first to get its id.\"}}");
                path = path.Replace(placeholder, Uri.EscapeDataString(raw));
                continue; // path parameter, never also a body field
            }

            var node = AiFieldJson.Resolve(arguments, f, currentUser);
            if (spec.RawBodyField == f.Name)
            {
                if (node is null) return Task.FromResult($"{{\"error\":\"'{f.Name}' is required.\"}}");
                rawBody = node.ToJsonString();
            }
            else if (node is not null || f.DefaultRaw is not null)
            {
                body[f.Name] = node;
            }
        }

        return gateway.SendJsonAsync(spec.Method, path, rawBody ?? body.ToJsonString(), ct);
    }
}

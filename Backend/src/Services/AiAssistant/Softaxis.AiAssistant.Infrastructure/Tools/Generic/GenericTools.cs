using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>Data-driven "list everything" tool — GETs a fixed path, no arguments. See <see cref="AiListSpec"/>.</summary>
public sealed class GenericListTool(AiListSpec spec, GatewayToolClient gateway) : IAiTool
{
    public string  Name                => spec.ToolName;
    public string  Description         => spec.Description;
    public string  Agent               => spec.Agent;
    public bool    IsReadOnly          => true;
    public string? RequiredPermission  => spec.Permission;
    public string  ParametersJsonSchema => """{"type":"object","properties":{},"additionalProperties":false}""";

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct) =>
        gateway.GetAsync(spec.Path, ct);
}

/// <summary>Data-driven "get one by id" tool. See <see cref="AiGetByIdSpec"/>.</summary>
public sealed class GenericGetByIdTool(AiGetByIdSpec spec, GatewayToolClient gateway) : IAiTool
{
    public string  Name                => spec.ToolName;
    public string  Description         => spec.Description;
    public string  Agent               => spec.Agent;
    public bool    IsReadOnly          => true;
    public string? RequiredPermission  => spec.Permission;
    public string ParametersJsonSchema
    {
        get
        {
            var schema = new JsonObject
            {
                ["type"] = "object",
                ["properties"] = new JsonObject
                {
                    [spec.IdParamName] = new JsonObject { ["type"] = "string", ["description"] = "The record's id (GUID)" },
                },
                ["required"]             = new JsonArray(spec.IdParamName),
                ["additionalProperties"] = false,
            };
            return schema.ToJsonString();
        }
    }

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var id = arguments.ValueKind == JsonValueKind.Object
                 && arguments.TryGetProperty(spec.IdParamName, out var v) && v.ValueKind == JsonValueKind.String
                    ? v.GetString() ?? "" : "";
        return gateway.GetAsync(spec.PathTemplate.Replace("{id}", Uri.EscapeDataString(id)), ct);
    }
}

/// <summary>
/// Data-driven "create one" WRITE tool with a flat body. Builds both the JSON-Schema the model
/// sees and the JSON body posted to the gateway from the same <see cref="AiFieldSpec"/> list, so
/// they can never drift apart. See <see cref="AiCreateSpec"/>.
/// </summary>
public sealed class GenericCreateTool(AiCreateSpec spec, GatewayToolClient gateway) : IAiTool
{
    public string  Name                => spec.ToolName;
    public string  Description         => spec.Description;
    public string  Agent               => spec.Agent;
    public bool    IsReadOnly          => false;
    public string? RequiredPermission  => spec.Permission;

    public string ParametersJsonSchema
    {
        get
        {
            var props = new JsonObject();
            var required = new JsonArray();
            foreach (var f in spec.Fields)
            {
                props[f.Name] = new JsonObject
                {
                    ["type"]        = f.JsonType,
                    ["description"] = f.Description,
                };
                if (f.Required) required.Add(f.Name);
            }
            var schema = new JsonObject
            {
                ["type"]                 = "object",
                ["properties"]           = props,
                ["required"]             = required,
                ["additionalProperties"] = false,
            };
            return schema.ToJsonString();
        }
    }

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var body = new JsonObject();
        foreach (var f in spec.Fields)
        {
            var node = ReadValue(arguments, f) ?? DefaultValue(f);
            if (node is not null || f.DefaultRaw is not null)
                body[f.Name] = node;
        }
        return gateway.PostAsync(spec.Path, body.ToJsonString(), ct);
    }

    private static JsonNode? ReadValue(JsonElement args, AiFieldSpec f)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(f.Name, out var v))
            return null;

        return f.JsonType switch
        {
            "number" or "integer" => v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? JsonValue.Create(d) : null,
            "boolean"              => v.ValueKind is JsonValueKind.True or JsonValueKind.False ? JsonValue.Create(v.GetBoolean()) : null,
            _                      => v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? JsonValue.Create(v.GetString()) : null,
        };
    }

    private static JsonNode? DefaultValue(AiFieldSpec f)
    {
        if (f.DefaultRaw is null) return null;
        return f.JsonType switch
        {
            "number" or "integer" => JsonValue.Create(decimal.Parse(f.DefaultRaw)),
            "boolean"              => JsonValue.Create(bool.Parse(f.DefaultRaw)),
            _                      => JsonValue.Create(f.DefaultRaw),
        };
    }
}

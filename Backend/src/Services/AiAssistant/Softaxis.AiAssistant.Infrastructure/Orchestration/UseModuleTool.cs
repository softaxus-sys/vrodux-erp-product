using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// Loads one module's full tool set into the current turn — progressive disclosure of tools.
///
/// <para><b>Why this exists.</b> "Auto" mode can only afford to send the small cross-module read
/// set on every request (see <see cref="AiToolRegistry"/>), so every create/update tool was
/// invisible unless the user first picked an agent from the picker. The model, seeing only
/// <c>projects_list</c>, would truthfully but uselessly answer "there is no function for adding a
/// task" — even though <c>projects_create_issue</c> existed the whole time. Rather than blow the
/// token budget by sending 150+ schemas up front, the model asks for the module it needs and the
/// orchestrator adds that module's tools to the conversation from the next turn onwards.</para>
///
/// <para>This tool is read-only: it changes nothing, it only reveals what is available. The tools
/// it unlocks keep their own confirm-before-write gating.</para>
/// </summary>
public sealed class UseModuleTool(IAiToolRegistry registry) : IAiTool
{
    /// <summary>Well-known name — the orchestrator special-cases this call to expand its tool list.</summary>
    public const string ToolName = "use_module";

    public string  Name               => ToolName;
    public string  Agent              => AiToolAgents.Core;
    public bool    IsReadOnly         => true;
    public bool    IncludeInAutoMode  => true;
    public string? RequiredPermission => null; // it reveals only what the caller is already allowed to use

    public string Description
    {
        get
        {
            var modules = registry.GetAvailableModules();
            var list = modules.Count > 0 ? string.Join(", ", modules) : "(none available)";
            return "Load the full tool set for one ERP module so you can read its records in detail and " +
                   "CREATE or MODIFY them. Call this FIRST whenever the user asks you to add, create, log, " +
                   "book, update, change, assign, approve, or move anything, and whenever the tools you can " +
                   "currently see do not cover what was asked. Never tell the user a capability does not " +
                   "exist before calling this for the relevant module. " +
                   $"Modules available to this user: {list}.";
        }
    }

    public string ParametersJsonSchema
    {
        get
        {
            var modules = new JsonArray();
            foreach (var m in registry.GetAvailableModules()) modules.Add(m);

            return new JsonObject
            {
                ["type"] = "object",
                ["properties"] = new JsonObject
                {
                    ["module"] = new JsonObject
                    {
                        ["type"]        = "string",
                        ["description"] = "The module to load tools for.",
                        ["enum"]        = modules,
                    },
                },
                ["required"]             = new JsonArray("module"),
                ["additionalProperties"] = false,
            }.ToJsonString();
        }
    }

    /// <summary>
    /// Returns the newly available tools as the tool result. The orchestrator separately adds their
    /// schemas to the request — this text is what tells the model they are now callable, and by
    /// what name.
    /// </summary>
    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct)
    {
        var module = arguments.ValueKind == JsonValueKind.Object
                     && arguments.TryGetProperty("module", out var v) && v.ValueKind == JsonValueKind.String
                        ? (v.GetString() ?? "").Trim().ToLowerInvariant()
                        : "";

        var available = registry.GetAvailableModules();
        if (string.IsNullOrEmpty(module) || !available.Contains(module))
        {
            return Task.FromResult(JsonSerializer.Serialize(new
            {
                error = $"'{module}' is not a module this user can work in.",
                availableModules = available,
            }));
        }

        var tools = registry.GetTools(module);
        return Task.FromResult(JsonSerializer.Serialize(new
        {
            module,
            message = $"The {module} tools are now available — call them directly to answer the request.",
            tools = tools.Select(t => new
            {
                name = t.Name,
                t.Description,
                writes = !t.IsReadOnly,
            }),
        }));
    }
}

using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Workflow.API.Authorization;
using Softaxis.Workflow.API.Controllers.Common;
using Softaxis.Workflow.Application;

namespace Softaxis.Workflow.API.Controllers;

/// <summary>Permission keys, so a typo in one place cannot silently open or lock an endpoint.</summary>
internal static class Perm
{
    public const string ReqView = "workflow.requests.view", ReqCreate = "workflow.requests.create";
    public const string AppView = "workflow.approvals.view", AppApprove = "workflow.approvals.approve", AppReassign = "workflow.approvals.edit";
    public const string RepoView = "workflow.repository.view", RepoCreate = "workflow.repository.create", RepoDelete = "workflow.repository.delete";
    public const string AdminView = "workflow.admin.view", AdminEdit = "workflow.admin.edit";
    public const string AuditView = "workflow.audit.view";
}

/// <summary>
/// "Is this person part of the Approvals module at all?" — any one of its permissions. Used on the reads that feed
/// every screen (context, forms, bases, directory). What each person can then do is checked per action.
/// </summary>
public sealed class WorkflowMemberAttribute : Attribute, IAuthorizationFilter
{
    private static readonly string[] Keys =
    [
        "workflow.requests.view", "workflow.requests.create", "workflow.approvals.view", "workflow.approvals.approve",
        "workflow.repository.view", "workflow.admin.view", "workflow.audit.view",
    ];

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.FindFirstValue("is_super_admin") == "true") return;
        if (Keys.Any(k => user.HasClaim("permission", k))) return;
        context.Result = new ObjectResult(new { Code = "Permission.Denied", Description = "Missing permission: workflow access" })
        { StatusCode = StatusCodes.Status403Forbidden };
    }
}

internal static class FormFiles
{
    public static async Task<byte[]> ReadAsync(IFormFile file, CancellationToken ct)
    {
        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return ms.ToArray();
    }
}

// ── Context, setup ──────────────────────────────────────────────────────────

[Route("api/workflow")][Authorize]
public sealed class WorkflowSetupController(ISender sender) : WorkflowControllerBase
{
    [HttpGet("context")][WorkflowMember]
    public async Task<IActionResult> Context(CancellationToken ct) => OkOrError(await sender.Send(new GetMyContextQuery(), ct));

    [HttpGet("settings")][WorkflowMember]
    public async Task<IActionResult> Settings(CancellationToken ct) => OkOrError(await sender.Send(new GetSettingsQuery(), ct));

    [HttpPut("settings")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateSettings(UpdateSettingsCommand c, CancellationToken ct) => OkOrError(await sender.Send(c, ct));

    // Bases and units
    [HttpGet("bases")][WorkflowMember]
    public async Task<IActionResult> Bases(CancellationToken ct) => OkOrError(await sender.Send(new GetBasesQuery(), ct));
    [HttpPost("bases")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateBase(SaveBaseCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("bases/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateBase(Guid id, SaveBaseCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("bases/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteBase(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteBaseCommand(id), ct));

    [HttpGet("bases/{id:guid}/access")][RequirePermission(Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> BaseAccess(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetBaseAccessQuery(id), ct));
    [HttpPut("bases/{id:guid}/access")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> SetBaseAccess(Guid id, [FromBody] IReadOnlyList<AccessUserDto> users, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetBaseAccessCommand(id, users), ct));
    [HttpGet("users/{userId:guid}/bases")][RequirePermission(Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> UserBases(Guid userId, CancellationToken ct) => OkOrError(await sender.Send(new GetUserBasesQuery(userId), ct));
    public sealed record UserBasesBody(string UserName, IReadOnlyList<Guid> BaseIds);
    [HttpPut("users/{userId:guid}/bases")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> SetUserBases(Guid userId, UserBasesBody b, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetUserBasesCommand(userId, b.UserName, b.BaseIds), ct));

    [HttpGet("units")][WorkflowMember]
    public async Task<IActionResult> Units(CancellationToken ct) => OkOrError(await sender.Send(new GetUnitsQuery(), ct));
    [HttpPost("units")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateUnit(SaveUnitCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("units/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateUnit(Guid id, SaveUnitCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("units/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteUnit(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteUnitCommand(id), ct));

    // Positions and holders
    [HttpGet("positions")][RequirePermission(Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> Positions(CancellationToken ct) => OkOrError(await sender.Send(new GetPositionsQuery(), ct));
    [HttpPost("positions")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreatePosition(SavePositionCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("positions/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdatePosition(Guid id, SavePositionCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("positions/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeletePosition(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeletePositionCommand(id), ct));

    [HttpGet("holders")][RequirePermission(Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> Holders([FromQuery] Guid? positionId, CancellationToken ct) => OkOrError(await sender.Send(new GetHoldersQuery(positionId), ct));
    [HttpPost("holders")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateHolder(SaveHolderCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("holders/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateHolder(Guid id, SaveHolderCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("holders/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteHolder(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteHolderCommand(id), ct));

    // Forms
    [HttpGet("forms")][WorkflowMember]
    public async Task<IActionResult> Forms([FromQuery] bool all, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFormsQuery(!(all && (User.HasClaim("permission", Perm.AdminView) || User.HasClaim("permission", Perm.AdminEdit)
            || User.FindFirstValue("is_super_admin") == "true"))), ct));
    [HttpGet("forms/{id:guid}")][WorkflowMember]
    public async Task<IActionResult> Form(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetFormQuery(id), ct));
    [HttpPost("forms")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateForm(SaveFormCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("forms/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateForm(Guid id, SaveFormCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpPost("forms/{id:guid}/duplicate")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DuplicateForm(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new DuplicateFormCommand(id), ct));
    [HttpDelete("forms/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteForm(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteFormCommand(id), ct));

    // Approval matrix
    [HttpGet("flows")][RequirePermission(Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> Flows([FromQuery] Guid? formId, CancellationToken ct) => OkOrError(await sender.Send(new GetFlowsQuery(formId), ct));
    [HttpPost("flows")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateFlow(SaveFlowCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("flows/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateFlow(Guid id, SaveFlowCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("flows/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteFlow(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteFlowCommand(id), ct));
    [HttpGet("flows/resolve")][WorkflowMember]
    public async Task<IActionResult> Resolve([FromQuery] Guid formId, [FromQuery] Guid baseId, [FromQuery] Guid? unitId, [FromQuery] decimal? amount, CancellationToken ct) =>
        OkOrError(await sender.Send(new ResolveFlowQuery(formId, baseId, unitId, amount), ct));

    // Starter packs
    [HttpGet("starter-pack")][RequirePermission(Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> StarterPack(CancellationToken ct) => OkOrError(await sender.Send(new GetStarterPackStatusQuery(), ct));
    [HttpPost("starter-pack/{key}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> InstallStarterPack(string key, CancellationToken ct) => OkOrError(await sender.Send(new InstallStarterPackCommand(key), ct));

    // Directory
    [HttpGet("employees")][WorkflowMember]
    public async Task<IActionResult> Employees([FromQuery] string? search, [FromQuery] Guid? baseId, [FromQuery] bool? active, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetEmployeesQuery(search, baseId, active, page, pageSize), ct));
    [HttpPost("employees")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateEmployee(SaveEmployeeCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("employees/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateEmployee(Guid id, SaveEmployeeCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("employees/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteEmployee(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteEmployeeCommand(id), ct));
    [HttpPost("employees/import")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> ImportEmployees(ImportEmployeesCommand c, CancellationToken ct) => OkOrError(await sender.Send(c, ct));

    // Audit and dashboard
    [HttpGet("audit")][RequirePermission(Perm.AuditView, Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> Audit([FromQuery] string? from, [FromQuery] string? to, [FromQuery] Guid? userId, [FromQuery] string? action,
        [FromQuery] Guid? requestId, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetAuditQuery(from, to, userId, action, requestId, search, page, pageSize), ct));

    [HttpGet("dashboard")][WorkflowMember]
    public async Task<IActionResult> Dashboard(CancellationToken ct) => OkOrError(await sender.Send(new GetDashboardQuery(), ct));
}

// ── Requests ────────────────────────────────────────────────────────────────

[Route("api/workflow/requests")][Authorize]
public sealed class WorkflowRequestsController(ISender sender) : WorkflowControllerBase
{
    [HttpGet][WorkflowMember]
    public async Task<IActionResult> List([FromQuery] string? scope, [FromQuery] string? status, [FromQuery] Guid? baseId, [FromQuery] Guid? formId,
        [FromQuery] string? search, [FromQuery] string? from, [FromQuery] string? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRequestsQuery(scope, status, baseId, formId, search, from, to, page, pageSize), ct));

    [HttpGet("{id:guid}")][WorkflowMember]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetRequestQuery(id), ct));

    [HttpPost][RequirePermission(Perm.ReqCreate)]
    public async Task<IActionResult> Create(SaveRequestCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));

    [HttpPut("{id:guid}")][RequirePermission(Perm.ReqCreate)]
    public async Task<IActionResult> Update(Guid id, SaveRequestCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));

    [HttpPost("{id:guid}/submit")][RequirePermission(Perm.ReqCreate)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new SubmitRequestCommand(id), ct));

    public sealed record DecisionBody(string Action, string? Comment);
    [HttpPost("{id:guid}/decide")][RequirePermission(Perm.AppApprove)]
    public async Task<IActionResult> Decide(Guid id, DecisionBody b, CancellationToken ct) => OkOrError(await sender.Send(new DecideRequestCommand(id, b.Action, b.Comment), ct));

    public sealed record ReasonBody(string? Reason);
    [HttpPost("{id:guid}/cancel")][WorkflowMember]
    public async Task<IActionResult> Cancel(Guid id, ReasonBody b, CancellationToken ct) => OkOrError(await sender.Send(new CancelRequestCommand(id, b.Reason), ct));

    [HttpDelete("{id:guid}")][RequirePermission(Perm.ReqCreate)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteRequestCommand(id), ct));

    [HttpPost("{id:guid}/resubmit")][RequirePermission(Perm.ReqCreate)]
    public async Task<IActionResult> Resubmit(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new ResubmitRequestCommand(id), ct));

    public sealed record CommentBody(string Text);
    [HttpPost("{id:guid}/comments")][WorkflowMember]
    public async Task<IActionResult> Comment(Guid id, CommentBody b, CancellationToken ct) => OkOrError(await sender.Send(new AddCommentCommand(id, b.Text), ct));

    public sealed record ReassignBody(IReadOnlyList<AccessUserDto> Users, string? Reason);
    [HttpPost("{id:guid}/steps/{stepId:guid}/reassign")][RequirePermission(Perm.AppReassign, Perm.AdminEdit)]
    public async Task<IActionResult> Reassign(Guid id, Guid stepId, ReassignBody b, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReassignStepCommand(id, stepId, b.Users, b.Reason), ct));

    // Files
    [HttpPost("{id:guid}/attachments")][RequirePermission(Perm.ReqCreate)][RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> AddAttachment(Guid id, IFormFile file, [FromForm] string? fieldKey, CancellationToken ct) =>
        OkOrError(await sender.Send(new UploadAttachmentCommand(id, fieldKey, file.FileName, file.ContentType, await FormFiles.ReadAsync(file, ct)), ct));

    [HttpDelete("{id:guid}/attachments/{attachmentId:guid}")][RequirePermission(Perm.ReqCreate)]
    public async Task<IActionResult> DeleteAttachment(Guid id, Guid attachmentId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteAttachmentCommand(id, attachmentId), ct));

    [HttpGet("{id:guid}/attachments/{attachmentId:guid}")][WorkflowMember]
    public async Task<IActionResult> Attachment(Guid id, Guid attachmentId, CancellationToken ct) =>
        FileOrError(await sender.Send(new GetAttachmentQuery(id, attachmentId), ct));

    [HttpGet("{id:guid}/steps/{stepId:guid}/pdf")][WorkflowMember]
    public async Task<IActionResult> StepPdf(Guid id, Guid stepId, CancellationToken ct) => FileOrError(await sender.Send(new GetStepPdfQuery(id, stepId), ct));

    [HttpGet("{id:guid}/pdf")][WorkflowMember]
    public async Task<IActionResult> RequestPdf(Guid id, CancellationToken ct) => FileOrError(await sender.Send(new GetRequestPdfQuery(id), ct));
}

// ── Repository ──────────────────────────────────────────────────────────────

[Route("api/workflow/repository")][Authorize]
public sealed class WorkflowRepositoryController(ISender sender) : WorkflowControllerBase
{
    [HttpGet("types")][RequirePermission(Perm.RepoView, Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> Types(CancellationToken ct) => OkOrError(await sender.Send(new GetDocTypesQuery(), ct));
    [HttpPost("types")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> CreateType(SaveDocTypeCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = null }, ct));
    [HttpPut("types/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> UpdateType(Guid id, SaveDocTypeCommand c, CancellationToken ct) => OkOrError(await sender.Send(c with { Id = id }, ct));
    [HttpDelete("types/{id:guid}")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> DeleteType(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteDocTypeCommand(id), ct));

    [HttpPost("types/{id:guid}/template")][RequirePermission(Perm.AdminEdit)][RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> SetTemplate(Guid id, IFormFile file, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetDocTemplateCommand(id, file.FileName, file.ContentType, await FormFiles.ReadAsync(file, ct)), ct));
    [HttpDelete("types/{id:guid}/template")][RequirePermission(Perm.AdminEdit)]
    public async Task<IActionResult> RemoveTemplate(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new SetDocTemplateCommand(id, null, null, null), ct));
    [HttpGet("types/{id:guid}/template")][RequirePermission(Perm.RepoView, Perm.AdminView, Perm.AdminEdit)]
    public async Task<IActionResult> Template(Guid id, CancellationToken ct) => FileOrError(await sender.Send(new GetDocTemplateQuery(id), ct));

    [HttpGet("calendar")][RequirePermission(Perm.RepoView)]
    public async Task<IActionResult> Calendar([FromQuery] Guid baseId, [FromQuery] string month, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCalendarQuery(baseId, month), ct));

    [HttpGet("documents")][RequirePermission(Perm.RepoView)]
    public async Task<IActionResult> Documents([FromQuery] Guid? baseId, [FromQuery] Guid? docTypeId, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRepoDocsQuery(baseId, docTypeId, from, to, search, page, pageSize), ct));

    [HttpPost("documents")][RequirePermission(Perm.RepoCreate)][RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] Guid docTypeId, [FromForm] Guid baseId, [FromForm] string periodDate, [FromForm] string? notes, IFormFile file, CancellationToken ct) =>
        OkOrError(await sender.Send(new UploadRepoDocCommand(docTypeId, baseId, periodDate, file.FileName, file.ContentType, await FormFiles.ReadAsync(file, ct), notes), ct));

    [HttpDelete("documents/{id:guid}")][RequirePermission(Perm.RepoDelete)]
    public async Task<IActionResult> DeleteDocument(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteRepoDocCommand(id), ct));

    [HttpGet("documents/{id:guid}/file")][RequirePermission(Perm.RepoView)]
    public async Task<IActionResult> DownloadDocument(Guid id, CancellationToken ct) => FileOrError(await sender.Send(new GetRepoDocFileQuery(id), ct));
}

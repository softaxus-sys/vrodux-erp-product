using System.Text.Json;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Workflow.Application;

/// <summary>Marker for MediatR/FluentValidation assembly scanning.</summary>
public static class AssemblyMarker;

/// <summary>The signed-in person, read from the JWT by the host.</summary>
public interface ICurrentUser
{
    Guid? Id { get; }
    string? Name { get; }
    string? Email { get; }
    string? Ip { get; }
    bool IsSuperAdmin { get; }
    bool HasPermission(string permissionKey);
}

/// <summary>Permission keys used inside handlers (the controller has its own copy for attributes).</summary>
public static class WfPerm
{
    public const string AdminView = "workflow.admin.view", AdminEdit = "workflow.admin.edit";
    public const string RequestsCreate = "workflow.requests.create", RequestsView = "workflow.requests.view";
    public const string Approve = "workflow.approvals.approve", Reassign = "workflow.approvals.edit";
    public const string AuditView = "workflow.audit.view";
    public const string RepoView = "workflow.repository.view", RepoCreate = "workflow.repository.create", RepoDelete = "workflow.repository.delete";
}

// ── Form definition (the shape stored in WfForm.FieldsJson) ──────────────────

public sealed record ShowIfDef(string Field, string[] In);

public sealed record ColumnDef(string Key, string Label, string Type, bool Required = false, string[]? Options = null,
    string[]? Product = null, bool IsAmount = false);

/// <summary>
/// One field on a form. Types: text, textarea, number, money, date, select, checkbox, attachment, lines.
/// <c>lines</c> is a table of rows whose columns are <see cref="ColumnDef"/>; a money column with
/// <c>product: [a, b]</c> is computed by the server as a × b, so a total can never be typed in wrongly.
/// </summary>
public sealed record FieldDef(string Key, string Label, string Type, bool Required = false, string[]? Options = null,
    string? Help = null, bool IsAmount = false, bool IsTitle = false, ShowIfDef? ShowIf = null,
    ColumnDef[]? Columns = null, string? Placeholder = null);

// ── Context, settings ────────────────────────────────────────────────────────

public sealed record WfSettingsDto(string LocationLabel, string UnitLabel, string DirectoryRefresh, DateTime? DirectoryRefreshedAt,
    string TimeZoneId, string NumberPrefix, string? StarterPack);
public sealed record GetSettingsQuery : IQuery<WfSettingsDto>;
public sealed record UpdateSettingsCommand(string LocationLabel, string UnitLabel, string DirectoryRefresh, string TimeZoneId, string NumberPrefix)
    : ICommand<WfSettingsDto>;

public sealed record MyBaseDto(Guid Id, string Code, string Name);
public sealed record MyContextDto(WfSettingsDto Settings, IReadOnlyList<MyBaseDto> Bases, IReadOnlyList<UnitDto> Units,
    bool IsAdmin, bool SeesAll, bool CanCreate, bool CanApprove, bool SetupDone, Guid? UserId, string? UserName);
public sealed record GetMyContextQuery : IQuery<MyContextDto>;

// ── Bases, units, positions ──────────────────────────────────────────────────

public sealed record BaseDto(Guid Id, string Code, string Name, string? Country, int SortOrder, bool IsActive, int UserCount);
public sealed record GetBasesQuery : IQuery<IReadOnlyList<BaseDto>>;
public sealed record SaveBaseCommand(Guid? Id, string Code, string Name, string? Country, int SortOrder, bool IsActive) : ICommand<BaseDto>;
public sealed record DeleteBaseCommand(Guid Id) : ICommand;

public sealed record UnitDto(Guid Id, string Name, string? Code, int SortOrder, bool IsActive);
public sealed record GetUnitsQuery : IQuery<IReadOnlyList<UnitDto>>;
public sealed record SaveUnitCommand(Guid? Id, string Name, string? Code, int SortOrder, bool IsActive) : ICommand<UnitDto>;
public sealed record DeleteUnitCommand(Guid Id) : ICommand;

public sealed record PositionDto(Guid Id, string Name, string? Description, bool IsActive, int HolderCount, int FlowCount);
public sealed record GetPositionsQuery : IQuery<IReadOnlyList<PositionDto>>;
public sealed record SavePositionCommand(Guid? Id, string Name, string? Description, bool IsActive) : ICommand<PositionDto>;
public sealed record DeletePositionCommand(Guid Id) : ICommand;

public sealed record HolderDto(Guid Id, Guid PositionId, string PositionName, Guid? BaseId, string? BaseName, Guid? UnitId,
    string? UnitName, Guid UserId, string UserName, string? Email, string? Designation);
public sealed record GetHoldersQuery(Guid? PositionId) : IQuery<IReadOnlyList<HolderDto>>;
public sealed record SaveHolderCommand(Guid? Id, Guid PositionId, Guid? BaseId, Guid? UnitId, Guid UserId, string UserName,
    string? Email, string? Designation) : ICommand<HolderDto>;
public sealed record DeleteHolderCommand(Guid Id) : ICommand;

public sealed record AccessUserDto(Guid UserId, string UserName);
public sealed record BaseAccessDto(Guid BaseId, IReadOnlyList<AccessUserDto> Users);
public sealed record GetBaseAccessQuery(Guid BaseId) : IQuery<BaseAccessDto>;
public sealed record SetBaseAccessCommand(Guid BaseId, IReadOnlyList<AccessUserDto> Users) : ICommand<BaseAccessDto>;
/// <summary>Which Bases one person may use (for the "Users" screen).</summary>
public sealed record GetUserBasesQuery(Guid UserId) : IQuery<IReadOnlyList<Guid>>;
public sealed record SetUserBasesCommand(Guid UserId, string UserName, IReadOnlyList<Guid> BaseIds) : ICommand;

// ── Forms and the approval matrix ────────────────────────────────────────────

public sealed record FormDto(Guid Id, string Key, string Name, string? Description, string? Category, string? Icon,
    string FieldsJson, int Version, int SortOrder, bool IsActive, bool IsBuiltIn, int RequestCount, int FlowCount);
public sealed record GetFormsQuery(bool ActiveOnly) : IQuery<IReadOnlyList<FormDto>>;
public sealed record GetFormQuery(Guid Id) : IQuery<FormDto>;
public sealed record SaveFormCommand(Guid? Id, string? Key, string Name, string? Description, string? Category, string? Icon,
    string FieldsJson, int SortOrder, bool IsActive) : ICommand<FormDto>;
public sealed record DuplicateFormCommand(Guid Id) : ICommand<FormDto>;
public sealed record DeleteFormCommand(Guid Id) : ICommand;

public sealed record FlowStepDto(int Order, string Kind, Guid PositionId, string PositionName, string? Label, decimal? MinAmount);
public sealed record FlowStepInput(string Kind, Guid PositionId, string? Label, decimal? MinAmount);
public sealed record FlowDto(Guid Id, Guid FormId, string FormName, Guid? BaseId, string? BaseName, Guid? UnitId, string? UnitName,
    bool IsActive, IReadOnlyList<FlowStepDto> Steps);
public sealed record GetFlowsQuery(Guid? FormId) : IQuery<IReadOnlyList<FlowDto>>;
public sealed record SaveFlowCommand(Guid? Id, Guid FormId, Guid? BaseId, Guid? UnitId, bool IsActive,
    IReadOnlyList<FlowStepInput> Steps) : ICommand<FlowDto>;
public sealed record DeleteFlowCommand(Guid Id) : ICommand;

public sealed record HolderLiteDto(Guid UserId, string Name, string? Designation);
public sealed record ResolvedStepDto(int Order, string Kind, string PositionName, string? Label, decimal? MinAmount,
    bool Applies, IReadOnlyList<HolderLiteDto> Holders, string? Problem);
public sealed record ResolvedFlowDto(Guid? FlowId, string Scope, IReadOnlyList<ResolvedStepDto> Steps, IReadOnlyList<string> Problems);
/// <summary>Who would approve this form for this Base and unit (shown before submitting, and in setup to catch gaps).</summary>
public sealed record ResolveFlowQuery(Guid FormId, Guid BaseId, Guid? UnitId, decimal? Amount) : IQuery<ResolvedFlowDto>;

public sealed record StarterPackDto(string Key, string Name, string Description);
public sealed record StarterPackStatusDto(string? Installed, IReadOnlyList<StarterPackDto> Available);
public sealed record GetStarterPackStatusQuery : IQuery<StarterPackStatusDto>;
public sealed record InstallStarterPackCommand(string Key) : ICommand<StarterPackStatusDto>;

// ── Requests ─────────────────────────────────────────────────────────────────

public sealed record StepAssigneeDto(Guid UserId, string Name, string? Designation);
public sealed record RequestStepDto(Guid Id, int Order, string Kind, string PositionName, string? Label, string Status,
    IReadOnlyList<StepAssigneeDto> Assignees, string? DecidedByName, string? DecidedByDesignation, DateTime? DecidedAt,
    string? Comment, string? SkipReason, bool HasPdf, DateTime? ActivatedAt);
public sealed record AttachmentDto(Guid Id, string? FieldKey, string FileName, string ContentType, long Size, string UploadedByName, DateTime CreatedAt);
public sealed record CommentDto(Guid Id, Guid AuthorId, string AuthorName, string Text, DateTime CreatedAt);
public sealed record TimelineDto(DateTime At, string? UserName, string Action, string? Detail);

public sealed record RequestSummaryDto(Guid Id, string Number, Guid FormId, string FormName, string FormKey, Guid BaseId, string BaseName,
    string? UnitName, string? Title, decimal Amount, string Status, Guid RequesterId, string RequesterName,
    DateTime CreatedAt, DateTime? SubmittedAt, DateTime? CompletedAt, string? WaitingOn, string? WaitingStep,
    int StepsDone, int StepsTotal, bool WaitingOnMe, DateTime? WaitingSince);

public sealed record RequestDetailDto(Guid Id, string Number, Guid FormId, string FormName, string FormKey, int FormVersion, string FieldsJson,
    Guid BaseId, string BaseName, Guid? UnitId, string? UnitName, string? Title, string DataJson, decimal Amount, string Status,
    Guid RequesterId, string RequesterName, string? RequesterEmail, string? RequesterDesignation, DateTime CreatedAt,
    DateTime? SubmittedAt, DateTime? CompletedAt, string? FinalReason, Guid? ResubmittedFromId,
    IReadOnlyList<RequestStepDto> Steps, IReadOnlyList<AttachmentDto> Attachments, IReadOnlyList<CommentDto> Comments,
    IReadOnlyList<TimelineDto> Timeline, bool CanDecide, Guid? CurrentStepId, bool CanEdit, bool CanCancel, bool CanReassign, bool CanResubmit);

public sealed record Paged<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

/// <summary>scope: mine | todo | watching | all</summary>
public sealed record GetRequestsQuery(string? Scope, string? Status, Guid? BaseId, Guid? FormId, string? Search,
    string? From, string? To, int Page = 1, int PageSize = 25) : IQuery<Paged<RequestSummaryDto>>;
public sealed record GetRequestQuery(Guid Id) : IQuery<RequestDetailDto>;

public sealed record SaveRequestCommand(Guid? Id, Guid FormId, Guid BaseId, Guid? UnitId, string? Title, JsonElement Data, bool Submit)
    : ICommand<RequestDetailDto>;
public sealed record SubmitRequestCommand(Guid Id) : ICommand<RequestDetailDto>;
public sealed record CancelRequestCommand(Guid Id, string? Reason) : ICommand<RequestDetailDto>;
public sealed record DeleteRequestCommand(Guid Id) : ICommand;
public sealed record ResubmitRequestCommand(Guid Id) : ICommand<RequestDetailDto>;
/// <summary>action: approve | reject. A rejection needs a reason.</summary>
public sealed record DecideRequestCommand(Guid Id, string Action, string? Comment) : ICommand<RequestDetailDto>;
public sealed record AddCommentCommand(Guid Id, string Text) : ICommand<RequestDetailDto>;
public sealed record ReassignStepCommand(Guid Id, Guid StepId, IReadOnlyList<AccessUserDto> Users, string? Reason) : ICommand<RequestDetailDto>;

public sealed record UploadAttachmentCommand(Guid RequestId, string? FieldKey, string FileName, string ContentType, byte[] Data) : ICommand<AttachmentDto>;
public sealed record DeleteAttachmentCommand(Guid RequestId, Guid AttachmentId) : ICommand;
public sealed record FileDto(string FileName, string ContentType, byte[] Data);
public sealed record GetAttachmentQuery(Guid RequestId, Guid AttachmentId) : IQuery<FileDto>;
public sealed record GetStepPdfQuery(Guid RequestId, Guid StepId) : IQuery<FileDto>;
public sealed record GetRequestPdfQuery(Guid RequestId) : IQuery<FileDto>;

// ── Repository ───────────────────────────────────────────────────────────────

public sealed record DocTypeDto(Guid Id, string Name, string Frequency, string? Description, int SortOrder, bool IsActive,
    string? TemplateName);
public sealed record GetDocTypesQuery : IQuery<IReadOnlyList<DocTypeDto>>;
public sealed record SaveDocTypeCommand(Guid? Id, string Name, string Frequency, string? Description, int SortOrder, bool IsActive) : ICommand<DocTypeDto>;
public sealed record DeleteDocTypeCommand(Guid Id) : ICommand;
public sealed record SetDocTemplateCommand(Guid Id, string? FileName, string? ContentType, byte[]? Data) : ICommand<DocTypeDto>;
public sealed record GetDocTemplateQuery(Guid Id) : IQuery<FileDto>;

public sealed record RepoDocDto(Guid Id, Guid DocTypeId, string DocTypeName, Guid BaseId, string BaseName, string PeriodDate,
    string FileName, string ContentType, long Size, string? Notes, string UploadedByName, DateTime CreatedAt);
public sealed record CalendarCellDto(Guid DocTypeId, string Date, int Count);
public sealed record CalendarDto(string Month, Guid BaseId, IReadOnlyList<DocTypeDto> DocTypes, IReadOnlyList<CalendarCellDto> Cells);
public sealed record GetCalendarQuery(Guid BaseId, string Month) : IQuery<CalendarDto>;
public sealed record GetRepoDocsQuery(Guid? BaseId, Guid? DocTypeId, string? From, string? To, string? Search, int Page = 1, int PageSize = 50)
    : IQuery<Paged<RepoDocDto>>;
public sealed record UploadRepoDocCommand(Guid DocTypeId, Guid BaseId, string PeriodDate, string FileName, string ContentType,
    byte[] Data, string? Notes) : ICommand<RepoDocDto>;
public sealed record DeleteRepoDocCommand(Guid Id) : ICommand;
public sealed record GetRepoDocFileQuery(Guid Id) : IQuery<FileDto>;

// ── Directory ────────────────────────────────────────────────────────────────

public sealed record EmployeeDto(Guid Id, string? Code, string Name, string? Email, string? Phone, string? Designation,
    string? Department, string? ManagerName, Guid? BaseId, string? BaseName, Guid? UnitId, string? UnitName, bool IsActive,
    string Source, DateTime? LastSyncedAt, bool HasLogin);
public sealed record GetEmployeesQuery(string? Search, Guid? BaseId, bool? Active, int Page = 1, int PageSize = 50) : IQuery<Paged<EmployeeDto>>;
public sealed record SaveEmployeeCommand(Guid? Id, string? Code, string Name, string? Email, string? Phone, string? Designation,
    string? Department, string? ManagerName, Guid? BaseId, Guid? UnitId, bool IsActive) : ICommand<EmployeeDto>;
public sealed record DeleteEmployeeCommand(Guid Id) : ICommand;

public sealed record EmployeeRow(string? Code, string? Name, string? Email, string? Phone, string? Designation, string? Department,
    string? Manager, string? Base, string? Unit);
public sealed record ImportError(int Row, string Reason);
public sealed record ImportEmployeesResult(int Created, int Updated, int Deactivated, int Failed, IReadOnlyList<ImportError> Errors);
public sealed record ImportEmployeesCommand(IReadOnlyList<EmployeeRow> Rows, bool IsFullList) : ICommand<ImportEmployeesResult>;

// ── Audit, dashboard ─────────────────────────────────────────────────────────

public sealed record AuditDto(Guid Id, DateTime At, Guid? UserId, string? UserName, string Action, string EntityType, Guid? EntityId,
    Guid? RequestId, string? RequestNumber, string? Detail, string? Ip);
public sealed record GetAuditQuery(string? From, string? To, Guid? UserId, string? Action, Guid? RequestId, string? Search,
    int Page = 1, int PageSize = 50) : IQuery<Paged<AuditDto>>;

public sealed record CountDto(string Label, int Count);
public sealed record DashboardDto(int MyOpen, int ToApprove, int ApprovedLast30, int RejectedLast30, double AvgHoursToDecision,
    IReadOnlyList<CountDto> ByForm, IReadOnlyList<CountDto> ByBase, IReadOnlyList<CountDto> ByStatus, int OverdueOver48h);
public sealed record GetDashboardQuery : IQuery<DashboardDto>;

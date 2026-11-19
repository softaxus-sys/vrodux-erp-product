namespace Softaxis.Workflow.Domain.Entities;

/// <summary>Request lifecycle. A request is never "overdue" or "late" in storage; that is worked out from dates.</summary>
public static class RequestStatus
{
    public const string Draft = "draft", Pending = "pending", Approved = "approved",
        Rejected = "rejected", Cancelled = "cancelled";
    public static readonly string[] All = [Draft, Pending, Approved, Rejected, Cancelled];
    public static bool IsOpen(string s) => s == Pending;
    public static bool IsFinal(string s) => s is Approved or Rejected or Cancelled;
}

public static class StepStatus
{
    public const string Waiting = "waiting", Pending = "pending", Approved = "approved",
        Rejected = "rejected", Skipped = "skipped";
}

public static class StepKind
{
    public const string Review = "review", Approve = "approve";
    public static bool Valid(string s) => s is Review or Approve;
}

public static class DocFrequency
{
    public const string Daily = "daily", Monthly = "monthly";
    public static bool Valid(string s) => s is Daily or Monthly;
}

/// <summary>One row per workspace: what this workspace calls things, and how its directory refreshes.</summary>
public sealed class WfSettings
{
    private WfSettings() { }
    public static WfSettings CreateDefault() => new() { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };

    public Guid    Id               { get; private set; }
    /// <summary>What a location is called: Base, Branch, Property, Site…</summary>
    public string  LocationLabel    { get; private set; } = "Base";
    public string  UnitLabel        { get; private set; } = "Business unit";
    /// <summary>biweekly | monthly — how often HR is expected to refresh the employee directory.</summary>
    public string  DirectoryRefresh { get; private set; } = "monthly";
    public DateTime? DirectoryRefreshedAt { get; private set; }
    /// <summary>IANA zone used on decision PDFs and reminders (a hosted server runs on UTC).</summary>
    public string  TimeZoneId       { get; private set; } = "Asia/Dubai";
    public string  NumberPrefix     { get; private set; } = "REQ";
    public string? StarterPack      { get; private set; }
    public DateTime CreatedAt       { get; private set; }

    public void Update(string location, string unit, string refresh, string tz, string prefix)
    {
        LocationLabel = location.Trim(); UnitLabel = unit.Trim(); DirectoryRefresh = refresh;
        TimeZoneId = tz.Trim(); NumberPrefix = prefix.Trim().ToUpperInvariant();
    }
    public void MarkDirectoryRefreshed() => DirectoryRefreshedAt = DateTime.UtcNow;
    public void MarkStarterPack(string key) => StarterPack = key;
}

/// <summary>A location (Base). Access, forms and approval routing are all decided per Base.</summary>
public sealed class WfBase
{
    private WfBase() { }
    public WfBase(string code, string name) { Id = Guid.NewGuid(); Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id        { get; private set; }
    public string  Code      { get; private set; } = string.Empty;
    public string  Name      { get; private set; } = string.Empty;
    public string? Country   { get; private set; }
    public int     SortOrder { get; private set; }
    public bool    IsActive  { get; private set; } = true;
    public bool    IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public void Update(string code, string name, string? country, int sort, bool active)
    {
        Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); Country = Txt.OrNull(country); SortOrder = sort; IsActive = active;
    }
    public void Delete() => IsDeleted = true;
}

public sealed class WfUnit
{
    private WfUnit() { }
    public WfUnit(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id        { get; private set; }
    public string  Name      { get; private set; } = string.Empty;
    public string? Code      { get; private set; }
    public int     SortOrder { get; private set; }
    public bool    IsActive  { get; private set; } = true;
    public bool    IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public void Update(string name, string? code, int sort, bool active)
    { Name = name.Trim(); Code = Txt.OrNull(code); SortOrder = sort; IsActive = active; }
    public void Delete() => IsDeleted = true;
}

/// <summary>
/// A seat in an approval chain ("Property Finance", "HQ Finance", "Security"). Flows name positions,
/// never people, so changing who holds a seat never touches a flow. Who holds it is per Base and unit.
/// </summary>
public sealed class WfPosition
{
    private WfPosition() { }
    public WfPosition(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Name        { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool    IsActive    { get; private set; } = true;
    public bool    IsDeleted   { get; private set; }
    public DateTime CreatedAt  { get; private set; }

    public void Update(string name, string? description, bool active)
    { Name = name.Trim(); Description = Txt.OrNull(description); IsActive = active; }
    public void Delete() => IsDeleted = true;
}

/// <summary>
/// Someone who holds a position for a Base and/or unit. A null Base or unit means "any". When a flow
/// step is resolved the most specific holders win: (Base+unit), then Base, then unit, then everywhere.
/// </summary>
public sealed class WfPositionHolder
{
    private WfPositionHolder() { }
    public WfPositionHolder(Guid positionId, Guid? baseId, Guid? unitId, Guid userId, string userName)
    { Id = Guid.NewGuid(); PositionId = positionId; BaseId = baseId; UnitId = unitId; UserId = userId; UserName = userName; CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public Guid    PositionId  { get; private set; }
    public Guid?   BaseId      { get; private set; }
    public Guid?   UnitId      { get; private set; }
    public Guid    UserId      { get; private set; }
    public string  UserName    { get; private set; } = string.Empty;
    public string? Email       { get; private set; }
    /// <summary>The title printed on the decision PDF next to the approver's name.</summary>
    public string? Designation { get; private set; }
    public DateTime CreatedAt  { get; private set; }

    public void SetDetails(string? email, string? designation)
    { Email = Txt.OrNull(email); Designation = Txt.OrNull(designation); }
}

/// <summary>Which Bases a person may use (R2). Admins are not limited by this.</summary>
public sealed class WfBaseAccess
{
    private WfBaseAccess() { }
    public WfBaseAccess(Guid baseId, Guid userId, string userName)
    { Id = Guid.NewGuid(); BaseId = baseId; UserId = userId; UserName = userName; CreatedAt = DateTime.UtcNow; }

    public Guid   Id        { get; private set; }
    public Guid   BaseId    { get; private set; }
    public Guid   UserId    { get; private set; }
    public string UserName  { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
}

/// <summary>
/// A form definition. Fields are stored as JSON so a tenant can build or change a form without a
/// deployment. Requests snapshot the definition they were submitted against, so editing a form
/// never rewrites history.
/// </summary>
public sealed class WfForm
{
    private WfForm() { }
    public WfForm(string key, string name) { Id = Guid.NewGuid(); Key = key.Trim().ToLowerInvariant(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Key         { get; private set; } = string.Empty;
    public string  Name        { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? Category    { get; private set; }
    public string? Icon        { get; private set; }
    public string  FieldsJson  { get; private set; } = "[]";
    public int     Version     { get; private set; } = 1;
    public int     SortOrder   { get; private set; }
    public bool    IsActive    { get; private set; } = true;
    public bool    IsBuiltIn   { get; private set; }
    public bool    IsDeleted   { get; private set; }
    public DateTime CreatedAt  { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string name, string? description, string? category, string? icon, string fieldsJson, int sort, bool active)
    {
        // The first time fields are set (a new form) is version 1, not an edit.
        if (FieldsJson != "[]" && !string.Equals(FieldsJson, fieldsJson, StringComparison.Ordinal)) Version++;
        Name = name.Trim(); Description = Txt.OrNull(description); Category = Txt.OrNull(category); Icon = Txt.OrNull(icon);
        FieldsJson = fieldsJson; SortOrder = sort; IsActive = active; UpdatedAt = DateTime.UtcNow;
    }
    public void SetBuiltIn() => IsBuiltIn = true;
    public void Delete() => IsDeleted = true;
}

/// <summary>
/// One row of the approval matrix: who approves a form for a Base and unit. A flow with no Base and no
/// unit is the default; narrower flows override it (Base+unit beats Base beats unit beats default).
/// </summary>
public sealed class WfFlow
{
    private WfFlow() { }
    public WfFlow(Guid formId, Guid? baseId, Guid? unitId) { Id = Guid.NewGuid(); FormId = formId; BaseId = baseId; UnitId = unitId; CreatedAt = DateTime.UtcNow; }

    public Guid  Id       { get; private set; }
    public Guid  FormId   { get; private set; }
    public Guid? BaseId   { get; private set; }
    public Guid? UnitId   { get; private set; }
    public bool  IsActive { get; private set; } = true;
    public bool  IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public void Update(Guid? baseId, Guid? unitId, bool active) { BaseId = baseId; UnitId = unitId; IsActive = active; }
    public void Delete() => IsDeleted = true;
}

public sealed class WfFlowStep
{
    private WfFlowStep() { }
    public WfFlowStep(Guid flowId, int order, string kind, Guid positionId, string? label, decimal? minAmount)
    { Id = Guid.NewGuid(); FlowId = flowId; Order = order; Kind = kind; PositionId = positionId; Label = Txt.OrNull(label); MinAmount = minAmount; }

    public Guid    Id         { get; private set; }
    public Guid    FlowId     { get; private set; }
    public int     Order      { get; private set; }
    /// <summary>review | approve</summary>
    public string  Kind       { get; private set; } = StepKind.Approve;
    public Guid    PositionId { get; private set; }
    public string? Label      { get; private set; }
    /// <summary>When set, the step applies only to requests worth at least this much (procurement thresholds).</summary>
    public decimal? MinAmount { get; private set; }
}

/// <summary>A submitted (or draft) form. The form definition and the resolved approval chain are snapshotted.</summary>
public sealed class WfRequest
{
    private WfRequest() { }
    public WfRequest(string number, Guid formId, string formKey, string formName, int formVersion, string fieldsJson,
        Guid baseId, string baseName, Guid? unitId, string? unitName, Guid requesterId, string requesterName)
    {
        Id = Guid.NewGuid(); Number = number; FormId = formId; FormKey = formKey; FormName = formName; FormVersion = formVersion;
        FieldsJson = fieldsJson; BaseId = baseId; BaseName = baseName; UnitId = unitId; UnitName = unitName;
        RequesterId = requesterId; RequesterName = requesterName; CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id            { get; private set; }
    public string  Number        { get; private set; } = string.Empty;
    public Guid    FormId        { get; private set; }
    public string  FormKey       { get; private set; } = string.Empty;
    public string  FormName      { get; private set; } = string.Empty;
    public int     FormVersion   { get; private set; }
    public string  FieldsJson    { get; private set; } = "[]";
    public Guid    BaseId        { get; private set; }
    public string  BaseName      { get; private set; } = string.Empty;
    public Guid?   UnitId        { get; private set; }
    public string? UnitName      { get; private set; }
    public string? Title         { get; private set; }
    public string  DataJson      { get; private set; } = "{}";
    public decimal Amount        { get; private set; }
    public string  Status        { get; private set; } = RequestStatus.Draft;
    public Guid    RequesterId   { get; private set; }
    public string  RequesterName { get; private set; } = string.Empty;
    public string? RequesterEmail { get; private set; }
    public string? RequesterDesignation { get; private set; }
    public Guid?   ResubmittedFromId { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public string? FinalReason   { get; private set; }
    public bool    IsDeleted     { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    /// <summary>Concurrency token: two approvers acting on the same request at once cannot both win.</summary>
    public byte[]  RowVersion    { get; private set; } = [];

    public List<WfRequestStep> Steps { get; private set; } = [];

    public void SetContent(string? title, string dataJson, decimal amount, Guid? unitId, string? unitName)
    { Title = Txt.OrNull(title); DataJson = dataJson; Amount = amount; UnitId = unitId; UnitName = unitName; UpdatedAt = DateTime.UtcNow; }
    public void SetBase(Guid baseId, string baseName) { BaseId = baseId; BaseName = baseName; }
    public void SetForm(string fieldsJson, int version) { FieldsJson = fieldsJson; FormVersion = version; }
    public void SetRequesterInfo(string? email, string? designation) { RequesterEmail = Txt.OrNull(email); RequesterDesignation = Txt.OrNull(designation); }
    public void SetResubmittedFrom(Guid id) => ResubmittedFromId = id;

    /// <summary>Steps are added to their own DbSet by the handler (a child with a client-set Guid added through
    /// a tracked collection is treated as an update by EF), so this only flips the request.</summary>
    public void MarkSubmitted()
    {
        Status = RequestStatus.Pending; SubmittedAt = DateTime.UtcNow; UpdatedAt = SubmittedAt;
    }
    public void Complete(string status, string? reason)
    { Status = status; CompletedAt = DateTime.UtcNow; FinalReason = Txt.OrNull(reason); UpdatedAt = CompletedAt; }
    public void Touch() => UpdatedAt = DateTime.UtcNow;
    public void Delete() => IsDeleted = true;
}

/// <summary>One link of a request's approval chain, frozen at submission with the people who could act on it.</summary>
public sealed class WfRequestStep
{
    private WfRequestStep() { }
    public WfRequestStep(Guid requestId, int order, string kind, Guid positionId, string positionName, string? label)
    { Id = Guid.NewGuid(); RequestId = requestId; Order = order; Kind = kind; PositionId = positionId; PositionName = positionName; Label = Txt.OrNull(label); }

    public Guid    Id           { get; private set; }
    public Guid    RequestId    { get; private set; }
    public int     Order        { get; private set; }
    public string  Kind         { get; private set; } = StepKind.Approve;
    public Guid    PositionId   { get; private set; }
    public string  PositionName { get; private set; } = string.Empty;
    public string? Label        { get; private set; }
    public string  Status       { get; private set; } = StepStatus.Waiting;
    public DateTime? ActivatedAt { get; private set; }
    public Guid?   DecidedById  { get; private set; }
    public string? DecidedByName { get; private set; }
    public string? DecidedByDesignation { get; private set; }
    public DateTime? DecidedAt  { get; private set; }
    public string? Comment      { get; private set; }
    public string? SkipReason   { get; private set; }
    public string? PdfName      { get; private set; }
    public byte[]? PdfData      { get; private set; }
    /// <summary>SHA-256 of the stored PDF, so a copy can later be shown to be the one that was issued.</summary>
    public string? PdfHash      { get; private set; }

    public List<WfStepAssignee> Assignees { get; private set; } = [];

    public WfStepAssignee NewAssignee(Guid userId, string name, string? email, string? designation) =>
        new(Id, RequestId, userId, name, email, designation);
    public void Activate() { Status = StepStatus.Pending; ActivatedAt = DateTime.UtcNow; }
    public void Skip(string reason) { Status = StepStatus.Skipped; SkipReason = reason; }
    public void Decide(bool approve, Guid by, string byName, string? designation, string? comment)
    {
        Status = approve ? StepStatus.Approved : StepStatus.Rejected;
        DecidedById = by; DecidedByName = byName; DecidedByDesignation = designation; DecidedAt = DateTime.UtcNow; Comment = Txt.OrNull(comment);
    }
    public void AttachPdf(string name, byte[] data, string hash) { PdfName = name; PdfData = data; PdfHash = hash; }
}

/// <summary>A person who may act on a step. Kept as its own table so "what is waiting for me" is one indexed query.</summary>
public sealed class WfStepAssignee
{
    private WfStepAssignee() { }
    public WfStepAssignee(Guid stepId, Guid requestId, Guid userId, string name, string? email, string? designation)
    { Id = Guid.NewGuid(); StepId = stepId; RequestId = requestId; UserId = userId; Name = name; Email = email; Designation = designation; }

    public Guid    Id          { get; private set; }
    public Guid    StepId      { get; private set; }
    public Guid    RequestId   { get; private set; }
    public Guid    UserId      { get; private set; }
    public string  Name        { get; private set; } = string.Empty;
    public string? Email       { get; private set; }
    public string? Designation { get; private set; }
}

public sealed class WfAttachment
{
    private WfAttachment() { }
    public WfAttachment(Guid requestId, string? fieldKey, string fileName, string contentType, byte[] data, Guid by, string byName)
    {
        Id = Guid.NewGuid(); RequestId = requestId; FieldKey = Txt.OrNull(fieldKey); FileName = fileName; ContentType = contentType;
        Data = data; Size = data.LongLength; UploadedById = by; UploadedByName = byName; CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id             { get; private set; }
    public Guid    RequestId      { get; private set; }
    public string? FieldKey       { get; private set; }
    public string  FileName       { get; private set; } = string.Empty;
    public string  ContentType    { get; private set; } = string.Empty;
    public long    Size           { get; private set; }
    public byte[]  Data           { get; private set; } = [];
    public Guid    UploadedById   { get; private set; }
    public string  UploadedByName { get; private set; } = string.Empty;
    public bool    IsDeleted      { get; private set; }
    public DateTime CreatedAt     { get; private set; }
    public void Delete() => IsDeleted = true;
}

public sealed class WfComment
{
    private WfComment() { }
    public WfComment(Guid requestId, Guid by, string byName, string text)
    { Id = Guid.NewGuid(); RequestId = requestId; AuthorId = by; AuthorName = byName; Text = text.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid   Id         { get; private set; }
    public Guid   RequestId  { get; private set; }
    public Guid   AuthorId   { get; private set; }
    public string AuthorName { get; private set; } = string.Empty;
    public string Text       { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
}

/// <summary>
/// Append-only. Nothing in the application updates or deletes a row here; every handler that changes
/// something, and every read of a request, adds one.
/// </summary>
public sealed class WfAudit
{
    private WfAudit() { }
    public WfAudit(Guid? userId, string? userName, string action, string entityType, Guid? entityId, Guid? requestId, string? detail, string? ip)
    {
        Id = Guid.NewGuid(); UserId = userId; UserName = userName; Action = action; EntityType = entityType;
        EntityId = entityId; RequestId = requestId; Detail = detail; Ip = ip; At = DateTime.UtcNow;
    }

    public Guid    Id         { get; private set; }
    public DateTime At        { get; private set; }
    public Guid?   UserId     { get; private set; }
    public string? UserName   { get; private set; }
    public string  Action     { get; private set; } = string.Empty;
    public string  EntityType { get; private set; } = string.Empty;
    public Guid?   EntityId   { get; private set; }
    public Guid?   RequestId  { get; private set; }
    public string? Detail     { get; private set; }
    public string? Ip         { get; private set; }
}

/// <summary>A kind of reconciliation document (Daily Revenue Reconciliation, Bank Reconciliation…).</summary>
public sealed class WfDocType
{
    private WfDocType() { }
    public WfDocType(string name, string frequency) { Id = Guid.NewGuid(); Name = name.Trim(); Frequency = frequency; CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Name        { get; private set; } = string.Empty;
    public string  Frequency   { get; private set; } = DocFrequency.Daily;
    public string? Description { get; private set; }
    public int     SortOrder   { get; private set; }
    public bool    IsActive    { get; private set; } = true;
    public bool    IsDeleted   { get; private set; }
    public string? TemplateName { get; private set; }
    public string? TemplateContentType { get; private set; }
    public byte[]? TemplateData { get; private set; }
    public DateTime CreatedAt  { get; private set; }

    public void Update(string name, string frequency, string? description, int sort, bool active)
    { Name = name.Trim(); Frequency = frequency; Description = Txt.OrNull(description); SortOrder = sort; IsActive = active; }
    public void SetTemplate(string? name, string? contentType, byte[]? data)
    { TemplateName = name; TemplateContentType = contentType; TemplateData = data; }
    public void Delete() => IsDeleted = true;
}

/// <summary>
/// A file in the repository. <see cref="PeriodDate"/> is the day it covers (daily documents) or the
/// first day of the month it covers (monthly documents), as yyyy-MM-dd.
/// </summary>
public sealed class WfRepoDocument
{
    private WfRepoDocument() { }
    public WfRepoDocument(Guid docTypeId, Guid baseId, string periodDate, string fileName, string contentType, byte[] data,
        string? notes, Guid by, string byName)
    {
        Id = Guid.NewGuid(); DocTypeId = docTypeId; BaseId = baseId; PeriodDate = periodDate; FileName = fileName;
        ContentType = contentType; Data = data; Size = data.LongLength; Notes = Txt.OrNull(notes);
        UploadedById = by; UploadedByName = byName; CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id             { get; private set; }
    public Guid    DocTypeId      { get; private set; }
    public Guid    BaseId         { get; private set; }
    public string  PeriodDate     { get; private set; } = string.Empty;
    public string  FileName       { get; private set; } = string.Empty;
    public string  ContentType    { get; private set; } = string.Empty;
    public long    Size           { get; private set; }
    public byte[]  Data           { get; private set; } = [];
    public string? Notes          { get; private set; }
    public Guid    UploadedById   { get; private set; }
    public string  UploadedByName { get; private set; } = string.Empty;
    public bool    IsDeleted      { get; private set; }
    public DateTime CreatedAt     { get; private set; }
    public void Delete() => IsDeleted = true;
}

/// <summary>
/// The employee directory (R5). Refreshed by import (or later by a Microsoft 365 / HR sync). An import
/// that is a full list can mark everyone it did not mention inactive, so leavers drop out of the list.
/// </summary>
public sealed class WfEmployee
{
    private WfEmployee() { }
    public WfEmployee(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string? Code        { get; private set; }
    public string  Name        { get; private set; } = string.Empty;
    public string? Email       { get; private set; }
    public string? Phone       { get; private set; }
    public string? Designation { get; private set; }
    public string? Department  { get; private set; }
    public string? ManagerName { get; private set; }
    public Guid?   BaseId      { get; private set; }
    public Guid?   UnitId      { get; private set; }
    public Guid?   UserId      { get; private set; }
    public bool    IsActive    { get; private set; } = true;
    /// <summary>manual | import | microsoft365 | hr</summary>
    public string  Source      { get; private set; } = "manual";
    public DateTime? LastSyncedAt { get; private set; }
    public bool    IsDeleted   { get; private set; }
    public DateTime CreatedAt  { get; private set; }

    public void Update(string? code, string name, string? email, string? phone, string? designation, string? department,
        string? manager, Guid? baseId, Guid? unitId, bool active)
    {
        Code = Txt.OrNull(code); Name = name.Trim(); Email = Txt.OrNull(email)?.ToLowerInvariant(); Phone = Txt.OrNull(phone);
        Designation = Txt.OrNull(designation); Department = Txt.OrNull(department); ManagerName = Txt.OrNull(manager);
        BaseId = baseId; UnitId = unitId; IsActive = active;
    }
    public void MarkSynced(string source) { Source = source; LastSyncedAt = DateTime.UtcNow; }
    public void LinkUser(Guid? userId) => UserId = userId;
    public void Deactivate() => IsActive = false;
    public void Delete() => IsDeleted = true;
}

public static class Txt
{
    public static string? OrNull(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

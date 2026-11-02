using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Fitness.API.Authorization;
using Softaxis.Fitness.API.Controllers.Common;
using Softaxis.Fitness.Application.Classes;
using Softaxis.Fitness.Application.Dashboard;
using Softaxis.Fitness.Application.Desk;
using Softaxis.Fitness.Application.Facility;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Application.Reports;
using Softaxis.Fitness.Application.Setup;
using Softaxis.Fitness.Application.Training;

namespace Softaxis.Fitness.API.Controllers;

/// <summary>Permission keys, so a typo in one place cannot silently open or lock an endpoint.</summary>
internal static class Perm
{
    public const string MembersView = "fitness.members.view", MembersCreate = "fitness.members.create",
        MembersEdit = "fitness.members.edit", MembersDelete = "fitness.members.delete";
    public const string MshipView = "fitness.memberships.view", MshipCreate = "fitness.memberships.create",
        MshipEdit = "fitness.memberships.edit";
    public const string PayView = "fitness.payments.view", PayCreate = "fitness.payments.create", PayVoid = "fitness.payments.approve";
    public const string CheckView = "fitness.checkin.view", CheckCreate = "fitness.checkin.create", CheckEdit = "fitness.checkin.edit";
    public const string ClassView = "fitness.classes.view", ClassCreate = "fitness.classes.create",
        ClassEdit = "fitness.classes.edit", ClassDelete = "fitness.classes.delete";
    public const string TrainView = "fitness.training.view", TrainCreate = "fitness.training.create",
        TrainEdit = "fitness.training.edit", TrainDelete = "fitness.training.delete";
    public const string FacView = "fitness.facility.view", FacCreate = "fitness.facility.create",
        FacEdit = "fitness.facility.edit", FacDelete = "fitness.facility.delete";
    public const string LeadView = "fitness.leads.view", LeadCreate = "fitness.leads.create",
        LeadEdit = "fitness.leads.edit", LeadDelete = "fitness.leads.delete";
    public const string SetupView = "fitness.setup.view", SetupEdit = "fitness.setup.edit";
    public const string ReportsView = "fitness.reports.view";

    /// <summary>Lists that feed forms across the module (branches, plans, trainers, classes): any Fitness user may read them.</summary>
    public static readonly string[] AnyView =
    [
        MembersView, MshipView, PayView, CheckView, ClassView, TrainView, FacView, LeadView, SetupView, ReportsView,
    ];
}

// ── Setup: branches, plans, settings ────────────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class SetupController(ISender sender) : FitnessControllerBase
{
    [HttpGet("branches")][RequirePermission(Perm.MembersView, Perm.MshipView, Perm.PayView, Perm.CheckView, Perm.ClassView, Perm.TrainView, Perm.FacView, Perm.LeadView, Perm.SetupView, Perm.ReportsView)]
    public async Task<IActionResult> Branches([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBranchesQuery(activeOnly), ct));

    [HttpPost("branches")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> CreateBranch(SaveBranchCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("branches/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> UpdateBranch(Guid id, SaveBranchCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("branches/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> DeleteBranch(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteBranchCommand(id), ct));

    [HttpGet("plans")][RequirePermission(Perm.MembersView, Perm.MshipView, Perm.PayView, Perm.CheckView, Perm.ClassView, Perm.TrainView, Perm.FacView, Perm.LeadView, Perm.SetupView, Perm.ReportsView)]
    public async Task<IActionResult> Plans([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPlansQuery(activeOnly), ct));

    [HttpPost("plans")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> CreatePlan(SavePlanCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("plans/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> UpdatePlan(Guid id, SavePlanCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("plans/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> DeletePlan(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePlanCommand(id), ct));

    [HttpGet("settings")][RequirePermission(Perm.MembersView, Perm.MshipView, Perm.PayView, Perm.CheckView, Perm.ClassView, Perm.TrainView, Perm.FacView, Perm.LeadView, Perm.SetupView, Perm.ReportsView)]
    public async Task<IActionResult> Settings(CancellationToken ct) => OkOrError(await sender.Send(new GetSettingsQuery(), ct));

    [HttpPut("settings")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> UpdateSettings(UpdateSettingsCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));
}

// ── Members, memberships, payments, progress ────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class MembersController(ISender sender) : FitnessControllerBase
{
    public sealed record StatusRequest(string Status, string? Reason);

    [HttpGet("members")][RequirePermission(Perm.MembersView, Perm.CheckView, Perm.MshipView, Perm.ClassView, Perm.TrainView)]
    public async Task<IActionResult> List([FromQuery] GetMembersQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpGet("members/{id:guid}")][RequirePermission(Perm.MembersView, Perm.CheckView, Perm.MshipView, Perm.ClassView, Perm.TrainView)]
    public async Task<IActionResult> Get(Guid id, [FromQuery] string? today, CancellationToken ct) => OkOrError(await sender.Send(new GetMemberQuery(id, today), ct));

    [HttpPost("members")][RequirePermission(Perm.MembersCreate)]
    public async Task<IActionResult> Create(CreateMemberCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPut("members/{id:guid}")][RequirePermission(Perm.MembersEdit)]
    public async Task<IActionResult> Update(Guid id, UpdateMemberCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPatch("members/{id:guid}/status")][RequirePermission(Perm.MembersEdit)]
    public async Task<IActionResult> SetStatus(Guid id, StatusRequest r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetMemberStatusCommand(id, r.Status, r.Reason), ct));

    [HttpDelete("members/{id:guid}")][RequirePermission(Perm.MembersDelete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteMemberCommand(id), ct));

    // Memberships
    [HttpPost("members/{id:guid}/memberships")][RequirePermission(Perm.MshipCreate)]
    public async Task<IActionResult> Sell(Guid id, SellMembershipCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { MemberId = id }, ct));

    [HttpPost("memberships/{id:guid}/freeze")][RequirePermission(Perm.MshipEdit)]
    public async Task<IActionResult> Freeze(Guid id, FreezeMembershipCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { SubscriptionId = id }, ct));

    [HttpPost("memberships/{id:guid}/unfreeze")][RequirePermission(Perm.MshipEdit)]
    public async Task<IActionResult> Unfreeze(Guid id, [FromQuery] string? today, CancellationToken ct) => OkOrError(await sender.Send(new UnfreezeMembershipCommand(id, today), ct));

    [HttpPost("memberships/{id:guid}/cancel")][RequirePermission(Perm.MshipEdit)]
    public async Task<IActionResult> CancelMembership(Guid id, CancelMembershipCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { SubscriptionId = id }, ct));

    [HttpPut("memberships/{id:guid}/adjust")][RequirePermission(Perm.MshipEdit)]
    public async Task<IActionResult> Adjust(Guid id, AdjustMembershipCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { SubscriptionId = id }, ct));

    // Payments
    [HttpGet("payments")][RequirePermission(Perm.PayView)]
    public async Task<IActionResult> Payments([FromQuery] GetPaymentsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("payments")][RequirePermission(Perm.PayCreate)]
    public async Task<IActionResult> RecordPayment(RecordPaymentCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPost("payments/{id:guid}/void")][RequirePermission(Perm.PayVoid)]
    public async Task<IActionResult> VoidPayment(Guid id, VoidPaymentCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    // Progress and programs (part of looking after a member, so gated on member edit)
    [HttpGet("members/{id:guid}/measurements")][RequirePermission(Perm.MembersView, Perm.TrainView)]
    public async Task<IActionResult> Measurements(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetMeasurementsQuery(id), ct));

    [HttpPost("members/{id:guid}/measurements")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> AddMeasurement(Guid id, SaveMeasurementCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null, MemberId = id }, ct));

    [HttpPut("measurements/{id:guid}")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> UpdateMeasurement(Guid id, SaveMeasurementCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("measurements/{id:guid}")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> DeleteMeasurement(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteMeasurementCommand(id), ct));

    [HttpGet("programs")][RequirePermission(Perm.MembersView, Perm.TrainView)]
    public async Task<IActionResult> Programs([FromQuery] GetProgramsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("programs")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> CreateProgram(SaveProgramCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("programs/{id:guid}")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> UpdateProgram(Guid id, SaveProgramCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("programs/{id:guid}/assign")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> AssignProgram(Guid id, AssignProgramCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { TemplateId = id }, ct));

    [HttpDelete("programs/{id:guid}")][RequirePermission(Perm.MembersEdit, Perm.TrainEdit)]
    public async Task<IActionResult> DeleteProgram(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteProgramCommand(id), ct));
}

// ── Front desk ──────────────────────────────────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class DeskController(ISender sender) : FitnessControllerBase
{
    [HttpPost("checkin")][RequirePermission(Perm.CheckCreate)]
    public async Task<IActionResult> CheckIn(CheckInCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPost("checkin/guest")][RequirePermission(Perm.CheckCreate)]
    public async Task<IActionResult> Guest(GuestCheckInCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPost("visits/{id:guid}/checkout")][RequirePermission(Perm.CheckCreate)]
    public async Task<IActionResult> CheckOut(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new CheckOutCommand(id), ct));

    [HttpPost("checkout-all")][RequirePermission(Perm.CheckEdit)]
    public async Task<IActionResult> CheckOutAll(CheckOutAllCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpGet("visits")][RequirePermission(Perm.CheckView, Perm.MembersView)]
    public async Task<IActionResult> Visits([FromQuery] GetVisitsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpGet("occupancy")][RequirePermission(Perm.CheckView)]
    public async Task<IActionResult> Occupancy([FromQuery] string? today, CancellationToken ct) => OkOrError(await sender.Send(new GetOccupancyQuery(today), ct));
}

// ── Classes ─────────────────────────────────────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class ClassesController(ISender sender) : FitnessControllerBase
{
    public sealed record CancelRequest(string? Reason, bool CancelSeries);
    public sealed record CompleteRequest(bool MarkUnattendedAsNoShow);
    public sealed record AttendanceRequest(string Status);

    [HttpGet("class-types")][RequirePermission(Perm.ClassView, Perm.MembersView, Perm.TrainView, Perm.SetupView)]
    public async Task<IActionResult> Types([FromQuery] bool activeOnly, CancellationToken ct) => OkOrError(await sender.Send(new GetClassTypesQuery(activeOnly), ct));

    [HttpPost("class-types")][RequirePermission(Perm.ClassCreate)]
    public async Task<IActionResult> CreateType(SaveClassTypeCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("class-types/{id:guid}")][RequirePermission(Perm.ClassEdit)]
    public async Task<IActionResult> UpdateType(Guid id, SaveClassTypeCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("class-types/{id:guid}")][RequirePermission(Perm.ClassDelete)]
    public async Task<IActionResult> DeleteType(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteClassTypeCommand(id), ct));

    [HttpGet("sessions")][RequirePermission(Perm.ClassView, Perm.MembersView)]
    public async Task<IActionResult> Sessions([FromQuery] GetSessionsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("sessions")][RequirePermission(Perm.ClassCreate)]
    public async Task<IActionResult> Schedule(ScheduleClassCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPut("sessions/{id:guid}")][RequirePermission(Perm.ClassEdit)]
    public async Task<IActionResult> UpdateSession(Guid id, UpdateSessionCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("sessions/{id:guid}/cancel")][RequirePermission(Perm.ClassEdit)]
    public async Task<IActionResult> CancelSession(Guid id, CancelRequest r, CancellationToken ct) => OkOrError(await sender.Send(new CancelSessionCommand(id, r.Reason, r.CancelSeries), ct));

    [HttpPost("sessions/{id:guid}/complete")][RequirePermission(Perm.ClassEdit)]
    public async Task<IActionResult> CompleteSession(Guid id, CompleteRequest r, CancellationToken ct) => OkOrError(await sender.Send(new CompleteSessionCommand(id, r.MarkUnattendedAsNoShow), ct));

    [HttpDelete("sessions/{id:guid}")][RequirePermission(Perm.ClassDelete)]
    public async Task<IActionResult> DeleteSession(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteSessionCommand(id), ct));

    [HttpGet("bookings")][RequirePermission(Perm.ClassView, Perm.MembersView)]
    public async Task<IActionResult> Bookings([FromQuery] GetBookingsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("bookings")][RequirePermission(Perm.ClassCreate, Perm.CheckCreate)]
    public async Task<IActionResult> Book(BookClassCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPost("bookings/{id:guid}/cancel")][RequirePermission(Perm.ClassEdit, Perm.CheckCreate)]
    public async Task<IActionResult> CancelBooking(Guid id, [FromQuery] string? today, [FromQuery] string? localTime, CancellationToken ct) =>
        OkOrError(await sender.Send(new CancelBookingCommand(id, today, localTime), ct));

    [HttpPut("bookings/{id:guid}/attendance")][RequirePermission(Perm.ClassEdit, Perm.CheckCreate)]
    public async Task<IActionResult> Attendance(Guid id, AttendanceRequest r, CancellationToken ct) => OkOrError(await sender.Send(new MarkAttendanceCommand(id, r.Status), ct));
}

// ── Trainers and personal training ──────────────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class TrainingController(ISender sender) : FitnessControllerBase
{
    public sealed record CloseRequest(string Status, string? SessionLog);

    [HttpGet("trainers")][RequirePermission(Perm.TrainView, Perm.MembersView, Perm.ClassView, Perm.SetupView)]
    public async Task<IActionResult> Trainers([FromQuery] bool activeOnly, CancellationToken ct) => OkOrError(await sender.Send(new GetTrainersQuery(activeOnly), ct));

    [HttpGet("trainers/{id:guid}/photo")][RequirePermission(Perm.TrainView, Perm.MembersView, Perm.ClassView)]
    public async Task<IActionResult> Photo(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetTrainerPhotoQuery(id), ct));

    [HttpPost("trainers")][RequirePermission(Perm.TrainCreate)]
    public async Task<IActionResult> CreateTrainer(SaveTrainerCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("trainers/{id:guid}")][RequirePermission(Perm.TrainEdit)]
    public async Task<IActionResult> UpdateTrainer(Guid id, SaveTrainerCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("trainers/{id:guid}")][RequirePermission(Perm.TrainDelete)]
    public async Task<IActionResult> DeleteTrainer(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteTrainerCommand(id), ct));

    [HttpGet("pt-packages")][RequirePermission(Perm.TrainView, Perm.MembersView)]
    public async Task<IActionResult> Packages([FromQuery] GetPtPackagesQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("pt-packages")][RequirePermission(Perm.TrainCreate)]
    public async Task<IActionResult> SellPackage(SellPtPackageCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPost("pt-packages/{id:guid}/cancel")][RequirePermission(Perm.TrainEdit)]
    public async Task<IActionResult> CancelPackage(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new CancelPtPackageCommand(id), ct));

    [HttpGet("pt-sessions")][RequirePermission(Perm.TrainView, Perm.MembersView)]
    public async Task<IActionResult> PtSessions([FromQuery] GetPtSessionsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("pt-sessions")][RequirePermission(Perm.TrainCreate)]
    public async Task<IActionResult> BookPt(BookPtSessionCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPut("pt-sessions/{id:guid}")][RequirePermission(Perm.TrainEdit)]
    public async Task<IActionResult> ReschedulePt(Guid id, ReschedulePtSessionCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("pt-sessions/{id:guid}/close")][RequirePermission(Perm.TrainEdit)]
    public async Task<IActionResult> ClosePt(Guid id, CloseRequest r, CancellationToken ct) => OkOrError(await sender.Send(new ClosePtSessionCommand(id, r.Status, r.SessionLog), ct));
}

// ── Equipment, lockers, leads ───────────────────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class FacilityController(ISender sender) : FitnessControllerBase
{
    [HttpGet("equipment")][RequirePermission(Perm.FacView)]
    public async Task<IActionResult> Equipment([FromQuery] GetEquipmentQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("equipment")][RequirePermission(Perm.FacCreate)]
    public async Task<IActionResult> CreateEquipment(SaveEquipmentCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("equipment/{id:guid}")][RequirePermission(Perm.FacEdit)]
    public async Task<IActionResult> UpdateEquipment(Guid id, SaveEquipmentCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("equipment/{id:guid}")][RequirePermission(Perm.FacDelete)]
    public async Task<IActionResult> DeleteEquipment(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteEquipmentCommand(id), ct));

    [HttpGet("equipment/{id:guid}/maintenance")][RequirePermission(Perm.FacView)]
    public async Task<IActionResult> Maintenance(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetMaintenanceQuery(id), ct));

    [HttpPost("equipment/{id:guid}/maintenance")][RequirePermission(Perm.FacEdit)]
    public async Task<IActionResult> RecordMaintenance(Guid id, RecordMaintenanceCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { EquipmentId = id }, ct));

    [HttpGet("lockers")][RequirePermission(Perm.FacView, Perm.CheckView)]
    public async Task<IActionResult> Lockers([FromQuery] GetLockersQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("lockers")][RequirePermission(Perm.FacCreate)]
    public async Task<IActionResult> CreateLocker(SaveLockerCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPost("lockers/bulk")][RequirePermission(Perm.FacCreate)]
    public async Task<IActionResult> AddLockers(AddLockersCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPut("lockers/{id:guid}")][RequirePermission(Perm.FacEdit)]
    public async Task<IActionResult> UpdateLocker(Guid id, SaveLockerCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("lockers/{id:guid}/assign")][RequirePermission(Perm.FacEdit, Perm.CheckCreate)]
    public async Task<IActionResult> AssignLocker(Guid id, AssignLockerCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("lockers/{id:guid}/release")][RequirePermission(Perm.FacEdit, Perm.CheckCreate)]
    public async Task<IActionResult> ReleaseLocker(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new ReleaseLockerCommand(id), ct));

    [HttpDelete("lockers/{id:guid}")][RequirePermission(Perm.FacDelete)]
    public async Task<IActionResult> DeleteLocker(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteLockerCommand(id), ct));

    [HttpGet("leads")][RequirePermission(Perm.LeadView)]
    public async Task<IActionResult> Leads([FromQuery] GetLeadsQuery q, CancellationToken ct) => OkOrError(await sender.Send(q, ct));

    [HttpPost("leads")][RequirePermission(Perm.LeadCreate)]
    public async Task<IActionResult> CreateLead(SaveLeadCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("leads/{id:guid}")][RequirePermission(Perm.LeadEdit)]
    public async Task<IActionResult> UpdateLead(Guid id, SaveLeadCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("leads/{id:guid}")][RequirePermission(Perm.LeadDelete)]
    public async Task<IActionResult> DeleteLead(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteLeadCommand(id), ct));
}

// ── Dashboard and reports ───────────────────────────────────────────────────

[Route("api/fitness")][Authorize]
public sealed class DashboardController(ISender sender) : FitnessControllerBase
{
    [HttpGet("dashboard")][RequirePermission(Perm.MembersView, Perm.CheckView, Perm.ReportsView)]
    public async Task<IActionResult> Dashboard([FromQuery] Guid? branchId, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFitnessDashboardQuery(branchId, today), ct));

    [HttpGet("reports/run/{id}")][RequirePermission(Perm.ReportsView)]
    public async Task<IActionResult> Run(string id, [FromQuery] string? from, [FromQuery] string? to, [FromQuery] Guid? branchId, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunFitnessReportQuery(id, from, to, branchId, today), ct));
}

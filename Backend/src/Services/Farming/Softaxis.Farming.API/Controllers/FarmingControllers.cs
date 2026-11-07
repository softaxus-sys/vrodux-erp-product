using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Farming.API.Authorization;
using Softaxis.Farming.API.Controllers.Common;
using Softaxis.Farming.Application;

namespace Softaxis.Farming.API.Controllers;

/// <summary>Permission keys, so a typo in one place cannot silently open or lock an endpoint.</summary>
internal static class Perm
{
    public const string SetupView = "farming.setup.view", SetupEdit = "farming.setup.edit";
    public const string LiveView = "farming.livestock.view", LiveCreate = "farming.livestock.create",
        LiveEdit = "farming.livestock.edit", LiveDelete = "farming.livestock.delete";
    public const string ProdView = "farming.production.view", ProdCreate = "farming.production.create",
        ProdEdit = "farming.production.edit", ProdDelete = "farming.production.delete";
    public const string HealthView = "farming.health.view", HealthCreate = "farming.health.create",
        HealthEdit = "farming.health.edit", HealthDelete = "farming.health.delete";
    public const string SalesView = "farming.sales.view", SalesCreate = "farming.sales.create",
        SalesEdit = "farming.sales.edit", SalesDelete = "farming.sales.delete";
    public const string ReportsView = "farming.reports.view";
}

// ── Setup: settings, farms, units ───────────────────────────────────────────

[Route("api/farming")][Authorize]
public sealed class FarmSetupController(ISender sender) : FarmingControllerBase
{
    // Settings, farms and units feed the pickers on every screen, so any Farming user may read them.
    [HttpGet("settings")][RequirePermission(Perm.SetupView, Perm.LiveView, Perm.ProdView, Perm.HealthView, Perm.SalesView, Perm.ReportsView)]
    public async Task<IActionResult> Settings(CancellationToken ct) => OkOrError(await sender.Send(new GetFarmSettingsQuery(), ct));

    [HttpPut("settings")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> UpdateSettings(UpdateFarmSettingsCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpGet("farms")][RequirePermission(Perm.SetupView, Perm.LiveView, Perm.ProdView, Perm.HealthView, Perm.SalesView, Perm.ReportsView)]
    public async Task<IActionResult> Farms(CancellationToken ct) => OkOrError(await sender.Send(new GetFarmsQuery(), ct));

    [HttpPost("farms")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> CreateFarm(SaveFarmCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("farms/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> UpdateFarm(Guid id, SaveFarmCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("farms/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> DeleteFarm(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteFarmCommand(id), ct));

    [HttpGet("units")][RequirePermission(Perm.SetupView, Perm.LiveView, Perm.ProdView, Perm.HealthView, Perm.SalesView, Perm.ReportsView)]
    public async Task<IActionResult> Units([FromQuery] Guid? farmId, [FromQuery] string? type, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetUnitsQuery(farmId, type), ct));

    [HttpPost("units")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> CreateUnit(SaveUnitCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("units/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> UpdateUnit(Guid id, SaveUnitCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("units/{id:guid}")][RequirePermission(Perm.SetupEdit)]
    public async Task<IActionResult> DeleteUnit(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteUnitCommand(id), ct));

    [HttpGet("reports/run/{id}")][RequirePermission(Perm.ReportsView)]
    public async Task<IActionResult> RunReport(string id, [FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunFarmReportQuery(id, from, to, today), ct));

    [HttpGet("dashboard")][RequirePermission(Perm.ReportsView)]
    public async Task<IActionResult> Dashboard([FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFarmDashboardQuery(today), ct));
}

// ── Livestock: animals, batches, breeding, weights ──────────────────────────

[Route("api/farming")][Authorize]
public sealed class LivestockController(ISender sender) : FarmingControllerBase
{
    // Animal and batch lists feed the production, health and sales forms.
    [HttpGet("animals")][RequirePermission(Perm.LiveView, Perm.ProdView, Perm.HealthView, Perm.SalesView)]
    public async Task<IActionResult> Animals([FromQuery] string? type, [FromQuery] string? status, [FromQuery] Guid? unitId,
        [FromQuery] string? search, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAnimalsQuery(type, status, unitId, search, today), ct));

    [HttpGet("animals/{id:guid}")][RequirePermission(Perm.LiveView)]
    public async Task<IActionResult> Animal(Guid id, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAnimalQuery(id, today), ct));

    [HttpPost("animals")][RequirePermission(Perm.LiveCreate)]
    public async Task<IActionResult> CreateAnimal(SaveAnimalCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("animals/{id:guid}")][RequirePermission(Perm.LiveEdit)]
    public async Task<IActionResult> UpdateAnimal(Guid id, SaveAnimalCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("animals/{id:guid}/status")][RequirePermission(Perm.LiveEdit)]
    public async Task<IActionResult> AnimalStatus(Guid id, SetAnimalStatusCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("animals/{id:guid}")][RequirePermission(Perm.LiveDelete)]
    public async Task<IActionResult> DeleteAnimal(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteAnimalCommand(id), ct));

    [HttpGet("batches")][RequirePermission(Perm.LiveView, Perm.ProdView, Perm.HealthView, Perm.SalesView)]
    public async Task<IActionResult> Batches([FromQuery] string? type, [FromQuery] string? status, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBatchesQuery(type, status, today), ct));

    [HttpPost("batches")][RequirePermission(Perm.LiveCreate)]
    public async Task<IActionResult> CreateBatch(SaveBatchCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("batches/{id:guid}")][RequirePermission(Perm.LiveEdit)]
    public async Task<IActionResult> UpdateBatch(Guid id, SaveBatchCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("batches/{id:guid}/close")][RequirePermission(Perm.LiveEdit)]
    public async Task<IActionResult> CloseBatch(Guid id, CloseBatchCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("batches/{id:guid}")][RequirePermission(Perm.LiveDelete)]
    public async Task<IActionResult> DeleteBatch(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteBatchCommand(id), ct));

    [HttpGet("breeding")][RequirePermission(Perm.LiveView)]
    public async Task<IActionResult> Breeding([FromQuery] Guid? animalId, [FromQuery] bool pendingOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBreedingQuery(animalId, pendingOnly), ct));

    [HttpPost("breeding")][RequirePermission(Perm.LiveCreate)]
    public async Task<IActionResult> CreateBreeding(SaveBreedingCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("breeding/{id:guid}")][RequirePermission(Perm.LiveEdit)]
    public async Task<IActionResult> UpdateBreeding(Guid id, SaveBreedingCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("breeding/{id:guid}/outcome")][RequirePermission(Perm.LiveEdit)]
    public async Task<IActionResult> BreedingOutcome(Guid id, RecordBreedingOutcomeCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("breeding/{id:guid}")][RequirePermission(Perm.LiveDelete)]
    public async Task<IActionResult> DeleteBreeding(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteBreedingCommand(id), ct));

    [HttpGet("weights")][RequirePermission(Perm.LiveView)]
    public async Task<IActionResult> Weights([FromQuery] Guid? animalId, [FromQuery] Guid? batchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWeightsQuery(animalId, batchId), ct));

    [HttpPost("weights")][RequirePermission(Perm.LiveCreate)]
    public async Task<IActionResult> AddWeight(AddWeightCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpDelete("weights/{id:guid}")][RequirePermission(Perm.LiveDelete)]
    public async Task<IActionResult> DeleteWeight(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteWeightCommand(id), ct));
}

// ── Daily records: production, feed ─────────────────────────────────────────

[Route("api/farming")][Authorize]
public sealed class ProductionController(ISender sender) : FarmingControllerBase
{
    [HttpGet("production")][RequirePermission(Perm.ProdView)]
    public async Task<IActionResult> Production([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? type,
        [FromQuery] string? product, [FromQuery] Guid? animalId, [FromQuery] Guid? batchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProductionQuery(from, to, type, product, animalId, batchId), ct));

    [HttpPost("production")][RequirePermission(Perm.ProdCreate)]
    public async Task<IActionResult> CreateProduction(SaveProductionCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPost("production/bulk")][RequirePermission(Perm.ProdCreate)]
    public async Task<IActionResult> BulkProduction(BulkProductionCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpPut("production/{id:guid}")][RequirePermission(Perm.ProdEdit)]
    public async Task<IActionResult> UpdateProduction(Guid id, SaveProductionCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("production/{id:guid}")][RequirePermission(Perm.ProdDelete)]
    public async Task<IActionResult> DeleteProduction(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteProductionCommand(id), ct));

    [HttpGet("feed")][RequirePermission(Perm.ProdView)]
    public async Task<IActionResult> Feed([FromQuery] string? from, [FromQuery] string? to, [FromQuery] Guid? batchId, [FromQuery] Guid? unitId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFeedQuery(from, to, batchId, unitId), ct));

    [HttpPost("feed")][RequirePermission(Perm.ProdCreate)]
    public async Task<IActionResult> CreateFeed(SaveFeedCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("feed/{id:guid}")][RequirePermission(Perm.ProdEdit)]
    public async Task<IActionResult> UpdateFeed(Guid id, SaveFeedCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("feed/{id:guid}")][RequirePermission(Perm.ProdDelete)]
    public async Task<IActionResult> DeleteFeed(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteFeedCommand(id), ct));
}

// ── Health and mortality ────────────────────────────────────────────────────

[Route("api/farming")][Authorize]
public sealed class HealthController(ISender sender) : FarmingControllerBase
{
    [HttpGet("health")][RequirePermission(Perm.HealthView)]
    public async Task<IActionResult> Health([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? kind,
        [FromQuery] Guid? animalId, [FromQuery] Guid? batchId, [FromQuery] bool dueOnly, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetHealthQuery(from, to, kind, animalId, batchId, dueOnly, today), ct));

    [HttpPost("health")][RequirePermission(Perm.HealthCreate)]
    public async Task<IActionResult> CreateHealth(SaveHealthCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("health/{id:guid}")][RequirePermission(Perm.HealthEdit)]
    public async Task<IActionResult> UpdateHealth(Guid id, SaveHealthCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpPost("health/{id:guid}/done")][RequirePermission(Perm.HealthEdit)]
    public async Task<IActionResult> ClearDue(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new ClearHealthDueCommand(id), ct));

    [HttpDelete("health/{id:guid}")][RequirePermission(Perm.HealthDelete)]
    public async Task<IActionResult> DeleteHealth(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteHealthCommand(id), ct));

    [HttpGet("mortality")][RequirePermission(Perm.HealthView)]
    public async Task<IActionResult> Mortality([FromQuery] string? from, [FromQuery] string? to, [FromQuery] Guid? batchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMortalityQuery(from, to, batchId), ct));

    [HttpPost("mortality")][RequirePermission(Perm.HealthCreate)]
    public async Task<IActionResult> AddMortality(AddMortalityCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    [HttpDelete("mortality/{id:guid}")][RequirePermission(Perm.HealthDelete)]
    public async Task<IActionResult> DeleteMortality(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteMortalityCommand(id), ct));
}

// ── Sales and expenses ──────────────────────────────────────────────────────

[Route("api/farming")][Authorize]
public sealed class FarmSalesController(ISender sender) : FarmingControllerBase
{
    [HttpGet("sales")][RequirePermission(Perm.SalesView)]
    public async Task<IActionResult> Sales([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? type,
        [FromQuery] string? product, [FromQuery] bool unpaidOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesQuery(from, to, type, product, unpaidOnly), ct));

    [HttpPost("sales")][RequirePermission(Perm.SalesCreate)]
    public async Task<IActionResult> CreateSale(SaveSaleCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("sales/{id:guid}")][RequirePermission(Perm.SalesEdit)]
    public async Task<IActionResult> UpdateSale(Guid id, SaveSaleCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("sales/{id:guid}")][RequirePermission(Perm.SalesDelete)]
    public async Task<IActionResult> DeleteSale(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteSaleCommand(id), ct));

    [HttpGet("expenses")][RequirePermission(Perm.SalesView)]
    public async Task<IActionResult> Expenses([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? category, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetExpensesQuery(from, to, category), ct));

    [HttpPost("expenses")][RequirePermission(Perm.SalesCreate)]
    public async Task<IActionResult> CreateExpense(SaveExpenseCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = null }, ct));

    [HttpPut("expenses/{id:guid}")][RequirePermission(Perm.SalesEdit)]
    public async Task<IActionResult> UpdateExpense(Guid id, SaveExpenseCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [HttpDelete("expenses/{id:guid}")][RequirePermission(Perm.SalesDelete)]
    public async Task<IActionResult> DeleteExpense(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteExpenseCommand(id), ct));
}

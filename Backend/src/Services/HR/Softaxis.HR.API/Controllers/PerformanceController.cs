using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Application.Performance.Queries;

namespace Softaxis.HR.API.Controllers;

[Route("api/hr/performance")]
[Authorize]
public sealed class PerformanceController(ISender sender) : HrControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetReviews(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 20,
        [FromQuery] string? status     = null,
        [FromQuery] Guid?   employeeId = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetPerformanceReviewsQuery(page, pageSize, status, employeeId), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPerformanceReviewByIdQuery(id), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePerformanceReviewCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReviewRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(
            new UpdatePerformanceReviewCommand(id, req.ReviewPeriod, req.ReviewType, req.DueDate, req.ReviewedBy), ct));

    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new StartPerformanceReviewCommand(id), ct));

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteReviewRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(
            new CompletePerformanceReviewCommand(id, req.OverallRating, req.TechnicalRating, req.CommunicationRating,
                req.TeamworkRating, req.LeadershipRating, req.Strengths, req.Improvements), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePerformanceReviewCommand(id), ct));

    [HttpPost("{id:guid}/goals")]
    public async Task<IActionResult> AddGoal(Guid id, [FromBody] CreateGoalRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddPerformanceGoalCommand(id, req.Title, req.Target, req.DueDate), ct));

    [HttpPut("{id:guid}/goals/{goalId:guid}")]
    public async Task<IActionResult> UpdateGoal(Guid id, Guid goalId, [FromBody] UpdateGoalRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UpdatePerformanceGoalCommand(id, goalId, req.Progress, req.Status), ct));

    [HttpDelete("{id:guid}/goals/{goalId:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id, Guid goalId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePerformanceGoalCommand(id, goalId), ct));

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPerformanceSummaryQuery(), ct));

    public sealed record UpdateReviewRequest(string ReviewPeriod, string ReviewType, string DueDate, string ReviewedBy);

    public sealed record CompleteReviewRequest(
        int? OverallRating, int? TechnicalRating, int? CommunicationRating,
        int? TeamworkRating, int? LeadershipRating, string? Strengths, string? Improvements);

    public sealed record CreateGoalRequest(string Title, string Target, string DueDate);

    public sealed record UpdateGoalRequest(int Progress, string Status);
}

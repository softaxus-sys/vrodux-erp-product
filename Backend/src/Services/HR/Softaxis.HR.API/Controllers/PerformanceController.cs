using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/performance")]
[Authorize]
public sealed class PerformanceController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record GoalDto(
        Guid   Id,
        string Title,
        string Target,
        int    Progress,
        string Status,
        string DueDate);

    public record ReviewDto(
        Guid     Id,
        Guid     EmployeeId,
        string   EmployeeName,
        string?  Department,
        string?  Designation,
        string   ReviewPeriod,
        string   ReviewType,
        string   Status,
        int?     OverallRating,
        int?     TechnicalRating,
        int?     CommunicationRating,
        int?     TeamworkRating,
        int?     LeadershipRating,
        string   ReviewedBy,
        string   DueDate,
        string?  CompletedDate,
        string?  Strengths,
        string?  Improvements,
        IReadOnlyList<GoalDto> Goals);

    public record CreateReviewRequest(
        Guid    EmployeeId,
        string  ReviewPeriod,
        string  ReviewType,
        string  DueDate,
        string  ReviewedBy);

    public record UpdateReviewRequest(
        string  ReviewPeriod,
        string  ReviewType,
        string  DueDate,
        string  ReviewedBy);

    public record CompleteReviewRequest(
        int?    OverallRating,
        int?    TechnicalRating,
        int?    CommunicationRating,
        int?    TeamworkRating,
        int?    LeadershipRating,
        string? Strengths,
        string? Improvements);

    public record CreateGoalRequest(string Title, string Target, string DueDate);

    public record UpdateGoalRequest(int Progress, string Status);

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    // ── GET /api/hr/performance ──────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetReviews(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? status   = null,
        [FromQuery] Guid?   employeeId = null,
        CancellationToken ct = default)
    {
        IQueryable<PerformanceReview> query = db.PerformanceReviews
            .AsNoTracking()
            .Include(x => x.Goals);

        if (employeeId is not null)
            query = query.Where(x => x.EmployeeId == employeeId);

        var all = await query.OrderBy(x => x.DueDate).ToListAsync(ct);
        var dtos = all.Select(ToDto).ToList();

        if (!string.IsNullOrWhiteSpace(status))
            dtos = dtos.Where(x => x.Status == status).ToList();

        var total      = dtos.Count;
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = dtos.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return Ok(new PagedResult<ReviewDto>(items, page, pageSize, total, totalPages, page < totalPages, page > 1));
    }

    // ── GET /api/hr/performance/{id} ─────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.AsNoTracking().Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();
        return Ok(ToDto(review));
    }

    // ── POST /api/hr/performance ─────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReviewRequest req, CancellationToken ct)
    {
        if (req.ReviewType is not ("annual" or "mid_year" or "probation" or "pip"))
            return BadRequest(new { error = "Review type must be one of: annual, mid_year, probation, pip." });

        var employee = await db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == req.EmployeeId, ct);
        if (employee is null) return NotFound(new { error = "Employee not found." });

        var review = new PerformanceReview(
            employee.Id, employee.FullName, employee.DepartmentName, employee.JobTitle,
            req.ReviewPeriod, req.ReviewType, req.DueDate, req.ReviewedBy);

        db.PerformanceReviews.Add(review);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = review.Id }, ToDto(review));
    }

    // ── PUT /api/hr/performance/{id} ─────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReviewRequest req, CancellationToken ct)
    {
        if (req.ReviewType is not ("annual" or "mid_year" or "probation" or "pip"))
            return BadRequest(new { error = "Review type must be one of: annual, mid_year, probation, pip." });

        var review = await db.PerformanceReviews.Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();

        review.Update(req.ReviewPeriod, req.ReviewType, req.DueDate, req.ReviewedBy);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/performance/{id}/start ──────────────────────────────
    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();

        if (review.Status != "pending")
            return BadRequest(new { error = "Only pending reviews can be started." });

        review.Start();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/performance/{id}/complete ───────────────────────────
    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteReviewRequest req, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();

        if (review.Status == "completed")
            return BadRequest(new { error = "Review is already completed." });

        foreach (var rating in new[] { req.OverallRating, req.TechnicalRating, req.CommunicationRating, req.TeamworkRating, req.LeadershipRating })
            if (rating is < 1 or > 5)
                return BadRequest(new { error = "Ratings must be between 1 and 5." });

        review.Complete(req.OverallRating, req.TechnicalRating, req.CommunicationRating, req.TeamworkRating, req.LeadershipRating, req.Strengths, req.Improvements);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(review));
    }

    // ── DELETE /api/hr/performance/{id} ──────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();

        review.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/performance/{id}/goals ──────────────────────────────
    [HttpPost("{id:guid}/goals")]
    public async Task<IActionResult> AddGoal(Guid id, [FromBody] CreateGoalRequest req, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (review is null) return NotFound();

        var goal = new PerformanceGoal(review.Id, req.Title, req.Target, req.DueDate);
        review.AddGoal(goal);
        await db.SaveChangesAsync(ct);

        return Ok(ToDto(review));
    }

    // ── PUT /api/hr/performance/{id}/goals/{goalId} ──────────────────────
    [HttpPut("{id:guid}/goals/{goalId:guid}")]
    public async Task<IActionResult> UpdateGoal(Guid id, Guid goalId, [FromBody] UpdateGoalRequest req, CancellationToken ct)
    {
        if (req.Status is not ("on_track" or "at_risk" or "achieved" or "missed"))
            return BadRequest(new { error = "Status must be one of: on_track, at_risk, achieved, missed." });

        var goal = await db.PerformanceGoals.FirstOrDefaultAsync(x => x.Id == goalId && x.PerformanceReviewId == id, ct);
        if (goal is null) return NotFound();

        goal.UpdateProgress(req.Progress, req.Status);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/performance/{id}/goals/{goalId} ───────────────────
    [HttpDelete("{id:guid}/goals/{goalId:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id, Guid goalId, CancellationToken ct)
    {
        var goal = await db.PerformanceGoals.FirstOrDefaultAsync(x => x.Id == goalId && x.PerformanceReviewId == id, ct);
        if (goal is null) return NotFound();

        db.PerformanceGoals.Remove(goal);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── GET /api/hr/performance/summary ──────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var reviews = await db.PerformanceReviews.AsNoTracking().ToListAsync(ct);

        var total     = reviews.Count;
        var completed = reviews.Count(x => x.Status == "completed");
        var pending   = reviews.Count(x => x.Status == "pending" && !IsOverdue(x));
        var overdue   = reviews.Count(IsOverdue);
        var inProgress = reviews.Count(x => x.Status == "in_progress" && !IsOverdue(x));

        var rated = reviews.Where(x => x.OverallRating.HasValue).ToList();
        var avgRating = rated.Count == 0 ? 0 : Math.Round(rated.Average(x => x.OverallRating!.Value), 1);

        return Ok(new
        {
            TotalReviews = total,
            Completed    = completed,
            Pending      = pending,
            InProgress   = inProgress,
            Overdue      = overdue,
            AvgRating    = avgRating,
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private static bool IsOverdue(PerformanceReview r) =>
        r.Status != "completed" && string.CompareOrdinal(r.DueDate, DateTime.UtcNow.ToString("yyyy-MM-dd")) < 0;

    private static ReviewDto ToDto(PerformanceReview r) => new(
        r.Id, r.EmployeeId, r.EmployeeName, r.Department, r.Designation,
        r.ReviewPeriod, r.ReviewType, IsOverdue(r) ? "overdue" : r.Status,
        r.OverallRating, r.TechnicalRating, r.CommunicationRating, r.TeamworkRating, r.LeadershipRating,
        r.ReviewedBy, r.DueDate, r.CompletedDate, r.Strengths, r.Improvements,
        r.Goals.Select(g => new GoalDto(g.Id, g.Title, g.Target, g.Progress, g.Status, g.DueDate)).ToList());
}

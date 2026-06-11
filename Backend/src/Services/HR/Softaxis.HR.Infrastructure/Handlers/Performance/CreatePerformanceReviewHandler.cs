using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class CreatePerformanceReviewHandler(HrDbContext db)
    : ICommandHandler<CreatePerformanceReviewCommand, ReviewDto>
{
    public async Task<Result<ReviewDto>> Handle(CreatePerformanceReviewCommand cmd, CancellationToken ct)
    {
        var employee = await db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.EmployeeId, ct);
        if (employee is null)
            return Result.Failure<ReviewDto>(Error.NotFoundById("Employee", cmd.EmployeeId));

        var review = new PerformanceReview(
            employee.Id, employee.FullName, employee.DepartmentName, employee.JobTitle,
            cmd.ReviewPeriod, cmd.ReviewType, cmd.DueDate, cmd.ReviewedBy);

        db.PerformanceReviews.Add(review);
        await db.SaveChangesAsync(ct);

        return Result.Success(PerformanceMappings.ToDto(review));
    }
}

using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal static class EmployeeMappings
{
    public static EmployeeDto ToDto(Employee e) => new(
        e.Id, e.EmployeeNumber, e.FirstName, e.LastName, e.FullName,
        e.Email, e.Phone, e.JobTitle, e.DepartmentId, e.DepartmentName,
        e.EmploymentType, e.BasicSalary, e.JoiningDate, e.TerminationDate,
        e.Status, e.ManagerId, e.Notes, e.CreatedAt, e.UpdatedAt);
}

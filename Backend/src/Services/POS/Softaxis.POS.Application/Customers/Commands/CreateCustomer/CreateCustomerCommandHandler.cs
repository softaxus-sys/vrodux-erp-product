using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Commands.CreateCustomer;

public sealed class CreateCustomerCommandHandler(
    ICustomerRepository customerRepo,
    IUnitOfWork         uow)
    : ICommandHandler<CreateCustomerCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(CreateCustomerCommand cmd, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(cmd.Phone))
        {
            var exists = await customerRepo.PhoneExistsAsync(cmd.Phone, null, ct);
            if (exists)
                return Result.Failure<CustomerDto>(Error.Custom("Customer.PhoneTaken",
                    $"Phone number '{cmd.Phone}' is already registered."));
        }

        var result = Customer.Create(cmd.Name, cmd.Phone, cmd.Email, cmd.Address, cmd.Notes);
        if (result.IsFailure)
            return Result.Failure<CustomerDto>(result.Error);

        customerRepo.Add(result.Value);
        await uow.SaveChangesAsync(ct);

        var c = result.Value;
        return Result.Success(new CustomerDto(
            c.Id, c.Name, c.Phone, c.Email, c.Address,
            c.LoyaltyPoints, c.TotalPurchases, c.IsActive, c.Notes, c.CreatedAt));
    }
}

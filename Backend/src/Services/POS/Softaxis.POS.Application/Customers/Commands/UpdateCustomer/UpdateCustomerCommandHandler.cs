using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Customers;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Commands.UpdateCustomer;

public sealed class UpdateCustomerCommandHandler(
    ICustomerRepository customerRepo,
    IUnitOfWork         uow)
    : ICommandHandler<UpdateCustomerCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(UpdateCustomerCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.Id, ct);
        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.Id));

        if (!string.IsNullOrWhiteSpace(cmd.Phone))
        {
            var phoneExists = await customerRepo.PhoneExistsAsync(cmd.Phone, cmd.Id, ct);
            if (phoneExists)
                return Result.Failure<CustomerDto>(Error.Custom("Customer.PhoneTaken",
                    $"Phone number '{cmd.Phone}' is already registered."));
        }

        var result = customer.Update(cmd.Name, cmd.Phone, cmd.Email, cmd.Address, cmd.Notes);
        if (result.IsFailure)
            return Result.Failure<CustomerDto>(result.Error);

        if (cmd.IsActive) customer.Activate(); else customer.Deactivate();

        customerRepo.Update(customer);
        await uow.SaveChangesAsync(ct);

        return Result.Success(CustomerMappings.ToDto(customer));
    }
}

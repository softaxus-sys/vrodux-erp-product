using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Commands.SetCreditLimit;

public sealed class SetCreditLimitCommandHandler(ICustomerRepository customerRepo, IUnitOfWork uow)
    : ICommandHandler<SetCreditLimitCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(SetCreditLimitCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.CustomerId, ct);
        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.CustomerId));

        var result = customer.SetCreditLimit(cmd.CreditLimit);
        if (result.IsFailure)
            return Result.Failure<CustomerDto>(result.Error);

        customerRepo.Update(customer);
        await uow.SaveChangesAsync(ct);

        return Result.Success(CustomerMappings.ToDto(customer));
    }
}

using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Commands.RecordHouseAccountPayment;

public sealed class RecordHouseAccountPaymentCommandHandler(
    ICustomerRepository customerRepo,
    ICustomerWalletTransactionRepository walletRepo,
    IUnitOfWork uow)
    : ICommandHandler<RecordHouseAccountPaymentCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(RecordHouseAccountPaymentCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.CustomerId, ct);
        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.CustomerId));

        var result = customer.RecordHouseAccountPayment(cmd.Amount);
        if (result.IsFailure)
            return Result.Failure<CustomerDto>(result.Error);

        customerRepo.Update(customer);
        walletRepo.Add(new CustomerWalletTransaction(customer.Id, "house_payment", cmd.Amount, null, cmd.Notes));
        await uow.SaveChangesAsync(ct);

        return Result.Success(CustomerMappings.ToDto(customer));
    }
}

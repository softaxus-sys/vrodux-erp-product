using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Commands.TopUpWallet;

public sealed class TopUpWalletCommandHandler(
    ICustomerRepository customerRepo,
    ICustomerWalletTransactionRepository walletRepo,
    IUnitOfWork uow)
    : ICommandHandler<TopUpWalletCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(TopUpWalletCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.CustomerId, ct);
        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.CustomerId));

        var result = customer.TopUpWallet(cmd.Amount);
        if (result.IsFailure)
            return Result.Failure<CustomerDto>(result.Error);

        customerRepo.Update(customer);
        walletRepo.Add(new CustomerWalletTransaction(customer.Id, "topup", cmd.Amount, null, cmd.Notes));
        await uow.SaveChangesAsync(ct);

        return Result.Success(CustomerMappings.ToDto(customer));
    }
}

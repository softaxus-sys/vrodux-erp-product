using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Credit;

public sealed class GetCustomerCreditHandler(IPosCreditReadService reader) : IQueryHandler<GetCustomerCreditQuery, CustomerCreditDto>
{
    public async Task<Result<CustomerCreditDto>> Handle(GetCustomerCreditQuery q, CancellationToken ct)
    {
        var dto = await reader.GetCustomerAsync(q.CustomerId, DateTime.UtcNow, ct);
        return dto is null
            ? Result.Failure<CustomerCreditDto>(Error.NotFoundById("Customer", q.CustomerId))
            : Result.Success(dto);
    }
}

public sealed class GetCreditOverviewHandler(IPosCreditReadService reader) : IQueryHandler<GetCreditOverviewQuery, CreditOverviewDto>
{
    public async Task<Result<CreditOverviewDto>> Handle(GetCreditOverviewQuery q, CancellationToken ct) =>
        Result.Success(await reader.GetOverviewAsync(DateTime.UtcNow, ct));
}

public sealed class SetCreditTermsHandler(ICustomerRepository customerRepo, IUnitOfWork uow) : ICommandHandler<SetCreditTermsCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(SetCreditTermsCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.CustomerId, ct);
        if (customer is null) return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.CustomerId));

        var r = customer.SetCreditTerms(cmd.Days);
        if (r.IsFailure) return Result.Failure<CustomerDto>(r.Error);

        customerRepo.Update(customer);
        await uow.SaveChangesAsync(ct);
        return Result.Success(CustomerMappings.ToDto(customer));
    }
}

public sealed class SetCreditHoldHandler(ICustomerRepository customerRepo, IUnitOfWork uow) : ICommandHandler<SetCreditHoldCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(SetCreditHoldCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.CustomerId, ct);
        if (customer is null) return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.CustomerId));

        if (cmd.Hold)
        {
            var r = customer.PlaceCreditHold(cmd.Reason);
            if (r.IsFailure) return Result.Failure<CustomerDto>(r.Error);
        }
        else customer.ReleaseCreditHold();

        customerRepo.Update(customer);
        await uow.SaveChangesAsync(ct);
        return Result.Success(CustomerMappings.ToDto(customer));
    }
}

using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ICustomerRepository
{
    Task<Customer?>  GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Customer?>  GetByPhoneAsync(string phone, CancellationToken ct = default);
    Task<bool>       PhoneExistsAsync(string phone, Guid? excludeId = null, CancellationToken ct = default);

    Task<PagedResult<Customer>> GetPagedAsync(
        int page, int pageSize, string? search = null,
        CancellationToken ct = default);

    void Add(Customer customer);
    void Update(Customer customer);
    void Remove(Customer customer);
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class PaymentGatewayConfigConfiguration : IEntityTypeConfiguration<PaymentGatewayConfig>
{
    public void Configure(EntityTypeBuilder<PaymentGatewayConfig> builder)
    {
        builder.ToTable("payment_gateway_configs");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Provider).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Mode).IsRequired().HasMaxLength(10);
        builder.Property(x => x.ApiKeyEncrypted).HasMaxLength(2000);
        builder.Property(x => x.SecretKeyEncrypted).HasMaxLength(2000);
        builder.Property(x => x.PublicKey).HasMaxLength(500);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

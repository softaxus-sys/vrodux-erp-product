using Softaxis.Inventory.Application.Products.Queries.LookupProductByCode;

namespace Softaxis.Inventory.Tests;

public class ScannedCodeTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("0000000000000")]
    public void Nothing_usable_returns_null(string? raw) => Assert.Null(ScannedCode.Parse(raw));

    [Fact]
    public void Plain_ean13_is_a_gtin()
    {
        var p = ScannedCode.Parse(" 5449000000996 ")!;
        Assert.Equal("5449000000996", p.Primary);
        Assert.Equal("5449000000996", p.Gtin);
    }

    [Fact]
    public void UpcA_is_also_searched_as_ean13_and_the_other_way_round()
    {
        var upc = ScannedCode.Parse("036000291452")!;
        Assert.Contains("0036000291452", upc.Candidates);
        Assert.Equal("0036000291452", upc.Gtin);

        var ean = ScannedCode.Parse("0036000291452")!;
        Assert.Contains("036000291452", ean.Candidates);
    }

    [Fact]
    public void Gs1_digital_link_qr_yields_the_gtin()
    {
        var p = ScannedCode.Parse("https://id.brand.com/01/06291003012345/10/LOT7?17=261231")!;
        Assert.Equal("06291003012345", p.Primary);
        Assert.Equal("6291003012345", p.Gtin!.TrimStart('0').PadLeft(13, '0'));
    }

    [Fact]
    public void Gs1_element_strings_yield_the_gtin()
    {
        Assert.Equal("06291003012345", ScannedCode.Parse("(01)06291003012345(17)261231")!.Primary);
        Assert.Equal("06291003012345", ScannedCode.Parse("010629100301234517261231")!.Primary);
    }

    [Fact]
    public void Link_with_a_code_parameter_yields_the_code()
        => Assert.Equal("5449000000996", ScannedCode.Parse("https://shop.example.com/p?barcode=5449000000996")!.Primary);

    [Fact]
    public void A_link_with_no_code_in_it_is_not_a_product_code()
        => Assert.Null(ScannedCode.Parse("https://www.brand.com/about-us"));

    [Fact]
    public void A_shop_sku_is_kept_as_is_and_is_not_a_gtin()
    {
        var p = ScannedCode.Parse("ITM-0042")!;
        Assert.Equal("ITM-0042", p.Primary);
        Assert.Null(p.Gtin);
    }
}

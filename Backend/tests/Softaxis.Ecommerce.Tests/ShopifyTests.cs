using System.Text.Json;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Services;
using Softaxis.Ecommerce.Infrastructure.Services.Shopify;

namespace Softaxis.Ecommerce.Tests;

public class ShopAddressTests
{
    [Theory]
    [InlineData("my-shop.myshopify.com")]
    [InlineData("MY-SHOP.MYSHOPIFY.COM")]
    [InlineData("a1.myshopify.com")]
    public void Real_shop_addresses_are_accepted(string d) => Assert.True(ShopifyProvider.IsValidShopDomain(d));

    // The address becomes the host of an outbound request, so anything that is not a myshopify.com shop is refused.
    [Theory]
    [InlineData("evil.com")]
    [InlineData("my-shop.myshopify.com.evil.com")]
    [InlineData("evil.com/my-shop.myshopify.com")]
    [InlineData("https://my-shop.myshopify.com")]
    [InlineData("my-shop.myshopify.com:8080")]
    [InlineData("localhost")]
    [InlineData("127.0.0.1")]
    [InlineData("-bad.myshopify.com")]
    [InlineData("")]
    [InlineData(null)]
    public void Anything_else_is_refused(string? d) => Assert.False(ShopifyProvider.IsValidShopDomain(d));
}

public class ShopifyMapperTests
{
    private static ProductPushVariant V(string size, string? sku, decimal price, string? externalId = null, bool track = true, decimal? weight = 300) =>
        new(Guid.NewGuid(), sku, null, price, [size], track, weight, externalId);

    private static ProductPush Push(IReadOnlyList<ProductPushVariant> vs, IReadOnlyList<string>? options = null, IReadOnlyList<ProductPushImage>? images = null) =>
        new("Shirt", "<p>x</p>", "Brand", "Cat", "a,b", "shirt", true, "seo", "meta", options ?? ["Size"], vs, images);

    [Fact]
    public void Price_is_sent_with_two_decimals_and_a_dot_whatever_the_culture()
    {
        var old = System.Globalization.CultureInfo.CurrentCulture;
        System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("de-DE");
        try
        {
            var json = ShopifyMapper.BuildProduct(Push([V("S", "A", 99.5m)]), null);
            Assert.Equal("99.50", json["product"]!["variants"]![0]!["price"]!.GetValue<string>());
        }
        finally { System.Globalization.CultureInfo.CurrentCulture = old; }
    }

    [Fact]
    public void Photos_are_left_alone_unless_a_list_is_given()
    {
        Assert.Null(ShopifyMapper.BuildProduct(Push([V("S", "A", 1)], images: null), "7")["product"]!["images"]);
        var with = ShopifyMapper.BuildProduct(Push([V("S", "A", 1)], images: [new([1, 2, 3], "a.png", "front")]), "7");
        Assert.Single(with["product"]!["images"]!.AsArray());
        Assert.Equal("front", with["product"]!["images"]![0]!["alt"]!.GetValue<string>());
    }

    [Fact]
    public void An_existing_product_and_known_variants_are_updated_by_id()
    {
        var json = ShopifyMapper.BuildProduct(Push([V("S", "A", 1, externalId: "123"), V("M", "B", 1)]), "777");
        Assert.Equal(777, json["product"]!["id"]!.GetValue<long>());
        Assert.Equal(123, json["product"]!["variants"]![0]!["id"]!.GetValue<long>());
        Assert.Null(json["product"]!["variants"]![1]!["id"]);
    }

    [Fact]
    public void Untracked_variants_do_not_ask_the_store_to_track_stock_and_never_oversell_when_tracked()
    {
        var v = ShopifyMapper.BuildProduct(Push([V("S", "A", 1, track: false), V("M", "B", 1)]), null)["product"]!["variants"]!;
        Assert.Null(v[0]!["inventory_management"]);
        Assert.Equal("shopify", v[1]!["inventory_management"]!.GetValue<string>());
        Assert.Equal("deny", v[1]!["inventory_policy"]!.GetValue<string>());
    }

    [Fact]
    public void Draft_when_not_active_and_options_only_when_there_are_some()
    {
        var p = Push([new(Guid.NewGuid(), "A", null, 1, [], true, null, null)], options: []) with { Active = false };
        var json = ShopifyMapper.BuildProduct(p, null)["product"]!;
        Assert.Equal("draft", json["status"]!.GetValue<string>());
        Assert.Null(json["options"]);
        Assert.Null(json["variants"]![0]!["option1"]);
    }

    [Fact]
    public void Returned_variants_are_matched_by_id_then_by_option_values()
    {
        var s = V("S", "A", 1, externalId: "11"); var m = V("M", "B", 1);
        using var doc = JsonDocument.Parse("""
            {"id":900,"handle":"shirt","variants":[
              {"id":11,"sku":"A","inventory_item_id":501,"option1":"S"},
              {"id":12,"sku":"B","inventory_item_id":502,"option1":"M"}]}
            """);
        var pushed = ShopifyMapper.ParseProduct(doc.RootElement, [s, m]);
        Assert.Equal("900", pushed.ExternalProductId);
        Assert.Equal(s.ProductId, pushed.Variants.Single(v => v.ExternalVariantId == "11").ProductId);
        Assert.Equal(m.ProductId, pushed.Variants.Single(v => v.ExternalVariantId == "12").ProductId);
        Assert.Equal("502", pushed.Variants.Single(v => v.ExternalVariantId == "12").ExternalInventoryItemId);
    }

    [Fact]
    public void A_product_with_no_options_matches_its_only_variant()
    {
        var only = new ProductPushVariant(Guid.NewGuid(), "A", null, 1, [], true, null, null);
        using var doc = JsonDocument.Parse("""{"id":1,"variants":[{"id":5,"inventory_item_id":6,"option1":"Default Title"}]}""");
        var pushed = ShopifyMapper.ParseProduct(doc.RootElement, [only]);
        Assert.Equal(only.ProductId, Assert.Single(pushed.Variants).ProductId);
    }

    [Fact]
    public void Orders_are_read_with_numeric_ids_customer_and_cancellation()
    {
        using var doc = JsonDocument.Parse("""
            {"orders":[{"id":820982911946154508,"name":"#1001","email":"a@b.c","created_at":"2026-10-01T10:00:00Z","updated_at":"2026-10-02T10:00:00Z",
              "cancelled_at":"2026-10-02T09:00:00Z","financial_status":"paid","fulfillment_status":null,"total_price":"218.00","currency":"USD",
              "customer":{"first_name":"Ann","last_name":"Lee"},
              "line_items":[{"variant_id":4400,"sku":"X","title":"Shirt","quantity":2,"price":"109.00"}]}]}
            """);
        var o = ShopifyMapper.ParseOrders(doc.RootElement).Single();
        Assert.Equal("820982911946154508", o.ExternalId);
        Assert.Equal("Ann Lee", o.CustomerName);
        Assert.NotNull(o.CancelledAt);
        Assert.Equal(218m, o.Total);
        Assert.Equal(2m, o.Lines[0].Quantity);
        Assert.Equal("4400", o.Lines[0].ExternalVariantId);
    }
}

public class ShopifyProviderHelperTests
{
    [Fact]
    public void The_next_page_is_taken_from_the_link_header_without_the_version()
    {
        var next = ShopifyProvider.NextLink(["<https://s.myshopify.com/admin/api/2025-10/orders.json?limit=250&page_info=abc>; rel=\"next\""]);
        Assert.Equal("orders.json?limit=250&page_info=abc", next);
    }

    [Fact]
    public void The_last_page_has_no_next_link()
    {
        Assert.Null(ShopifyProvider.NextLink(["<https://s.myshopify.com/admin/api/2025-10/orders.json?page_info=p>; rel=\"previous\""]));
        Assert.Null(ShopifyProvider.NextLink([]));
    }

    [Fact]
    public void Both_shapes_of_shopify_error_are_turned_into_text()
    {
        Assert.Equal("Invalid token", ShopifyProvider.ExtractErrors("""{"errors":"Invalid token"}"""));
        Assert.Equal("title can't be blank", ShopifyProvider.ExtractErrors("""{"errors":{"title":["can't be blank"]}}"""));
        Assert.Null(ShopifyProvider.ExtractErrors("not json"));
        Assert.Null(ShopifyProvider.ExtractErrors(""));
    }
}

public class SyncRulesTests
{
    private static TemplateSnapshot Snap(decimal price = 10, decimal stock = 5, string desc = "d") => new(
        Guid.Parse("11111111-1111-1111-1111-111111111111"), "Shirt", desc, null, "Cat", "Brand", "shirt", null, null, "a",
        ["Size"], true, true,
        [new SnapshotVariant(Guid.Parse("22222222-2222-2222-2222-222222222222"), "S", "SKU", null, new Dictionary<string, string> { ["Size"] = "S" }, price, stock, true, true, true, 300)],
        [new SnapshotImage(Guid.Parse("33333333-3333-3333-3333-333333333333"), null, true, 0, "a.png", "alt")]);

    [Fact]
    public void Stock_does_not_change_the_content_fingerprint_but_everything_else_does()
    {
        var baseHash = ChannelSyncService.ContentHash(Snap());
        Assert.Equal(baseHash, ChannelSyncService.ContentHash(Snap(stock: 999)));
        Assert.NotEqual(baseHash, ChannelSyncService.ContentHash(Snap(price: 11)));
        Assert.NotEqual(baseHash, ChannelSyncService.ContentHash(Snap(desc: "other")));
    }

    [Fact]
    public void Photos_have_their_own_fingerprint()
    {
        var a = Snap();
        var b = a with { Images = [a.Images[0] with { AltText = "different" }] };
        Assert.NotEqual(ChannelSyncService.ImagesKey(a), ChannelSyncService.ImagesKey(b));
        Assert.Equal(ChannelSyncService.ImagesKey(a), ChannelSyncService.ImagesKey(Snap(price: 99)));
    }

    [Theory]
    [InlineData("Plain\ntext", "Plain<br>text")]
    [InlineData("A & B", "A &amp; B")]
    public void Plain_text_descriptions_are_encoded_and_keep_their_line_breaks(string input, string expected)
        => Assert.Equal(expected, ChannelSyncService.ToHtml(input));

    [Fact]
    public void A_description_that_is_already_html_is_passed_through()
        => Assert.Equal("<p>Hello</p>", ChannelSyncService.ToHtml("<p>Hello</p>"));

    [Fact]
    public void A_blank_description_is_nothing()
    {
        Assert.Null(ChannelSyncService.ToHtml("  "));
        Assert.Null(ChannelSyncService.ToHtml(null));
    }

    [Fact]
    public void A_healthy_store_is_always_due_and_a_failing_one_waits_longer_each_time()
    {
        var ch = new SalesChannel("shopify", "S", "a.myshopify.com", "x");
        Assert.True(ChannelSyncWorker.DueNow(ch));

        ch.RecordFailure("down");                       // 1 failure: waits 2 minutes from now
        Assert.False(ChannelSyncWorker.DueNow(ch));

        for (var i = 0; i < 10; i++) ch.RecordFailure("down");
        Assert.False(ChannelSyncWorker.DueNow(ch));     // capped at an hour, but still waiting
        ch.RecordSuccess(DateTime.UtcNow);
        Assert.True(ChannelSyncWorker.DueNow(ch));      // one success and it is back to normal
    }

    [Fact]
    public void An_order_the_store_already_counted_moves_the_remembered_level_with_it()
    {
        var v = new ChannelListingVariant(Guid.NewGuid(), Guid.NewGuid(), "1", "2", "S");
        v.ShiftPushed(-3);
        Assert.Null(v.LastPushedQuantity);              // nothing pushed yet: nothing to shift
        v.RecordPushed(10);
        v.ShiftPushed(-3);
        Assert.Equal(7, v.LastPushedQuantity);
        v.ForgetPushed();
        Assert.Null(v.LastPushedQuantity);
    }

    [Fact]
    public void Refused_content_is_remembered_so_it_is_not_retried_but_fresh_content_clears_it()
    {
        var l = new ChannelListing(Guid.NewGuid(), Guid.NewGuid(), "T");
        l.MarkFailed("no", "h1");
        Assert.Equal("h1", l.FailedHash);
        Assert.Equal(ListingStatuses.Error, l.Status);
        l.MarkSynced("9", "h", ListingStatuses.Live, "h2", "i", "T");
        Assert.Null(l.FailedHash);
        Assert.Equal(ListingStatuses.Live, l.Status);
    }

    [Fact]
    public void A_channel_that_fails_is_marked_and_a_paused_one_stays_paused()
    {
        var ch = new SalesChannel("shopify", "S", "a.myshopify.com", "x");
        ch.RecordFailure("boom");
        Assert.Equal(ChannelStatuses.Error, ch.Status);
        Assert.Equal(1, ch.ConsecutiveFailures);
        ch.Pause();
        ch.RecordFailure("again");
        Assert.Equal(ChannelStatuses.Paused, ch.Status);
        ch.Resume();
        Assert.Equal(0, ch.ConsecutiveFailures);
        Assert.Null(ch.LastError);
    }

    [Fact]
    public void The_orders_cursor_only_moves_forward()
    {
        var ch = new SalesChannel("shopify", "S", "a.myshopify.com", "x");
        var t = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        ch.AdvanceOrdersCursor(t);
        ch.AdvanceOrdersCursor(t.AddDays(-1));
        Assert.Equal(t, ch.OrdersCursor);
        ch.AdvanceOrdersCursor(t.AddDays(1));
        Assert.Equal(t.AddDays(1), ch.OrdersCursor);
    }
}

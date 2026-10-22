using System.Text.Json.Nodes;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Services;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Tests;

/// <summary>
/// Meta matches events to people by comparing hashes. One character of difference in how we normalise a
/// value and the event matches nobody — with no error to say so — so these pin the rules down. The expected
/// hashes were produced with an independent tool (sha256sum), not with the code under test.
/// </summary>
public class MetaHashingTests
{
    [Fact]
    public void Email_is_trimmed_and_lowercased_before_hashing() =>
        Assert.Equal("973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b",
            MetaHashing.Email("  Test@Example.COM "));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Unusable_email_is_omitted_not_hashed(string? email) => Assert.Null(MetaHashing.Email(email));

    [Theory]
    [InlineData("+971 50 123 4567")]
    [InlineData("00971501234567")]
    [InlineData("+971-50-123-4567")]
    public void International_phone_formats_all_hash_to_digits_with_country_code(string phone) =>
        Assert.Equal("b7a8f5085aa733eb29857a02945bc84a5227e693708d469ec9fb21d34e9e44f5", MetaHashing.Phone(phone, null));

    [Fact]
    public void Local_number_is_completed_with_the_calling_code_and_loses_its_trunk_zero() =>
        Assert.Equal("b7a8f5085aa733eb29857a02945bc84a5227e693708d469ec9fb21d34e9e44f5",
            MetaHashing.Phone("050 123 4567", "971"));

    [Fact]
    public void National_number_written_without_the_zero_is_completed_too() =>
        Assert.Equal("b7a8f5085aa733eb29857a02945bc84a5227e693708d469ec9fb21d34e9e44f5",
            MetaHashing.Phone("501234567", "971"));

    [Fact]
    public void Local_number_with_no_calling_code_to_add_is_omitted_rather_than_hashed_wrongly() =>
        Assert.Null(MetaHashing.Phone("0501234567", null));

    [Theory]
    [InlineData("12345")]
    [InlineData("abc")]
    [InlineData("")]
    public void Too_short_or_empty_phone_is_omitted(string phone) => Assert.Null(MetaHashing.Phone(phone, "971"));

    [Fact]
    public void Name_is_lowercased_and_stripped_of_punctuation() =>
        Assert.Equal("9af2921d3fd57fe886c9022d1fcc055d53a79e4032fa6137e397583884e1a5de", MetaHashing.Name(" Ahmed. "));

    [Fact]
    public void City_drops_spaces_and_case() =>
        Assert.Equal("22ff277b10da3a6fbabf7b4a7385855f24fe3bb04a4688bbf35d092a0740344c", MetaHashing.City("  DUBAI "));
}

public class MetaConversionBuilderTests
{
    private static Lead NewLead(string email = "test@example.com", string phone = "+971501234567") =>
        new("Ahmed", "Khan", "", "Acme", "", email, phone, "AE", "Dubai", "meta", "medium", 0m, "", null);

    private static MetaConversionSettings Settings(bool sendValue = true)
    {
        var s = new MetaConversionSettings(Guid.NewGuid());
        s.Configure(enabled: true, datasetId: "468275456140994", sendValue, defaultCallingCode: null, leadEvents: null, dealEvents: null);
        return s;
    }

    private static Deal NewDeal(decimal value) =>
        new("Acme — Ahmed", "Acme", value, "qualified", "medium", 20, "2026-12-01", "", "meta", "", "", forecastCategory: null);

    [Fact]
    public void User_data_carries_the_meta_lead_id_as_a_number_and_only_hashed_contact_details()
    {
        var json = MetaConversionBuilder.BuildUserData(NewLead(), "1234567890123456", null);
        var u = JsonNode.Parse(json)!.AsObject();

        Assert.Equal(1234567890123456L, (long)u["lead_id"]!);
        Assert.Equal("973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b", (string)u["em"]![0]!);
        Assert.DoesNotContain("test@example.com", json);   // the readable address must never be stored
        Assert.DoesNotContain("501234567", json);
    }

    [Fact]
    public void A_lead_with_no_usable_contact_details_still_reports_by_lead_id()
    {
        var json = MetaConversionBuilder.BuildUserData(NewLead(email: "", phone: ""), "1234567890123456", null);
        var u = JsonNode.Parse(json)!.AsObject();
        Assert.Null(u["em"]);
        Assert.Null(u["ph"]);
        Assert.NotNull(u["lead_id"]);
    }

    [Fact]
    public void Default_mapping_reports_each_funnel_stage_and_skips_the_opportunity_birth_stage()
    {
        var s = Settings();
        Assert.Equal("Lead", s.LeadEventFor("new"));
        Assert.Equal("Qualified", s.LeadEventFor("qualified"));
        Assert.Equal("Opportunity", s.LeadEventFor("converted"));
        Assert.Equal("Won", s.DealEventFor("won"));
        // "qualified" is where a deal STARTS; the lead's own "Opportunity" event already says so.
        Assert.Null(s.DealEventFor("qualified"));
    }

    [Fact]
    public void A_blank_event_name_means_nothing_is_sent_for_that_stage()
    {
        var s = new MetaConversionSettings(Guid.NewGuid());
        s.Configure(true, "468275456140994", true, null,
            new Dictionary<string, string> { ["new"] = "Lead", ["contacted"] = "" }, null);
        Assert.Equal("Lead", s.LeadEventFor("new"));
        Assert.Null(s.LeadEventFor("contacted"));
    }

    [Fact]
    public void Won_deal_reports_what_it_closed_at_and_other_stages_the_quoted_value()
    {
        var deal = NewDeal(100_000m);
        deal.MoveStage("won", 100);
        deal.SetClosedValue(80_000m);

        Assert.Equal(80_000m, MetaConversionBuilder.DealValue(deal, "won", true).Value);
        Assert.Equal(100_000m, MetaConversionBuilder.DealValue(deal, "proposal", true).Value);
    }

    [Fact]
    public void Value_is_left_out_when_switched_off_or_zero()
    {
        var deal = NewDeal(50_000m);
        Assert.Null(MetaConversionBuilder.DealValue(deal, "won", sendValue: false).Value);
        // A zero would tell Meta the sale was worth nothing, which is not what "unknown" means.
        Assert.Null(MetaConversionBuilder.DealValue(NewDeal(0m), "won", true).Value);
    }

    [Fact]
    public void Wire_event_has_the_fields_meta_requires_for_a_crm_lead_event()
    {
        var s = Settings();
        var src = new MetaLeadRef(s.IntegrationId, "1234567890123456");
        var ev = MetaConversionBuilder.ForLead(s, NewLead(), src, "qualified", new DateTime(2026, 10, 22, 8, 0, 0, DateTimeKind.Utc))!;
        var json = MetaConversionPayload.ToEvent(ev);

        Assert.Equal("Qualified", (string)json["event_name"]!);
        Assert.Equal("system_generated", (string)json["action_source"]!);
        Assert.Equal("crm", (string)json["custom_data"]!["event_source"]!);
        Assert.Equal("Vrodux", (string)json["custom_data"]!["lead_event_source"]!);
        Assert.Equal(new DateTimeOffset(2026, 10, 22, 8, 0, 0, TimeSpan.Zero).ToUnixTimeSeconds(), (long)json["event_time"]!);
        Assert.Null(json["custom_data"]!["value"]);   // a lead stage carries no money
    }

    [Fact]
    public void Won_event_carries_value_and_currency_together()
    {
        var s = Settings();
        var lead = NewLead();
        var deal = NewDeal(100_000m);
        deal.MoveStage("won", 100);
        var ev = MetaConversionBuilder.ForDeal(s, lead, new MetaLeadRef(s.IntegrationId, "1234567890123456"), deal, "won", DateTime.UtcNow)!;
        var custom = MetaConversionPayload.ToEvent(ev)["custom_data"]!;

        Assert.Equal(100_000m, (decimal)custom["value"]!);
        Assert.False(string.IsNullOrWhiteSpace((string?)custom["currency"]));
    }
}

public class MetaConversionEventTests
{
    private static MetaConversionEvent NewEvent() =>
        new(Guid.NewGuid(), Guid.NewGuid(), null, "Lead", DateTime.UtcNow, "1234567890123456", "{}", null, null);

    [Fact]
    public void A_transient_failure_backs_off_and_eventually_gives_up()
    {
        var e = NewEvent();
        for (var i = 0; i < MetaConversionEvent.MaxAttempts - 1; i++)
        {
            e.ScheduleRetry("Meta busy");
            Assert.Equal(MetaConversionStatus.Pending, e.Status);
            Assert.NotNull(e.NextAttemptAt);
        }
        e.ScheduleRetry("Meta busy");
        Assert.Equal(MetaConversionStatus.Failed, e.Status);
        Assert.Null(e.NextAttemptAt);
    }

    [Fact]
    public void A_permanent_failure_stops_at_once_and_can_be_requeued_after_the_fix()
    {
        var e = NewEvent();
        e.MarkFailed("token expired");
        Assert.Equal(MetaConversionStatus.Failed, e.Status);

        e.Requeue();
        Assert.Equal(MetaConversionStatus.Pending, e.Status);
        Assert.Equal(0, e.Attempts);
        Assert.Null(e.LastError);
    }

    [Fact]
    public void Changing_dataset_clears_the_previous_verification_and_error()
    {
        var s = new MetaConversionSettings(Guid.NewGuid());
        s.Configure(true, "111111", true, null, null, null);
        s.RecordVerified("Old dataset");
        s.RecordFailure("boom");

        s.Configure(true, "222222", true, null, null, null);

        Assert.Null(s.DatasetName);
        Assert.Null(s.LastError);
        Assert.Null(s.LastVerifiedAt);
    }
}

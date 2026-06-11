using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging.Abstractions;
using PortfolioPro.Api.Snapshot;
using Xunit;

namespace PortfolioPro.Api.Tests.Snapshot;

public sealed class EmptySnapshotProviderTests
{
    private static readonly Regex UlidPattern = new(@"^[0-9A-HJKMNP-TV-Z]{26}$");

    [Fact]
    public void Create_Returns_Snapshot_With_Generated_Home_Page_Id()
    {
        var provider = new EmptySnapshotProvider(NullLogger<EmptySnapshotProvider>.Instance);
        var snapshot = provider.Create();

        Assert.Equal(1, (int)snapshot["version"]!);

        var pages = snapshot["pages"]!.AsArray();
        Assert.Single(pages);
        var homeId = pages[0]!["id"]!.GetValue<string>();
        Assert.Matches(UlidPattern, homeId);
        Assert.Equal("home", pages[0]!["slug"]!.GetValue<string>());
    }

    [Fact]
    public void Create_Returns_Fresh_Ids_Per_Call()
    {
        var provider = new EmptySnapshotProvider(NullLogger<EmptySnapshotProvider>.Instance);
        var a = provider.Create();
        var b = provider.Create();

        var aId = a["pages"]!.AsArray()[0]!["id"]!.GetValue<string>();
        var bId = b["pages"]!.AsArray()[0]!["id"]!.GetValue<string>();
        Assert.NotEqual(aId, bId);
    }

    [Fact]
    public void Validator_Loads_Schema_Without_Error()
    {
        var validator = new SnapshotValidator(NullLogger<SnapshotValidator>.Instance);
        Assert.NotNull(validator);
    }
}

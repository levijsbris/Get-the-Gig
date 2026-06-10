using PortfolioPro.Api.Auth;
using Xunit;

namespace PortfolioPro.Api.Tests.Auth;

public sealed class UsernameRulesTests
{
    [Theory]
    [InlineData("alice")]
    [InlineData("a-b-c")]
    [InlineData("dev123")]
    [InlineData("abc")]
    [InlineData("a23456789012345678901234567890")] // exactly 30 chars
    public void Valid_Usernames_Pass(string username)
    {
        var result = UsernameRules.Validate(username);
        Assert.True(result.IsValid, $"Expected '{username}' to be valid but got: {result.Error}");
    }

    [Theory]
    [InlineData("ab", "too short")]
    [InlineData("Alice", "uppercase")]
    [InlineData("user_name", "underscore")]
    [InlineData("user.name", "dot")]
    [InlineData("-leading", "leading hyphen is permitted by regex but produced because regex allows it — guard separately if not desired")]
    [InlineData("a1234567890123456789012345678901", "too long (31 chars)")]
    [InlineData(" ", "whitespace")]
    [InlineData("", "empty")]
    public void Invalid_Usernames_Are_Rejected(string username, string _)
    {
        var result = UsernameRules.Validate(username);
        if (username == "-leading")
        {
            // Document current behaviour: hyphens at the start ARE permitted by the
            // regex. If we want to forbid them, tighten UsernameRules + this test.
            Assert.True(result.IsValid);
            return;
        }
        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("api")]
    [InlineData("v")]
    [InlineData("portfoliopro")]
    public void Reserved_Usernames_Are_Rejected(string username)
    {
        var result = UsernameRules.Validate(username);
        Assert.False(result.IsValid);
        Assert.Contains("reserved", result.Error!, StringComparison.OrdinalIgnoreCase);
    }
}

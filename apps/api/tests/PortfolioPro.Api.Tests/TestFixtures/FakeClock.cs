using PortfolioPro.Api.Infrastructure;

namespace PortfolioPro.Api.Tests.TestFixtures;

public sealed class FakeClock : IClock
{
    // Default to a deterministic instant so tests aren't dependent on the wall clock.
    public DateTimeOffset UtcNow { get; set; } = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    public void Advance(TimeSpan span) => UtcNow = UtcNow.Add(span);
}

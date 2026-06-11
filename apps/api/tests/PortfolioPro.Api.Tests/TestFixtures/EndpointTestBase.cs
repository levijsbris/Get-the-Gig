using Xunit;

namespace PortfolioPro.Api.Tests.TestFixtures;

public abstract class EndpointTestBase : IAsyncLifetime
{
    protected EndpointTestBase(ApiTestFixture fx)
    {
        Fx = fx;
    }

    protected ApiTestFixture Fx { get; }

    public Task InitializeAsync()
    {
        // Reset the fake clock to its default so a previous test that advanced it
        // doesn't leak state into the next one (the fixture is class-scoped via
        // IClassFixture, so the FakeClock instance is shared across tests in this class).
        Fx.Clock.UtcNow = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        return Fx.ResetFirestoreAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}

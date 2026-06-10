using Xunit;

namespace PortfolioPro.Api.Tests.TestFixtures;

public abstract class EndpointTestBase : IAsyncLifetime
{
    protected EndpointTestBase(ApiTestFixture fx)
    {
        Fx = fx;
    }

    protected ApiTestFixture Fx { get; }

    public Task InitializeAsync() => Fx.ResetFirestoreAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}

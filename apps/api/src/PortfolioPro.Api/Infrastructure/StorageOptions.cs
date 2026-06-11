namespace PortfolioPro.Api.Infrastructure;

public sealed class StorageOptions
{
    public required string PrivateBucket { get; init; }
    public required Uri FakeGcsBaseUrl { get; init; }

    public static StorageOptions FromConfiguration(IConfiguration config)
    {
        var bucket = config["STORAGE_PRIVATE_BUCKET"]
            ?? Environment.GetEnvironmentVariable("STORAGE_PRIVATE_BUCKET")
            ?? "portfoliopro-local-private";
        var fakeGcs = config["STORAGE_EMULATOR_HOST"]
            ?? Environment.GetEnvironmentVariable("STORAGE_EMULATOR_HOST")
            ?? "http://localhost:9199";
        if (!fakeGcs.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            fakeGcs = $"http://{fakeGcs}";
        return new StorageOptions
        {
            PrivateBucket = bucket,
            FakeGcsBaseUrl = new Uri(fakeGcs.TrimEnd('/') + "/", UriKind.Absolute),
        };
    }
}

using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;

namespace PortfolioPro.Api.Infrastructure;

public static class FirebaseAppBootstrap
{
    public static void Initialize(IConfiguration config)
    {
        if (FirebaseApp.DefaultInstance is not null)
            return;

        var projectId = config["FIRESTORE_PROJECT_ID"]
            ?? Environment.GetEnvironmentVariable("FIRESTORE_PROJECT_ID")
            ?? config["GOOGLE_CLOUD_PROJECT"]
            ?? "portfoliopro-local";

        // FirebaseAuth honours FIREBASE_AUTH_EMULATOR_HOST automatically. In the emulator
        // case there are no real credentials; supply a sentinel so the SDK does not look
        // for application-default credentials on disk.
        var hasAuthEmulator = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("FIREBASE_AUTH_EMULATOR_HOST"));

        var options = new AppOptions
        {
            ProjectId = projectId,
            Credential = hasAuthEmulator ? GoogleCredential.FromAccessToken("emulator") : GoogleCredential.GetApplicationDefault(),
        };

        FirebaseApp.Create(options);
    }
}

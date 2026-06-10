using Google.Cloud.Firestore;

namespace PortfolioPro.Api.Infrastructure;

public static class FirestoreFactory
{
    public static FirestoreDb Create(IConfiguration config)
    {
        var projectId = config["FIRESTORE_PROJECT_ID"]
            ?? Environment.GetEnvironmentVariable("FIRESTORE_PROJECT_ID")
            ?? config["GOOGLE_CLOUD_PROJECT"]
            ?? "portfoliopro-local";

        // FirestoreDb honours FIRESTORE_EMULATOR_HOST automatically; no special handling needed here.
        return FirestoreDb.Create(projectId);
    }
}

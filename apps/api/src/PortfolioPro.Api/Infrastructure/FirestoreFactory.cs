using Google.Cloud.Firestore;
using Google.Api.Gax;

namespace PortfolioPro.Api.Infrastructure;

public static class FirestoreFactory
{
    public static FirestoreDb Create(IConfiguration config)
    {
        var projectId = config["FIRESTORE_PROJECT_ID"]
            ?? Environment.GetEnvironmentVariable("FIRESTORE_PROJECT_ID")
            ?? config["GOOGLE_CLOUD_PROJECT"]
            ?? "portfoliopro-local";

        // EmulatorOrProduction: if FIRESTORE_EMULATOR_HOST is set, talk to the
        // emulator over an insecure channel; otherwise resolve ADC and use the real
        // Firestore service. FirestoreDb.Create(projectId) ignores the env var.
        return new FirestoreDbBuilder
        {
            ProjectId = projectId,
            EmulatorDetection = EmulatorDetection.EmulatorOrProduction,
        }.Build();
    }
}

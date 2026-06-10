using Xunit;

// Disable cross-class parallelism: every test class hits the shared Firestore emulator
// at the same project ID and resets state in IAsyncLifetime.InitializeAsync. Running
// classes in parallel would race those resets.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

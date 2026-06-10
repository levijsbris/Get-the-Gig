---
name: add-endpoint
description: Use whenever adding, modifying, or reviewing a backend HTTP endpoint in the ASP.NET Core API. Endpoints in this project follow a strict pattern for authentication, tenant scoping, validation, error handling, and logging — getting any of these wrong creates security holes (cross-tenant data access, unvalidated input) or operational pain (unstructured errors, missing logs). Trigger this skill whenever the user mentions adding a route, API method, or endpoint, or when changing how an existing endpoint handles auth, validation, or errors. Also use when reviewing a PR that adds endpoints to verify the patterns are followed.
---

# Adding a Backend Endpoint

Every endpoint in `apps/api` follows the same shape. This skill captures it so endpoints are consistent, secure, and observable without re-deriving the pattern each time.

> **Phase availability.** This skill describes the *target* shape of the backend. Several files it names — `RequireUser` filter, `UserContext`, `SignedUrlService`, `PasswordUnlockService`, `AttemptRateLimiter`, `SnapshotValidator`, `AssetReferenceWalker`, `TenancyTests`, the test JWT-signing fixture — land across Phases 1–9 (see `docs/build-plan.md`). If you're working on a phase that hasn't introduced one of these yet, create it in the path shown here so later phases find it where this skill says it should be. Don't grep for them in Phase 0; only `apps/api/src/PortfolioPro.Api/Endpoints/HealthEndpoints.cs` exists.

## Anatomy of an endpoint

An endpoint has six parts:

1. **DTO** — request and response shapes. Records, immutable, in `Endpoints/{Resource}/Dto/`.
2. **Validator** — FluentValidation validator for the request DTO.
3. **Handler** — the method that processes the request. Has a single responsibility, takes services via DI.
4. **Registration** — `MapXxx` method in `Endpoints/{Resource}/{Resource}Endpoints.cs` that wires route, auth filter, validation, and the handler.
5. **Authorisation** — every endpoint that touches user data uses the `.RequireUser()` extension which validates the Firebase ID token and returns a `UserContext`.
6. **Tests** — integration test against the Firestore emulator + a stub auth.

## File layout

```
apps/api/src/PortfolioPro.Api/
└── Endpoints/
    └── Portfolios/
        ├── PortfolioEndpoints.cs           # registration + handlers
        ├── Dto/
        │   ├── CreatePortfolioRequest.cs
        │   ├── CreatePortfolioResponse.cs
        │   └── ...
        └── Validators/
            ├── CreatePortfolioValidator.cs
            └── ...
```

One static class per resource, named `{Resource}Endpoints`. One DTO file per request/response shape.

## Standard endpoint shape

```csharp
public static class PortfolioEndpoints
{
    public static IEndpointRouteBuilder MapPortfolioEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/portfolios")
            .RequireUser()                   // sets UserContext on HttpContext.Items
            .WithTags("Portfolios");

        group.MapPost("/", CreatePortfolio)
            .WithName("CreatePortfolio")
            .Produces<CreatePortfolioResponse>(201)
            .ProducesProblem(400)
            .ProducesProblem(409);

        // ... more

        return app;
    }

    private static async Task<IResult> CreatePortfolio(
        CreatePortfolioRequest request,
        UserContext user,                    // injected by RequireUser filter
        IPortfolioService portfolios,
        IValidator<CreatePortfolioRequest> validator,
        ILogger<Program> log,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        try
        {
            var portfolio = await portfolios.CreateAsync(user.Uid, request, ct);
            log.LogInformation("Created portfolio {PortfolioId} for {Uid}",
                portfolio.Id, user.Uid);
            return Results.Created($"/api/portfolios/{portfolio.Id}",
                CreatePortfolioResponse.From(portfolio));
        }
        catch (SlugConflictException)
        {
            return Results.Problem(
                title: "Slug already in use",
                statusCode: 409,
                type: "https://portfoliopro.com/errors/slug-conflict");
        }
    }
}
```

## The seven rules

### 1. Always derive UID from the token. Never from the body or URL.

The `RequireUser` filter validates the Firebase ID token (`Authorization: Bearer <token>`) and injects a `UserContext`. The endpoint takes `UserContext` as a parameter — that's the only authoritative source of UID.

If a request body contains a `uid` field, that's an injection attempt. Ignore it. Better: don't define such fields in DTOs in the first place.

### 2. Validate input with FluentValidation. Always.

Even for endpoints with "obvious" inputs. The validator is the single source of truth for input shape. Run it via `IValidator<T>` injected into the handler — don't use the auto-validation MVC filter, which doesn't compose well with minimal APIs.

If validation fails, return `Results.ValidationProblem(...)` which produces RFC 7807 output. The frontend's React Hook Form / Zod validator should match this output shape so users see the same errors.

### 3. Scope every data access to UID.

Every Firestore query starts with the user's UID:

```csharp
db.Collection("users").Document(user.Uid).Collection("portfolios").Document(portfolioId);
```

NOT:

```csharp
db.CollectionGroup("portfolios").WhereEqualTo("id", portfolioId);  // BAD: cross-tenant leak risk
```

For collection group queries that might be necessary later (analytics, admin), they MUST include `where("uid", "==", user.Uid)`. There's a test in `apps/api/tests/PortfolioPro.Api.Tests/TenancyTests.cs` that asserts no endpoint can return another user's data — extend it when adding endpoints.

### 4. Storage paths begin with `users/{uid}/`.

When generating a signed upload URL or writing an object directly, the key must start with `users/{user.Uid}/`. The signed URL service refuses other prefixes (see `Services/SignedUrlService.cs`).

### 5. Errors are RFC 7807 ProblemDetails.

Throw `ProblemDetailsException` for expected error cases, or return `Results.Problem(...)` directly. A global exception filter catches unhandled exceptions and produces a 500 with a correlation ID; the underlying exception is logged but never returned to the client.

Use these `type` URIs for common cases:

- `https://portfoliopro.com/errors/validation` (auto-set by `ValidationProblem`)
- `https://portfoliopro.com/errors/slug-conflict`
- `https://portfoliopro.com/errors/username-conflict`
- `https://portfoliopro.com/errors/quota-exceeded`
- `https://portfoliopro.com/errors/rate-limited`

### 6. Log structured. No PII. No secrets.

Use `ILogger<T>` with structured fields:

```csharp
log.LogInformation("Published portfolio {PortfolioId} for {Uid} as {Visibility}",
    portfolio.Id, user.Uid, request.Visibility);
```

Do NOT log: passwords (plaintext or hash), full ID tokens, signed URLs (they contain credentials), asset contents, email bodies. UIDs are OK (Firebase UIDs are random opaque IDs). Usernames are OK (they're public). Emails are NOT OK in logs (PII).

### 7. Use cancellation tokens.

Every handler takes `CancellationToken ct` and passes it through to async calls (Firestore, Storage, HTTP). The pipeline propagates cancellation when the client disconnects, saving billable work.

## Authorization patterns beyond owner-only

Most endpoints are owner-only — only the resource's owner can touch it. A few need different rules:

- **Public viewer routes** (`/api/v/...`) — no auth required, but rate-limited and scoped to a specific username/slug. Use `.AllowAnonymous()` and validate the route exists.
- **Password unlock** (`/api/v/{username}/{slug}/unlock`) — anonymous, rate-limited per (route, ipBucket). See `Services/PasswordUnlockService.cs`.

Add a comment above any non-owner-only endpoint explaining the authorisation model:

```csharp
// PUBLIC ENDPOINT — anonymous, rate-limited per (route, ipBucket).
// Returns a signed URL on successful password verification.
group.MapPost("/{username}/{slug}/unlock", UnlockPortfolio)
    .AllowAnonymous();
```

## Quota and rate-limit endpoints

If the endpoint consumes a quota (storage bytes, password attempts), check the quota inside the same transaction or atomic operation that increments it. Firestore transactions are the standard tool. For password attempts, see `Services/AttemptRateLimiter.cs`.

## Tests

Minimum tests for a new endpoint:

1. **Happy path** — valid request, expected response.
2. **Auth missing** — no `Authorization` header → 401.
3. **Auth wrong tenant** — token for user A trying to access user B's resource → 404 (NOT 403, to avoid leaking existence).
4. **Validation** — at least one invalid input shape → 400 with the right `errors` field.
5. **Quota / rate limit** if applicable — exceeded → 429 (rate) or 402-style problem (quota).

Tests use the Firestore emulator via Testcontainers. Auth is stubbed: a test JWT is signed by a locally-generated key the test fixture loads on startup. See `apps/api/tests/PortfolioPro.Api.Tests/TestFixtures/` for the harness.

## Checklist before merging

- [ ] DTOs are records in `Dto/`.
- [ ] FluentValidation validator covers all input fields, including string length and format constraints.
- [ ] Handler takes `UserContext` (or explicitly opts out for public endpoints with a comment).
- [ ] Every Firestore query is UID-scoped.
- [ ] Every Storage path starts with `users/{uid}/`.
- [ ] Errors return RFC 7807 with the right status and a `type` URI.
- [ ] Structured logging, no PII.
- [ ] `CancellationToken` threaded through all async calls.
- [ ] Tests: happy path, auth missing, wrong tenant, validation, quota/rate-limit if applicable.
- [ ] `RequireUser` or explicit `AllowAnonymous` with a comment.

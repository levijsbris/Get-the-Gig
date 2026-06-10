using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Errors;
using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // PUBLIC ENDPOINT — anonymous availability check so the signup form can validate
        // before the user creates a Firebase Auth account. Only reads /usernames/{u},
        // which is public-read per Firestore rules. No rate limit beyond default ASP.NET.
        app.MapGet("/api/auth/username/availability", CheckUsernameAvailability)
            .WithName("UsernameAvailability")
            .WithTags("Auth")
            .Produces<UsernameAvailabilityResponse>(StatusCodes.Status200OK);

        var auth = app.MapGroup("/api/auth")
            .RequireUser()
            .WithTags("Auth");

        auth.MapPost("/signup", Signup)
            .WithName("Signup")
            .Produces<MeResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        auth.MapGet("/me", Me)
            .WithName("Me")
            .Produces<MeResponse>(StatusCodes.Status200OK);

        auth.MapPost("/username", ChangeUsername)
            .WithName("ChangeUsername")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        auth.MapDelete("/account", DeleteAccount)
            .WithName("DeleteAccount")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> CheckUsernameAvailability(
        string username,
        UsernameService usernames,
        CancellationToken ct)
    {
        var validation = UsernameRules.Validate(username);
        if (!validation.IsValid)
            return Results.Ok(new UsernameAvailabilityResponse(Available: false, Reason: validation.Error));

        var available = await usernames.IsAvailableAsync(username, ct);
        return Results.Ok(new UsernameAvailabilityResponse(
            Available: available,
            Reason: available ? null : "Username is already taken."));
    }

    private static async Task<IResult> Signup(
        SignupRequest request,
        UserContext user,
        UsernameService usernames,
        UserService users,
        IValidator<SignupRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        await usernames.ClaimForNewUserAsync(user.Uid, user.Email, request.Username, ct);

        var record = await users.GetByUidAsync(user.Uid, ct);
        return Results.Created("/api/auth/me", MeResponse.From(user.Uid, user.Email, record));
    }

    private static async Task<IResult> Me(
        UserContext user,
        UserService users,
        CancellationToken ct)
    {
        var record = await users.GetByUidAsync(user.Uid, ct);
        return Results.Ok(MeResponse.From(user.Uid, user.Email, record));
    }

    private static async Task<IResult> ChangeUsername(
        ChangeUsernameRequest request,
        UserContext user,
        UsernameService usernames,
        IValidator<ChangeUsernameRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        if (user.Username is null)
            throw new UserNotFoundException();

        await usernames.ChangeAsync(user.Uid, user.Username, request.NewUsername, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAccount(
        UserContext user,
        UserService users,
        CancellationToken ct)
    {
        await users.SoftDeleteAsync(user.Uid, ct);
        return Results.NoContent();
    }
}

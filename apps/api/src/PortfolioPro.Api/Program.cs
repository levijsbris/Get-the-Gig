using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints;
using PortfolioPro.Api.Endpoints.Auth;
using PortfolioPro.Api.Errors;
using PortfolioPro.Api.Infrastructure;
using PortfolioPro.Api.Services;
using PortfolioPro.Api.Snapshot;

var builder = WebApplication.CreateBuilder(args);

const string EditorCorsPolicy = "EditorDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(EditorCorsPolicy, policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

if (!builder.Environment.IsEnvironment("Testing"))
{
    FirebaseAppBootstrap.Initialize(builder.Configuration);
}
builder.Services.AddSingleton(FirestoreFactory.Create(builder.Configuration));
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IIdTokenValidator, FirebaseIdTokenValidator>();
builder.Services.AddScoped<RequireUserFilter>();

builder.Services.AddScoped<UsernameService>();
builder.Services.AddScoped<UserService>();

builder.Services.AddSingleton<ISnapshotValidator, SnapshotValidator>();
builder.Services.AddSingleton<IEmptySnapshotProvider, EmptySnapshotProvider>();

builder.Services.AddValidatorsFromAssemblyContaining<Program>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(EditorCorsPolicy);

app.MapHealthEndpoints();
app.MapAuthEndpoints();

app.Run();

public partial class Program;

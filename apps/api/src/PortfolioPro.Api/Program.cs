using PortfolioPro.Api.Endpoints;

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

var app = builder.Build();

app.UseCors(EditorCorsPolicy);

app.MapHealthEndpoints();

app.Run();

public partial class Program;

using FluentValidation;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Validators;

public sealed class RequestUploadUrlRequestValidator : AbstractValidator<RequestUploadUrlRequest>
{
    public RequestUploadUrlRequestValidator()
    {
        RuleFor(x => x.Filename)
            .Must(AssetMetadataRules.FilenameIsSafe)
            .WithMessage("Filename must be 1-200 characters and contain no path separators.");

        RuleFor(x => x.ContentType)
            .Must(AssetMetadataRules.ContentTypeAllowed)
            .WithMessage("Content type must be image/jpeg, image/png, image/webp, image/gif, or application/pdf.");

        RuleFor(x => x)
            .Must(r => AssetMetadataRules.ByteSizeWithinPerFileCap(r.ByteSize, r.ContentType))
            .WithMessage("File exceeds the per-file size cap (10MB for images, 25MB for PDFs).")
            .When(r => AssetMetadataRules.ContentTypeAllowed(r.ContentType));

        RuleFor(x => x.Width).GreaterThan(0).When(x => x.Width.HasValue);
        RuleFor(x => x.Height).GreaterThan(0).When(x => x.Height.HasValue);
    }
}

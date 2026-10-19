using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using SmartParking.Infrastructure.Data;

namespace SmartParking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class RecognitionsController : ControllerBase
{
    private readonly DbConnectionFactory _connections;

    public RecognitionsController(DbConnectionFactory connections)
    {
        _connections = connections;
    }

    [HttpGet]
    public async Task<IActionResult> GetHistory([FromQuery] int take = 50)
    {
        var limit = Math.Clamp(take, 1, 200);
        const string sql = """
            SELECT TOP (@Limit)
                RecognitionId,
                PlateText,
                TODATETIMEOFFSET(RecognizedAt, '+00:00') AS RecognizedAt,
                SourceType,
                DetectionConfidence,
                OcrConfidence
            FROM dbo.RecognitionHistory
            ORDER BY RecognizedAt DESC, RecognitionId DESC;
            """;

        using var connection = _connections.CreateConnection();
        var rows = await connection.QueryAsync<RecognitionRecord>(sql, new { Limit = limit });
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRecognitionRequest request)
    {
        var plate = Regex.Replace(request.PlateText ?? string.Empty, "[^A-Za-z0-9]", "")
            .ToUpperInvariant();

        if (plate.Length is < 4 or > 20)
        {
            return BadRequest(new { message = "Biển số không hợp lệ hoặc không có nội dung." });
        }

        var source = (request.SourceType ?? string.Empty).Trim();
        if (!source.Equals("Camera", StringComparison.OrdinalIgnoreCase) &&
            !source.Equals("Upload", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "SourceType chỉ chấp nhận Camera hoặc Upload." });
        }

        if (!IsValidConfidence(request.DetectionConfidence) ||
            !IsValidConfidence(request.OcrConfidence))
        {
            return BadRequest(new { message = "Độ tin cậy phải nằm trong khoảng từ 0 đến 1." });
        }

        const string sql = """
            INSERT INTO dbo.RecognitionHistory
                (PlateText, RecognizedAt, SourceType, DetectionConfidence, OcrConfidence)
            OUTPUT
                INSERTED.RecognitionId,
                INSERTED.PlateText,
                TODATETIMEOFFSET(INSERTED.RecognizedAt, '+00:00') AS RecognizedAt,
                INSERTED.SourceType,
                INSERTED.DetectionConfidence,
                INSERTED.OcrConfidence
            VALUES
                (@PlateText, SYSUTCDATETIME(), @SourceType, @DetectionConfidence, @OcrConfidence);
            """;

        using var connection = _connections.CreateConnection();
        var record = await connection.QuerySingleAsync<RecognitionRecord>(sql, new
        {
            PlateText = plate,
            SourceType = source.Equals("Camera", StringComparison.OrdinalIgnoreCase) ? "Camera" : "Upload",
            DetectionConfidence = request.DetectionConfidence,
            OcrConfidence = request.OcrConfidence
        });

        return Ok(record);
    }

    private static bool IsValidConfidence(double? value) =>
        value is null || (double.IsFinite(value.Value) && value.Value is >= 0 and <= 1);
}

public sealed class CreateRecognitionRequest
{
    public string? PlateText { get; set; }
    public string? SourceType { get; set; }
    public double? DetectionConfidence { get; set; }
    public double? OcrConfidence { get; set; }
}

public sealed class RecognitionRecord
{
    public long RecognitionId { get; set; }
    public string PlateText { get; set; } = string.Empty;
    public DateTimeOffset RecognizedAt { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public double? DetectionConfidence { get; set; }
    public double? OcrConfidence { get; set; }
}

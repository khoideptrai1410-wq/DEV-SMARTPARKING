/*
  PlateSight - lịch sử nhận diện biển số
  Chạy file này bằng SQL Server Management Studio (SSMS).
  Bảng Tickets hiện tại không bị xóa hoặc thay đổi.
*/
IF DB_ID(N'SmartParking') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE [SmartParking]');
END;
GO

USE [SmartParking];
GO

IF OBJECT_ID(N'dbo.RecognitionHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RecognitionHistory
    (
        RecognitionId BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_RecognitionHistory PRIMARY KEY,
        PlateText NVARCHAR(20) NOT NULL,
        RecognizedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_RecognitionHistory_RecognizedAt DEFAULT SYSUTCDATETIME(),
        SourceType NVARCHAR(20) NOT NULL,
        DetectionConfidence FLOAT NULL,
        OcrConfidence FLOAT NULL,
        CONSTRAINT CK_RecognitionHistory_SourceType
            CHECK (SourceType IN (N'Camera', N'Upload')),
        CONSTRAINT CK_RecognitionHistory_DetectionConfidence
            CHECK (DetectionConfidence IS NULL OR DetectionConfidence BETWEEN 0 AND 1),
        CONSTRAINT CK_RecognitionHistory_OcrConfidence
            CHECK (OcrConfidence IS NULL OR OcrConfidence BETWEEN 0 AND 1)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.RecognitionHistory')
      AND name = N'IX_RecognitionHistory_RecognizedAt'
)
BEGIN
    CREATE INDEX IX_RecognitionHistory_RecognizedAt
        ON dbo.RecognitionHistory (RecognizedAt DESC, RecognitionId DESC);
END;
GO

SELECT TOP (20)
    RecognitionId, PlateText, RecognizedAt, SourceType,
    DetectionConfidence, OcrConfidence
FROM dbo.RecognitionHistory
ORDER BY RecognizedAt DESC, RecognitionId DESC;
GO

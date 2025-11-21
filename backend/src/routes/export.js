const express = require('express');
const router = express.Router();
const path = require('path');
const excelExportService = require('../services/excelExport');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/export/excel
 * Generate Excel file from data
 */
router.post('/excel', async (req, res, next) => {
  let exportedFile = null;

  try {
    const {
      worksheetName,
      workbookName,
      data,
      metadata,
      formatting,
      customHeaders,
      pivotConfig
    } = req.body;

    if (!worksheetName || !workbookName || !data) {
      throw new AppError('worksheetName, workbookName, and data are required', 400);
    }

    logger.info('Generating Excel export', {
      worksheetName,
      workbookName,
      rowCount: data.rows?.length || 0
    });

    const config = {
      worksheetName,
      workbookName,
      data,
      metadata,
      formatting,
      customHeaders,
      pivotConfig
    };

    const result = await excelExportService.generateExcel(config);
    exportedFile = result.filePath;

    // Send file
    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        logger.error('Error sending file', { error: err.message });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to send file',
            message: err.message
          });
        }
      }

      // Cleanup after download
      setTimeout(async () => {
        if (exportedFile) {
          await excelExportService.cleanup(exportedFile);
        }
      }, 5000);
    });
  } catch (error) {
    // Cleanup on error
    if (exportedFile) {
      await excelExportService.cleanup(exportedFile);
    }
    next(error);
  }
});

/**
 * POST /api/export/excel-info
 * Generate Excel and return file info (don't auto-download)
 */
router.post('/excel-info', async (req, res, next) => {
  try {
    const {
      worksheetName,
      workbookName,
      data,
      metadata,
      formatting,
      customHeaders,
      pivotConfig
    } = req.body;

    if (!worksheetName || !workbookName || !data) {
      throw new AppError('worksheetName, workbookName, and data are required', 400);
    }

    logger.info('Generating Excel export (info only)', {
      worksheetName,
      workbookName,
      rowCount: data.rows?.length || 0
    });

    const config = {
      worksheetName,
      workbookName,
      data,
      metadata,
      formatting,
      customHeaders,
      pivotConfig
    };

    const result = await excelExportService.generateExcel(config);

    res.json({
      success: true,
      data: result,
      downloadUrl: `/api/export/download/${path.basename(result.filePath)}`
    });

    // Schedule cleanup
    setTimeout(async () => {
      await excelExportService.cleanup(result.filePath);
    }, 300000); // 5 minutes
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/export/download/:fileName
 * Download a previously generated file
 */
router.get('/download/:fileName', async (req, res, next) => {
  try {
    const { fileName } = req.params;

    const filePath = path.join(
      excelExportService.tempPath,
      fileName
    );

    logger.info('Downloading file', { fileName });

    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error('Error downloading file', { error: err.message });
        if (!res.headersSent) {
          res.status(404).json({
            success: false,
            error: 'File not found',
            message: 'The requested file does not exist or has expired'
          });
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/export/preview
 * Generate preview of Excel structure without creating file
 */
router.post('/preview', async (req, res, next) => {
  try {
    const {
      data,
      formatting,
      customHeaders,
      pivotConfig
    } = req.body;

    if (!data) {
      throw new AppError('data is required', 400);
    }

    logger.info('Generating Excel preview');

    // Calculate preview info
    const preview = {
      dataSheet: {
        headerRows: customHeaders?.length || 0,
        dataRows: data.rows?.length || 0,
        totalRows: (customHeaders?.length || 0) + (data.rows?.length || 0) + 1,
        columns: data.columns?.length || Object.keys(data.rows[0] || {}).length
      },
      pivotSheet: pivotConfig ? {
        rowFields: pivotConfig.rowFields?.length || 0,
        columnFields: pivotConfig.columnFields?.length || 0,
        valueFields: pivotConfig.valueFields?.length || 0,
        hasPivot: true
      } : null,
      summarySheet: {
        exists: true
      },
      estimatedSize: estimateFileSize(data.rows?.length || 0, data.columns?.length || 0),
      warnings: []
    };

    // Add warnings
    if (data.rows?.length > 100000) {
      preview.warnings.push('Large dataset may take longer to generate');
    }
    if (data.rows?.length > 1000000) {
      preview.warnings.push('Dataset exceeds recommended Excel row limit');
    }

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to estimate file size
 */
function estimateFileSize(rows, columns) {
  // Rough estimation: ~100 bytes per cell
  const estimatedBytes = rows * columns * 100;

  if (estimatedBytes < 1024) {
    return `${estimatedBytes} B`;
  } else if (estimatedBytes < 1024 * 1024) {
    return `${(estimatedBytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

module.exports = router;

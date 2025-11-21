const express = require('express');
const router = express.Router();
const workbookDownloadService = require('../services/workbookDownload');
const xmlParserService = require('../services/xmlParser');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/workbooks/:workbookId
 * Get workbook details
 */
router.get('/:workbookId', async (req, res, next) => {
  try {
    const { workbookId } = req.params;

    logger.info('Getting workbook details', { workbookId });

    const details = await workbookDownloadService.getWorkbookDetails(workbookId);

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/workbooks/:workbookId/views
 * List all views in a workbook
 */
router.get('/:workbookId/views', async (req, res, next) => {
  try {
    const { workbookId } = req.params;

    logger.info('Listing workbook views', { workbookId });

    const views = await workbookDownloadService.listWorkbookViews(workbookId);

    res.json({
      success: true,
      data: views,
      count: views.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/workbooks/:workbookId/download
 * Download and parse workbook
 */
router.post('/:workbookId/download', async (req, res, next) => {
  let downloadedFile = null;

  try {
    const { workbookId } = req.params;
    const { includeExtract = false } = req.body;

    logger.info('Downloading workbook', { workbookId, includeExtract });

    // Download workbook
    const downloadResult = await workbookDownloadService.downloadWorkbook(
      workbookId,
      includeExtract
    );

    downloadedFile = downloadResult.filePath;

    res.json({
      success: true,
      data: downloadResult
    });
  } catch (error) {
    // Cleanup on error
    if (downloadedFile) {
      await workbookDownloadService.cleanup(downloadedFile);
    }
    next(error);
  }
});

/**
 * POST /api/workbooks/:workbookId/parse
 * Download, parse workbook, and extract metadata
 */
router.post('/:workbookId/parse', async (req, res, next) => {
  let downloadedFile = null;
  let extractPath = null;

  try {
    const { workbookId } = req.params;
    const { includeExtract = false, saveMetadata = true } = req.body;

    logger.info('Downloading and parsing workbook', { workbookId });

    // Download workbook
    const downloadResult = await workbookDownloadService.downloadWorkbook(
      workbookId,
      includeExtract
    );

    downloadedFile = downloadResult.filePath;

    // Extract and parse
    let twbContent;
    if (downloadResult.extension === '.twbx') {
      const extracted = await xmlParserService.extractTwbxFile(downloadedFile);
      twbContent = extracted.twbContent;
      extractPath = extracted.extractPath;
    } else {
      const fs = require('fs').promises;
      twbContent = await fs.readFile(downloadedFile, 'utf8');
    }

    // Parse XML
    const workbook = await xmlParserService.parseTwbXml(twbContent);

    // Extract metadata
    const metadata = await xmlParserService.extractWorksheetMetadata(workbook);

    // Save metadata to JSON if requested
    if (saveMetadata) {
      const path = require('path');
      const metadataPath = path.join(
        path.dirname(downloadedFile),
        `${metadata.workbookName}_metadata.json`
      );
      await xmlParserService.saveMetadataToJson(metadata, metadataPath);
      metadata.metadataPath = metadataPath;
    }

    res.json({
      success: true,
      data: metadata
    });

    // Cleanup in background
    setTimeout(async () => {
      if (downloadedFile) {
        await workbookDownloadService.cleanup(downloadedFile);
      }
    }, 60000); // Cleanup after 1 minute

  } catch (error) {
    // Cleanup on error
    if (downloadedFile) {
      await workbookDownloadService.cleanup(downloadedFile);
    }
    next(error);
  }
});

/**
 * POST /api/workbooks/parse-file
 * Parse an uploaded workbook file
 */
router.post('/parse-file', async (req, res, next) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      throw new AppError('File path is required', 400);
    }

    logger.info('Parsing workbook file', { filePath });

    const path = require('path');
    const extension = path.extname(filePath);

    // Extract and parse
    let twbContent;
    if (extension === '.twbx') {
      const extracted = await xmlParserService.extractTwbxFile(filePath);
      twbContent = extracted.twbContent;
    } else {
      const fs = require('fs').promises;
      twbContent = await fs.readFile(filePath, 'utf8');
    }

    // Parse XML
    const workbook = await xmlParserService.parseTwbXml(twbContent);

    // Extract metadata
    const metadata = await xmlParserService.extractWorksheetMetadata(workbook);

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

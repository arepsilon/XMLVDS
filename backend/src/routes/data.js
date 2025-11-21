const express = require('express');
const router = express.Router();
const vizqlService = require('../services/vizqlService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/data/query
 * Execute VizQL query based on metadata
 */
router.post('/query', async (req, res, next) => {
  try {
    const { workbookId, viewName, metadata } = req.body;

    if (!workbookId || !viewName || !metadata) {
      throw new AppError('workbookId, viewName, and metadata are required', 400);
    }

    logger.info('Executing VizQL query', { workbookId, viewName });

    // Build query from metadata
    const query = vizqlService.buildVizQLQuery(metadata);

    // Execute query
    const data = await vizqlService.executeQuery(workbookId, viewName, query);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/data/query-csv
 * Query data using CSV export method
 */
router.post('/query-csv', async (req, res, next) => {
  try {
    const { workbookId, viewName, filters = [] } = req.body;

    if (!workbookId || !viewName) {
      throw new AppError('workbookId and viewName are required', 400);
    }

    logger.info('Querying data via CSV', { workbookId, viewName });

    const data = await vizqlService.queryDataViaCSV(workbookId, viewName, filters);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/data/query-paginated
 * Execute paginated query for large datasets
 */
router.post('/query-paginated', async (req, res, next) => {
  try {
    const { workbookId, viewName, metadata, pageSize = 10000 } = req.body;

    if (!workbookId || !viewName || !metadata) {
      throw new AppError('workbookId, viewName, and metadata are required', 400);
    }

    logger.info('Executing paginated VizQL query', { workbookId, viewName, pageSize });

    // Build query from metadata
    const query = vizqlService.buildVizQLQuery(metadata);

    // Execute with pagination
    const data = await vizqlService.queryWithPagination(workbookId, viewName, query, pageSize);

    res.json({
      success: true,
      data: data,
      pagination: {
        totalRows: data.rows.length,
        pageSize: pageSize
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/data/build-query
 * Build VizQL query from metadata without executing
 */
router.post('/build-query', async (req, res, next) => {
  try {
    const { metadata } = req.body;

    if (!metadata) {
      throw new AppError('metadata is required', 400);
    }

    logger.info('Building VizQL query', { worksheet: metadata.worksheetName });

    const query = vizqlService.buildVizQLQuery(metadata);

    res.json({
      success: true,
      data: query
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

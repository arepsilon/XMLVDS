const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const CONFIG_PATH = path.join(__dirname, '../../config/workbooks.json');

/**
 * GET /api/config/workbooks
 * Get all workbook mappings
 */
router.get('/workbooks', async (req, res, next) => {
  try {
    logger.info('Getting workbook configurations');

    const config = await readConfig();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/config/workbooks/:workbookName
 * Get specific workbook mapping by name
 */
router.get('/workbooks/:workbookName', async (req, res, next) => {
  try {
    const { workbookName } = req.params;

    logger.info('Getting workbook configuration', { workbookName });

    const config = await readConfig();
    const workbook = config.workbooks.find(
      wb => wb.workbookName === workbookName || wb.workbookId === workbookName
    );

    if (!workbook) {
      throw new AppError(`Workbook not found: ${workbookName}`, 404);
    }

    res.json({
      success: true,
      data: workbook
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/config/workbooks
 * Add new workbook mapping
 */
router.post('/workbooks', async (req, res, next) => {
  try {
    const { workbookName, workbookId, datasourceId, serverUrl, siteId, description, enabled } = req.body;

    if (!workbookName) {
      throw new AppError('workbookName is required', 400);
    }

    logger.info('Adding workbook configuration', { workbookName });

    const config = await readConfig();

    // Check if workbook already exists
    const exists = config.workbooks.find(
      wb => wb.workbookName === workbookName || wb.workbookId === workbookId
    );

    if (exists) {
      throw new AppError('Workbook already exists in configuration', 409);
    }

    const newWorkbook = {
      workbookName,
      workbookId: workbookId || '',
      datasourceId: datasourceId || '',
      serverUrl: serverUrl || process.env.TABLEAU_SERVER_URL || '',
      siteId: siteId || process.env.TABLEAU_SITE_ID || '',
      description: description || '',
      enabled: enabled !== false,
      createdAt: new Date().toISOString()
    };

    config.workbooks.push(newWorkbook);
    config.lastUpdated = new Date().toISOString();

    await writeConfig(config);

    res.status(201).json({
      success: true,
      data: newWorkbook,
      message: 'Workbook configuration added successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/config/workbooks/:workbookName
 * Update workbook mapping
 */
router.put('/workbooks/:workbookName', async (req, res, next) => {
  try {
    const { workbookName } = req.params;
    const updates = req.body;

    logger.info('Updating workbook configuration', { workbookName });

    const config = await readConfig();
    const index = config.workbooks.findIndex(
      wb => wb.workbookName === workbookName || wb.workbookId === workbookName
    );

    if (index === -1) {
      throw new AppError(`Workbook not found: ${workbookName}`, 404);
    }

    // Update workbook
    config.workbooks[index] = {
      ...config.workbooks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    config.lastUpdated = new Date().toISOString();

    await writeConfig(config);

    res.json({
      success: true,
      data: config.workbooks[index],
      message: 'Workbook configuration updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/config/workbooks/:workbookName
 * Delete workbook mapping
 */
router.delete('/workbooks/:workbookName', async (req, res, next) => {
  try {
    const { workbookName } = req.params;

    logger.info('Deleting workbook configuration', { workbookName });

    const config = await readConfig();
    const initialLength = config.workbooks.length;

    config.workbooks = config.workbooks.filter(
      wb => wb.workbookName !== workbookName && wb.workbookId !== workbookName
    );

    if (config.workbooks.length === initialLength) {
      throw new AppError(`Workbook not found: ${workbookName}`, 404);
    }

    config.lastUpdated = new Date().toISOString();

    await writeConfig(config);

    res.json({
      success: true,
      message: 'Workbook configuration deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/config/validate
 * Validate configuration structure
 */
router.post('/validate', async (req, res, next) => {
  try {
    const configData = req.body;

    logger.info('Validating configuration');

    const errors = [];

    if (!configData.workbooks || !Array.isArray(configData.workbooks)) {
      errors.push('workbooks must be an array');
    } else {
      configData.workbooks.forEach((wb, index) => {
        if (!wb.workbookName) {
          errors.push(`Workbook at index ${index} missing workbookName`);
        }
      });
    }

    const isValid = errors.length === 0;

    res.json({
      success: true,
      data: {
        valid: isValid,
        errors: errors,
        workbookCount: configData.workbooks?.length || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper functions
 */

async function readConfig() {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Return default config if file doesn't exist
      return {
        workbooks: [],
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
    }
    throw new AppError(`Failed to read configuration: ${error.message}`, 500);
  }
}

async function writeConfig(config) {
  try {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(CONFIG_PATH, content, 'utf8');
    logger.info('Configuration saved successfully');
  } catch (error) {
    throw new AppError(`Failed to write configuration: ${error.message}`, 500);
  }
}

module.exports = router;

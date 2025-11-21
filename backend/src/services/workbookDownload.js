const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const tableauAuthService = require('./tableauAuth');

class WorkbookDownloadService {
  constructor() {
    this.tempPath = process.env.TEMP_WORKBOOK_PATH || './temp-workbooks';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 104857600; // 100MB default
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error: error.message });
      throw new AppError('Failed to create temporary directory', 500);
    }
  }

  /**
   * Download workbook from Tableau Server
   * @param {string} workbookId - Tableau workbook ID
   * @param {boolean} includeExtract - Whether to include extract data
   * @returns {Promise<Object>} Downloaded workbook info
   */
  async downloadWorkbook(workbookId, includeExtract = false) {
    try {
      await this.ensureTempDirectory();

      logger.info('Starting workbook download', { workbookId, includeExtract });

      const client = await tableauAuthService.getAuthenticatedClient();
      const siteId = await tableauAuthService.getSiteId();

      // Build download URL
      let downloadUrl = `/sites/${siteId}/workbooks/${workbookId}/content`;
      if (!includeExtract) {
        downloadUrl += '?includeExtract=false';
      }

      // Download workbook
      const response = await client.get(downloadUrl, {
        responseType: 'arraybuffer',
        maxContentLength: this.maxFileSize,
        maxBodyLength: this.maxFileSize
      });

      // Determine file extension from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let fileName = `workbook_${workbookId}_${uuidv4()}`;

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (fileNameMatch) {
          fileName = fileNameMatch[1];
        }
      }

      // Ensure correct extension
      if (!fileName.endsWith('.twb') && !fileName.endsWith('.twbx')) {
        // Determine from content-type or default to .twbx
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('xml')) {
          fileName += '.twb';
        } else {
          fileName += '.twbx';
        }
      }

      const filePath = path.join(this.tempPath, fileName);

      // Save file
      await fs.writeFile(filePath, Buffer.from(response.data));

      const stats = await fs.stat(filePath);

      logger.info('Workbook downloaded successfully', {
        workbookId,
        fileName,
        filePath,
        size: stats.size
      });

      return {
        workbookId,
        fileName,
        filePath,
        size: stats.size,
        extension: path.extname(fileName),
        downloadedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Workbook download failed', {
        workbookId,
        error: error.message,
        response: error.response?.data
      });

      if (error.response?.status === 404) {
        throw new AppError(`Workbook not found: ${workbookId}`, 404);
      }

      if (error.response?.status === 403) {
        throw new AppError('Insufficient permissions to download workbook', 403);
      }

      throw new AppError(`Failed to download workbook: ${error.message}`, 500);
    }
  }

  /**
   * Get workbook details from Tableau Server
   * @param {string} workbookId - Tableau workbook ID
   * @returns {Promise<Object>} Workbook metadata
   */
  async getWorkbookDetails(workbookId) {
    try {
      const client = await tableauAuthService.getAuthenticatedClient();
      const siteId = await tableauAuthService.getSiteId();

      const response = await client.get(`/sites/${siteId}/workbooks/${workbookId}`);

      if (response.data && response.data.workbook) {
        const workbook = response.data.workbook;

        logger.info('Retrieved workbook details', {
          workbookId,
          name: workbook.name,
          projectId: workbook.project?.id
        });

        return {
          id: workbook.id,
          name: workbook.name,
          description: workbook.description,
          contentUrl: workbook.contentUrl,
          webpageUrl: workbook.webpageUrl,
          showTabs: workbook.showTabs,
          size: workbook.size,
          createdAt: workbook.createdAt,
          updatedAt: workbook.updatedAt,
          project: workbook.project,
          owner: workbook.owner,
          tags: workbook.tags?.tag || []
        };
      }

      throw new AppError('Invalid workbook details response', 500);
    } catch (error) {
      logger.error('Failed to get workbook details', {
        workbookId,
        error: error.message
      });

      if (error.response?.status === 404) {
        throw new AppError(`Workbook not found: ${workbookId}`, 404);
      }

      throw error;
    }
  }

  /**
   * List all views (worksheets) in a workbook
   * @param {string} workbookId - Tableau workbook ID
   * @returns {Promise<Array>} List of views
   */
  async listWorkbookViews(workbookId) {
    try {
      const client = await tableauAuthService.getAuthenticatedClient();
      const siteId = await tableauAuthService.getSiteId();

      const response = await client.get(`/sites/${siteId}/workbooks/${workbookId}/views`);

      if (response.data && response.data.views) {
        const views = response.data.views.view || [];

        logger.info('Retrieved workbook views', {
          workbookId,
          viewCount: views.length
        });

        return views.map(view => ({
          id: view.id,
          name: view.name,
          contentUrl: view.contentUrl,
          viewUrlName: view.viewUrlName,
          createdAt: view.createdAt,
          updatedAt: view.updatedAt
        }));
      }

      return [];
    } catch (error) {
      logger.error('Failed to list workbook views', {
        workbookId,
        error: error.message
      });

      throw new AppError(`Failed to list workbook views: ${error.message}`, 500);
    }
  }

  /**
   * Clean up downloaded workbook file
   * @param {string} filePath - Path to workbook file
   */
  async cleanup(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info('Cleaned up workbook file', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup workbook file', {
        filePath,
        error: error.message
      });
    }
  }

  /**
   * Clean up old files in temp directory
   * @param {number} ageMinutes - Delete files older than this many minutes
   */
  async cleanupOldFiles(ageMinutes = 30) {
    try {
      const files = await fs.readdir(this.tempPath);
      const now = Date.now();
      const maxAge = ageMinutes * 60 * 1000;
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempPath, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old workbook files`);
      }
    } catch (error) {
      logger.error('Error during cleanup of old files', { error: error.message });
    }
  }
}

module.exports = new WorkbookDownloadService();

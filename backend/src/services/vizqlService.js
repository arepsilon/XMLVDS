const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const tableauAuthService = require('./tableauAuth');

class VizQLService {
  constructor() {
    this.maxRows = parseInt(process.env.VIZQL_MAX_ROWS) || 100000;
    this.timeout = parseInt(process.env.VIZQL_TIMEOUT_MS) || 30000;
  }

  /**
   * Build VizQL query from worksheet metadata
   * @param {Object} metadata - Worksheet metadata
   * @returns {Object} VizQL query object
   */
  buildVizQLQuery(metadata) {
    try {
      logger.info('Building VizQL query', {
        worksheet: metadata.worksheetName
      });

      const { structure } = metadata;
      const query = {
        worksheetName: metadata.worksheetName,
        fieldMap: {
          dimensions: [],
          measures: []
        },
        filters: [],
        sort: [],
        options: {
          includeNulls: false,
          maxRows: this.maxRows
        }
      };

      // Add row fields as dimensions
      if (structure.rows && structure.rows.length > 0) {
        structure.rows.forEach(row => {
          query.fieldMap.dimensions.push(row.fieldName);
        });
      }

      // Add column fields as dimensions
      if (structure.columns && structure.columns.length > 0) {
        structure.columns.forEach(col => {
          let fieldName = col.fieldName;

          // Handle date parts
          if (col.datePart) {
            fieldName = `DATEPART('${col.datePart}', ${fieldName})`;
          }

          query.fieldMap.dimensions.push(fieldName);
        });
      }

      // Add value fields as measures
      if (structure.values && structure.values.length > 0) {
        structure.values.forEach(val => {
          let measureField = val.fieldName;

          // Add aggregation if specified
          if (val.aggregation) {
            measureField = `${val.aggregation}(${val.fieldName})`;
          }

          query.fieldMap.measures.push(measureField);
        });
      }

      // Translate filters
      if (structure.filters && structure.filters.length > 0) {
        structure.filters.forEach(filter => {
          query.filters.push(this.translateFilter(filter));
        });
      }

      // Translate sorting
      if (structure.sorting && structure.sorting.length > 0) {
        structure.sorting.forEach(sort => {
          query.sort.push({
            field: sort.fieldName,
            order: sort.direction.toUpperCase()
          });
        });
      }

      logger.info('VizQL query built successfully', {
        dimensions: query.fieldMap.dimensions.length,
        measures: query.fieldMap.measures.length,
        filters: query.filters.length
      });

      return query;
    } catch (error) {
      logger.error('Failed to build VizQL query', { error: error.message });
      throw new AppError(`VizQL query building failed: ${error.message}`, 500);
    }
  }

  /**
   * Translate filter from metadata to VizQL format
   */
  translateFilter(filter) {
    const vizqlFilter = {
      field: filter.fieldName,
      type: filter.type,
      operation: filter.operation
    };

    switch (filter.type) {
      case 'categorical':
        vizqlFilter.values = filter.values;
        break;

      case 'range':
        vizqlFilter.min = filter.values[0];
        vizqlFilter.max = filter.values[1];
        break;

      case 'relative-date':
        vizqlFilter.period = filter.operation;
        vizqlFilter.value = filter.value;
        break;

      default:
        vizqlFilter.values = filter.values;
    }

    return vizqlFilter;
  }

  /**
   * Execute VizQL query against Tableau Server
   * Note: This is a simplified implementation. The actual VizQL Data Service API
   * may require different authentication and query format depending on your
   * Tableau Server version and configuration.
   *
   * @param {string} workbookId - Workbook ID
   * @param {string} viewName - View/worksheet name
   * @param {Object} query - VizQL query object
   * @returns {Promise<Object>} Query results
   */
  async executeQuery(workbookId, viewName, query) {
    try {
      logger.info('Executing VizQL query', { workbookId, viewName });

      const client = await tableauAuthService.getAuthenticatedClient();
      const siteId = await tableauAuthService.getSiteId();

      // Build the query endpoint
      // Note: This is a conceptual implementation. The actual endpoint and
      // request format will depend on your Tableau Server configuration.
      const endpoint = `/sites/${siteId}/workbooks/${workbookId}/views/${encodeURIComponent(viewName)}/data`;

      // Prepare the request body
      const requestBody = {
        queries: [{
          dimensions: query.fieldMap.dimensions,
          measures: query.fieldMap.measures,
          filters: query.filters,
          sort: query.sort,
          maxRows: query.options.maxRows
        }]
      };

      // Execute the query
      const response = await client.post(endpoint, requestBody, {
        timeout: this.timeout
      });

      // Parse and transform the response
      const data = this.transformVizQLResponse(response.data, query);

      logger.info('VizQL query executed successfully', {
        rowCount: data.rows.length,
        columnCount: data.columns.length
      });

      return data;
    } catch (error) {
      logger.error('VizQL query execution failed', {
        workbookId,
        viewName,
        error: error.message,
        response: error.response?.data
      });

      if (error.response?.status === 404) {
        throw new AppError(`View not found: ${viewName}`, 404);
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new AppError('Query timeout - try reducing the date range or adding filters', 408);
      }

      throw new AppError(`VizQL query failed: ${error.message}`, 500);
    }
  }

  /**
   * Alternative method: Query data using Tableau's CSV export endpoint
   * This is more reliable than VizQL for getting raw data
   */
  async queryDataViaCSV(workbookId, viewName, filters = []) {
    try {
      logger.info('Querying data via CSV export', { workbookId, viewName });

      const client = await tableauAuthService.getAuthenticatedClient();
      const siteId = await tableauAuthService.getSiteId();

      // Build CSV data endpoint
      let endpoint = `/sites/${siteId}/views/${viewName}/data`;

      // Add filters as query parameters
      if (filters.length > 0) {
        const filterParams = filters.map(f =>
          `vf(${encodeURIComponent(f.field)})=${encodeURIComponent(f.values.join(','))}`
        ).join('&');

        endpoint += `?${filterParams}`;
      }

      const response = await client.get(endpoint, {
        responseType: 'text',
        headers: {
          'Accept': 'text/csv'
        },
        timeout: this.timeout
      });

      // Parse CSV response
      const data = this.parseCSVData(response.data);

      logger.info('CSV data retrieved successfully', {
        rowCount: data.rows.length,
        columnCount: data.columns.length
      });

      return data;
    } catch (error) {
      logger.error('CSV data query failed', {
        workbookId,
        viewName,
        error: error.message
      });

      throw new AppError(`Failed to retrieve data: ${error.message}`, 500);
    }
  }

  /**
   * Transform VizQL response to normalized format
   */
  transformVizQLResponse(vizqlData, query) {
    try {
      const columns = [];
      const rows = [];

      // Extract column names from query
      const allFields = [
        ...query.fieldMap.dimensions,
        ...query.fieldMap.measures
      ];

      allFields.forEach(field => {
        columns.push({
          name: this.cleanFieldName(field),
          originalName: field,
          type: this.determineFieldType(field)
        });
      });

      // Extract rows from VizQL response
      // Note: The actual structure will depend on your Tableau Server's response format
      if (vizqlData.data && Array.isArray(vizqlData.data)) {
        vizqlData.data.forEach(dataRow => {
          const row = {};

          columns.forEach((col, index) => {
            row[col.name] = dataRow[index];
          });

          rows.push(row);
        });
      }

      return {
        columns,
        rows,
        metadata: {
          rowCount: rows.length,
          columnCount: columns.length,
          query: query
        }
      };
    } catch (error) {
      logger.error('Failed to transform VizQL response', { error: error.message });
      throw new AppError('Failed to transform query results', 500);
    }
  }

  /**
   * Parse CSV data into structured format
   */
  parseCSVData(csvText) {
    try {
      const lines = csvText.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return { columns: [], rows: [] };
      }

      // Parse header
      const headers = this.parseCSVLine(lines[0]);
      const columns = headers.map(header => ({
        name: header,
        originalName: header,
        type: 'string' // Type inference can be added
      }));

      // Parse data rows
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const row = {};

        headers.forEach((header, index) => {
          row[header] = this.parseCSVValue(values[index]);
        });

        rows.push(row);
      }

      return {
        columns,
        rows,
        metadata: {
          rowCount: rows.length,
          columnCount: columns.length
        }
      };
    } catch (error) {
      logger.error('Failed to parse CSV data', { error: error.message });
      throw new AppError('Failed to parse CSV data', 500);
    }
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Check for escaped quote
        if (inQuotes && line[i + 1] === '"') {
          currentValue += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    // Add the last value
    values.push(currentValue.trim());

    return values;
  }

  /**
   * Parse CSV value and infer type
   */
  parseCSVValue(value) {
    if (value === '' || value === null) {
      return null;
    }

    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/""/g, '"');
    }

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }

    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.match(/\d{4}-\d{2}-\d{2}/)) {
      return date.toISOString();
    }

    // Return as string
    return value;
  }

  cleanFieldName(field) {
    return field.replace(/^\[|\]$/g, '').replace(/^(SUM|AVG|COUNT|MIN|MAX|MEDIAN)\(/i, '').replace(/\)$/, '');
  }

  determineFieldType(field) {
    if (field.match(/^(SUM|AVG|COUNT|MIN|MAX|MEDIAN)\(/i)) {
      return 'measure';
    }
    return 'dimension';
  }

  /**
   * Handle pagination for large datasets
   */
  async queryWithPagination(workbookId, viewName, query, pageSize = 10000) {
    const allRows = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && offset < this.maxRows) {
      const paginatedQuery = {
        ...query,
        options: {
          ...query.options,
          limit: pageSize,
          offset: offset
        }
      };

      const result = await this.executeQuery(workbookId, viewName, paginatedQuery);

      allRows.push(...result.rows);
      offset += pageSize;
      hasMore = result.rows.length === pageSize;

      logger.info('Retrieved page of data', {
        offset,
        pageSize,
        totalRetrieved: allRows.length
      });
    }

    return {
      columns: allRows.length > 0 ? Object.keys(allRows[0]).map(name => ({
        name,
        originalName: name,
        type: 'string'
      })) : [],
      rows: allRows,
      metadata: {
        rowCount: allRows.length,
        columnCount: allRows.length > 0 ? Object.keys(allRows[0]).length : 0
      }
    };
  }
}

module.exports = new VizQLService();

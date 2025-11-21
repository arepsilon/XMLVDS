const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class XMLParserService {
  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
      cdataTagName: '__cdata',
      cdataPositionChar: '\\c',
      parseTrueNumberOnly: false,
      arrayMode: false,
      stopNodes: ['*.pre', '*.script'],
      alwaysCreateTextNode: false,
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // Ensure these are always arrays
        if (['worksheet', 'datasource', 'column', 'filter', 'style-rule', 'format', 'calculation'].includes(name)) {
          return true;
        }
        return false;
      }
    });
  }

  /**
   * Extract TWB file from TWBX archive
   * @param {string} twbxPath - Path to TWBX file
   * @returns {Promise<Object>} Extracted TWB content and path
   */
  async extractTwbxFile(twbxPath) {
    try {
      logger.info('Extracting TWBX file', { twbxPath });

      const zip = new AdmZip(twbxPath);
      const zipEntries = zip.getEntries();

      // Find the .twb file
      const twbEntry = zipEntries.find(entry => entry.entryName.endsWith('.twb'));

      if (!twbEntry) {
        throw new AppError('No .twb file found in TWBX archive', 422);
      }

      const twbContent = twbEntry.getData().toString('utf8');
      const extractPath = path.join(path.dirname(twbxPath), 'extracted_' + path.basename(twbxPath, '.twbx'));

      await fs.mkdir(extractPath, { recursive: true });

      // Extract all files for reference
      zip.extractAllTo(extractPath, true);

      logger.info('TWBX extracted successfully', {
        twbFile: twbEntry.entryName,
        extractPath
      });

      return {
        twbContent,
        twbFileName: twbEntry.entryName,
        extractPath,
        files: zipEntries.map(e => e.entryName)
      };
    } catch (error) {
      logger.error('Failed to extract TWBX file', {
        twbxPath,
        error: error.message
      });
      throw new AppError(`TWBX extraction failed: ${error.message}`, 422);
    }
  }

  /**
   * Parse TWB XML content
   * @param {string} twbContent - XML content of TWB file
   * @returns {Promise<Object>} Parsed workbook object
   */
  async parseTwbXml(twbContent) {
    try {
      logger.info('Parsing TWB XML content');

      const workbook = this.xmlParser.parse(twbContent);

      if (!workbook || !workbook.workbook) {
        throw new AppError('Invalid TWB XML structure', 422);
      }

      logger.info('TWB XML parsed successfully');

      return workbook.workbook;
    } catch (error) {
      logger.error('Failed to parse TWB XML', { error: error.message });
      throw new AppError(`XML parsing failed: ${error.message}`, 422);
    }
  }

  /**
   * Extract comprehensive worksheet metadata
   * @param {Object} workbook - Parsed workbook object
   * @returns {Promise<Array>} Array of worksheet metadata
   */
  async extractWorksheetMetadata(workbook) {
    try {
      const worksheets = [];
      const workbookName = workbook['@_name'] || 'Unknown Workbook';

      // Get worksheets array
      let worksheetsList = workbook.worksheets?.worksheet || [];
      if (!Array.isArray(worksheetsList)) {
        worksheetsList = [worksheetsList];
      }

      for (const worksheet of worksheetsList) {
        if (!worksheet) continue;

        const worksheetName = worksheet['@_name'];
        logger.info('Extracting metadata for worksheet', { worksheetName });

        const metadata = {
          worksheetName,
          worksheetId: worksheetName.toLowerCase().replace(/\s+/g, '-'),
          structure: {
            rows: this.extractRows(worksheet),
            columns: this.extractColumns(worksheet),
            values: this.extractValues(worksheet),
            filters: this.extractFilters(worksheet),
            conditionalFormatting: this.extractConditionalFormatting(worksheet),
            calculatedFields: this.extractCalculatedFields(worksheet),
            sorting: this.extractSorting(worksheet),
            markType: worksheet.table?.panes?.pane?.['@_mark-class'] || 'automatic'
          },
          dataSource: this.extractDataSource(workbook)
        };

        worksheets.push(metadata);
      }

      logger.info('Extracted metadata for all worksheets', {
        workbookName,
        worksheetCount: worksheets.length
      });

      return {
        workbookName,
        worksheetCount: worksheets.length,
        worksheets
      };
    } catch (error) {
      logger.error('Failed to extract worksheet metadata', { error: error.message });
      throw new AppError(`Metadata extraction failed: ${error.message}`, 422);
    }
  }

  /**
   * Extract rows configuration
   */
  extractRows(worksheet) {
    const rows = [];

    try {
      const table = worksheet.table;
      if (!table || !table.rows) return rows;

      let rowElements = table.rows;
      if (typeof rowElements === 'string') {
        rowElements = { column: [] };
      }

      let columns = rowElements.column || [];
      if (!Array.isArray(columns)) {
        columns = [columns];
      }

      columns.forEach((col, index) => {
        if (!col) return;

        const fieldName = col['#text'] || col;
        rows.push({
          fieldName: this.cleanFieldName(fieldName),
          type: this.determineFieldType(fieldName),
          hierarchy: index,
          aggregation: this.extractAggregation(col),
          discrete: !col['@_continuous']
        });
      });
    } catch (error) {
      logger.warn('Error extracting rows', { error: error.message });
    }

    return rows;
  }

  /**
   * Extract columns configuration
   */
  extractColumns(worksheet) {
    const columns = [];

    try {
      const table = worksheet.table;
      if (!table || !table.cols) return columns;

      let colElements = table.cols;
      if (typeof colElements === 'string') {
        colElements = { column: [] };
      }

      let columnList = colElements.column || [];
      if (!Array.isArray(columnList)) {
        columnList = [columnList];
      }

      columnList.forEach((col, index) => {
        if (!col) return;

        const fieldName = col['#text'] || col;
        const column = {
          fieldName: this.cleanFieldName(fieldName),
          type: this.determineFieldType(fieldName),
          hierarchy: index
        };

        // Check for date parts
        const datePart = this.extractDatePart(fieldName);
        if (datePart) {
          column.datePart = datePart;
        }

        columns.push(column);
      });
    } catch (error) {
      logger.warn('Error extracting columns', { error: error.message });
    }

    return columns;
  }

  /**
   * Extract values/measures configuration
   */
  extractValues(worksheet) {
    const values = [];

    try {
      const table = worksheet.table;
      if (!table || !table.panes?.pane) return values;

      const pane = table.panes.pane;
      const encodings = pane.encodings;

      if (!encodings) return values;

      // Extract from different encoding types
      ['color', 'size', 'text', 'tooltip'].forEach(encType => {
        const encoding = encodings[encType];
        if (!encoding) return;

        let columns = encoding.column || [];
        if (!Array.isArray(columns)) {
          columns = [columns];
        }

        columns.forEach(col => {
          if (!col) return;

          const fieldName = col['#text'] || col;
          const value = {
            fieldName: this.cleanFieldName(fieldName),
            aggregation: this.extractAggregation(col) || this.extractAggregation(fieldName),
            format: this.extractFormat(col),
            alias: col['@_caption'] || null
          };

          // Avoid duplicates
          if (!values.find(v => v.fieldName === value.fieldName)) {
            values.push(value);
          }
        });
      });
    } catch (error) {
      logger.warn('Error extracting values', { error: error.message });
    }

    return values;
  }

  /**
   * Extract filters configuration
   */
  extractFilters(worksheet) {
    const filters = [];

    try {
      const table = worksheet.table;
      if (!table) return filters;

      let filterList = table.filter || [];
      if (!Array.isArray(filterList)) {
        filterList = [filterList];
      }

      filterList.forEach(filter => {
        if (!filter) return;

        const fieldName = filter['@_column'] || filter['@_class'];

        filters.push({
          fieldName: this.cleanFieldName(fieldName),
          type: this.determineFilterType(filter),
          operation: filter['@_filter-op'] || 'IN',
          values: this.extractFilterValues(filter),
          isQuickFilter: filter['@_show-filter'] === 'true'
        });
      });
    } catch (error) {
      logger.warn('Error extracting filters', { error: error.message });
    }

    return filters;
  }

  /**
   * Extract conditional formatting rules
   */
  extractConditionalFormatting(worksheet) {
    const formatting = [];

    try {
      let styleRules = worksheet['style-rules']?.['style-rule'] || [];
      if (!Array.isArray(styleRules)) {
        styleRules = [styleRules];
      }

      styleRules.forEach(rule => {
        if (!rule) return;

        formatting.push({
          field: rule['@_element'] || null,
          scope: rule['@_scope'] || 'pane',
          rules: this.extractStyleRuleDetails(rule)
        });
      });
    } catch (error) {
      logger.warn('Error extracting conditional formatting', { error: error.message });
    }

    return formatting;
  }

  /**
   * Extract calculated fields
   */
  extractCalculatedFields(worksheet) {
    const calculatedFields = [];

    try {
      const table = worksheet.table;
      if (!table) return calculatedFields;

      let columns = table.columns?.column || [];
      if (!Array.isArray(columns)) {
        columns = [columns];
      }

      columns.forEach(col => {
        if (!col || !col.calculation) return;

        calculatedFields.push({
          name: col['@_caption'] || col['@_name'],
          formula: col.calculation['@_formula'] || col.calculation['#text'],
          dataType: col['@_datatype'] || 'string',
          fields: this.extractReferencedFields(col.calculation)
        });
      });
    } catch (error) {
      logger.warn('Error extracting calculated fields', { error: error.message });
    }

    return calculatedFields;
  }

  /**
   * Extract sorting configuration
   */
  extractSorting(worksheet) {
    const sorting = [];

    try {
      const table = worksheet.table;
      if (!table) return sorting;

      let sortElements = table.sort || [];
      if (!Array.isArray(sortElements)) {
        sortElements = [sortElements];
      }

      sortElements.forEach((sort, index) => {
        if (!sort) return;

        sorting.push({
          fieldName: this.cleanFieldName(sort['@_column']),
          direction: sort['@_direction'] || 'ascending',
          priority: index + 1
        });
      });
    } catch (error) {
      logger.warn('Error extracting sorting', { error: error.message });
    }

    return sorting;
  }

  /**
   * Extract data source information
   */
  extractDataSource(workbook) {
    try {
      let datasources = workbook.datasources?.datasource || [];
      if (!Array.isArray(datasources)) {
        datasources = [datasources];
      }

      // Get the primary datasource (first non-Parameters datasource)
      const primaryDs = datasources.find(ds => ds['@_name'] !== 'Parameters');

      if (primaryDs) {
        return {
          name: primaryDs['@_name'],
          caption: primaryDs['@_caption'] || primaryDs['@_name'],
          version: primaryDs['@_version']
        };
      }
    } catch (error) {
      logger.warn('Error extracting data source', { error: error.message });
    }

    return { name: 'Unknown', caption: 'Unknown' };
  }

  // Helper methods

  cleanFieldName(fieldName) {
    if (!fieldName) return '';
    return fieldName.toString().replace(/^\[|\]$/g, '');
  }

  determineFieldType(fieldName) {
    if (!fieldName) return 'unknown';
    const fieldStr = fieldName.toString().toLowerCase();

    if (fieldStr.includes('sum(') || fieldStr.includes('avg(') ||
        fieldStr.includes('count(') || fieldStr.includes('min(') ||
        fieldStr.includes('max(')) {
      return 'measure';
    }

    return 'dimension';
  }

  extractAggregation(field) {
    if (!field) return null;

    const fieldStr = field.toString();
    const aggMatch = fieldStr.match(/(SUM|AVG|COUNT|MIN|MAX|MEDIAN|STDEV|VAR)\(/i);

    return aggMatch ? aggMatch[1].toUpperCase() : null;
  }

  extractDatePart(fieldName) {
    if (!fieldName) return null;

    const fieldStr = fieldName.toString().toLowerCase();
    const dateParts = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute'];

    for (const part of dateParts) {
      if (fieldStr.includes(part)) {
        return part;
      }
    }

    return null;
  }

  extractFormat(column) {
    const format = {};

    if (column['@_format']) {
      // Parse format string
      const formatStr = column['@_format'];

      if (formatStr.includes('$')) {
        format.type = 'currency';
        format.symbol = '$';
      } else if (formatStr.includes('%')) {
        format.type = 'percentage';
      } else if (formatStr.includes('.')) {
        format.type = 'number';
        const decMatch = formatStr.match(/\.(\d+)/);
        format.decimals = decMatch ? decMatch[1].length : 2;
      }
    }

    return Object.keys(format).length > 0 ? format : null;
  }

  determineFilterType(filter) {
    if (filter['@_filter-op']) {
      const op = filter['@_filter-op'];
      if (op.includes('range')) return 'range';
      if (op.includes('relative-date')) return 'relative-date';
    }

    return 'categorical';
  }

  extractFilterValues(filter) {
    const values = [];

    try {
      if (filter.groupfilter) {
        let members = filter.groupfilter.groupfilter?.member || [];
        if (!Array.isArray(members)) members = [members];

        members.forEach(member => {
          if (member['@_value']) {
            values.push(member['@_value']);
          }
        });
      }

      if (filter['@_value']) {
        values.push(filter['@_value']);
      }
    } catch (error) {
      logger.warn('Error extracting filter values', { error: error.message });
    }

    return values;
  }

  extractStyleRuleDetails(rule) {
    const rules = [];

    try {
      let formats = rule.format || [];
      if (!Array.isArray(formats)) formats = [formats];

      formats.forEach(format => {
        rules.push({
          condition: format['@_test'] || 'default',
          threshold: format['@_value'] || null,
          format: {
            backgroundColor: format['@_bg-color'] || null,
            fontColor: format['@_fg-color'] || null,
            fontWeight: format['@_font-weight'] || null
          }
        });
      });
    } catch (error) {
      logger.warn('Error extracting style rule details', { error: error.message });
    }

    return rules;
  }

  extractReferencedFields(calculation) {
    const fields = [];

    try {
      const formula = calculation['@_formula'] || calculation['#text'] || '';
      const fieldMatches = formula.match(/\[([^\]]+)\]/g);

      if (fieldMatches) {
        fieldMatches.forEach(match => {
          fields.push(match);
        });
      }
    } catch (error) {
      logger.warn('Error extracting referenced fields', { error: error.message });
    }

    return fields;
  }

  /**
   * Save metadata to JSON file
   */
  async saveMetadataToJson(metadata, outputPath) {
    try {
      const jsonContent = JSON.stringify(metadata, null, 2);
      await fs.writeFile(outputPath, jsonContent, 'utf8');

      logger.info('Metadata saved to JSON', { outputPath });

      return outputPath;
    } catch (error) {
      logger.error('Failed to save metadata to JSON', {
        outputPath,
        error: error.message
      });
      throw new AppError(`Failed to save metadata: ${error.message}`, 500);
    }
  }
}

module.exports = new XMLParserService();

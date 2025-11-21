const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class ExcelExportService {
  constructor() {
    this.tempPath = process.env.TEMP_EXPORT_PATH || './temp-exports';
    this.maxRows = parseInt(process.env.EXCEL_MAX_ROWS) || 1048576;
    this.enableCompression = process.env.EXCEL_COMPRESSION === 'true';
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
   * Generate Excel file with data and optional pivot table
   * @param {Object} config - Export configuration
   * @returns {Promise<Object>} Export result
   */
  async generateExcel(config) {
    try {
      await this.ensureTempDirectory();

      const {
        worksheetName,
        workbookName,
        data,
        metadata,
        formatting = {},
        customHeaders = [],
        pivotConfig = null
      } = config;

      logger.info('Generating Excel file', {
        worksheetName,
        rowCount: data.rows.length,
        hasPivot: !!pivotConfig
      });

      // Validate row count
      if (data.rows.length > this.maxRows) {
        throw new AppError(`Data exceeds Excel row limit (${this.maxRows} rows)`, 400);
      }

      const workbook = new ExcelJS.Workbook();

      // Set workbook properties
      workbook.creator = 'Tableau Dashboard Extension';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.lastPrinted = new Date();

      // Create data sheet
      const dataSheet = workbook.addWorksheet('Data', {
        properties: { tabColor: { argb: 'FF4A90E2' } }
      });

      // Add data to sheet
      await this.populateDataSheet(dataSheet, data, customHeaders, formatting, metadata);

      // Create pivot sheet if configuration provided
      if (pivotConfig) {
        const pivotSheet = workbook.addWorksheet('Pivot Table', {
          properties: { tabColor: { argb: 'FFFF9500' } }
        });

        await this.createPivotTable(pivotSheet, data, pivotConfig, formatting);
      }

      // Create summary sheet
      const summarySheet = workbook.addWorksheet('Summary', {
        properties: { tabColor: { argb: 'FF50C878' } }
      });

      await this.createSummarySheet(summarySheet, metadata, config);

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `${workbookName}_${worksheetName}_${timestamp}.xlsx`;
      const filePath = path.join(this.tempPath, fileName);

      // Write file
      await workbook.xlsx.writeFile(filePath);

      const stats = await fs.stat(filePath);

      logger.info('Excel file generated successfully', {
        fileName,
        size: stats.size,
        sheets: workbook.worksheets.length
      });

      return {
        fileName,
        filePath,
        size: stats.size,
        sheetCount: workbook.worksheets.length,
        rowCount: data.rows.length,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Excel generation failed', { error: error.message });
      throw new AppError(`Excel generation failed: ${error.message}`, 500);
    }
  }

  /**
   * Populate data sheet with data and formatting
   */
  async populateDataSheet(sheet, data, customHeaders, formatting, metadata) {
    let currentRow = 1;

    // Add custom header rows
    if (customHeaders && customHeaders.length > 0) {
      for (const header of customHeaders) {
        const row = sheet.getRow(currentRow);

        // Merge cells if specified
        if (header.mergeColumns) {
          const endCol = header.mergeColumns;
          sheet.mergeCells(currentRow, 1, currentRow, endCol);
        }

        row.getCell(1).value = header.text;

        // Apply header formatting
        this.applyHeaderFormatting(row.getCell(1), header.formatting);

        currentRow++;
      }

      // Add blank row after headers
      currentRow++;
    }

    // Add column headers
    const headerRow = sheet.getRow(currentRow);
    const columns = data.columns || Object.keys(data.rows[0] || {});

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = typeof col === 'string' ? col : col.name;

      // Apply header formatting
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    currentRow++;

    // Add data rows
    data.rows.forEach((rowData, rowIndex) => {
      const excelRow = sheet.getRow(currentRow + rowIndex);

      columns.forEach((col, colIndex) => {
        const colName = typeof col === 'string' ? col : col.name;
        const cell = excelRow.getCell(colIndex + 1);

        cell.value = rowData[colName];

        // Apply data formatting
        this.applyDataFormatting(cell, rowData[colName], formatting.columns?.[colName]);

        // Apply conditional formatting rules
        if (formatting.conditionalRules) {
          this.applyConditionalFormatting(cell, rowData[colName], formatting.conditionalRules, colName);
        }
      });
    });

    // Auto-fit columns
    this.autoFitColumns(sheet, columns);

    // Freeze header row
    const freezeRow = customHeaders?.length ? customHeaders.length + 2 : 2;
    sheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: freezeRow - 1, activeCell: 'A' + freezeRow }
    ];

    // Add auto-filter
    const dataStartRow = currentRow;
    const dataEndRow = currentRow + data.rows.length - 1;
    sheet.autoFilter = {
      from: { row: dataStartRow - 1, column: 1 },
      to: { row: dataEndRow, column: columns.length }
    };
  }

  /**
   * Create pivot table on sheet
   * Note: ExcelJS doesn't have native pivot table support, so we'll create
   * a formatted table that looks like a pivot table
   */
  async createPivotTable(sheet, data, pivotConfig, formatting) {
    const { rowFields, columnFields, valueFields, showGrandTotals = true } = pivotConfig;

    logger.info('Creating pivot table structure', {
      rowFields: rowFields?.length || 0,
      columnFields: columnFields?.length || 0,
      valueFields: valueFields?.length || 0
    });

    // Build pivot data structure
    const pivotData = this.buildPivotData(data.rows, rowFields, columnFields, valueFields);

    // Render pivot table
    let currentRow = 1;
    let currentCol = 1;

    // Add title
    const titleCell = sheet.getCell(currentRow, currentCol);
    titleCell.value = 'Pivot Table';
    titleCell.font = { bold: true, size: 14 };
    sheet.mergeCells(currentRow, currentCol, currentRow, currentCol + 5);
    currentRow += 2;

    // Create pivot headers
    const headerRow = sheet.getRow(currentRow);

    // Row field headers
    rowFields.forEach((field, index) => {
      const cell = headerRow.getCell(currentCol + index);
      cell.value = field;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
      };
    });

    currentCol += rowFields.length;

    // Column field headers (value columns)
    const uniqueColumnValues = this.getUniqueColumnValues(pivotData, columnFields);
    uniqueColumnValues.forEach(colValue => {
      valueFields.forEach(valueField => {
        const cell = headerRow.getCell(currentCol);
        cell.value = `${colValue} - ${valueField.name}`;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E1F2' }
        };
        currentCol++;
      });
    });

    // Grand total column
    if (showGrandTotals) {
      valueFields.forEach(valueField => {
        const cell = headerRow.getCell(currentCol);
        cell.value = `Grand Total - ${valueField.name}`;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC000' }
        };
        currentCol++;
      });
    }

    currentRow++;

    // Add pivot data rows
    this.renderPivotRows(sheet, pivotData, currentRow, rowFields, columnFields, valueFields, showGrandTotals);

    // Auto-fit columns
    sheet.columns.forEach(column => {
      if (column && column.values) {
        const maxLength = column.values.reduce((max, val) => {
          const length = val ? val.toString().length : 0;
          return Math.max(max, length);
        }, 10);
        column.width = Math.min(maxLength + 2, 50);
      }
    });
  }

  /**
   * Build pivot data structure from raw data
   */
  buildPivotData(rows, rowFields, columnFields, valueFields) {
    const pivotMap = new Map();

    rows.forEach(row => {
      // Create row key
      const rowKey = rowFields.map(field => row[field] || '').join('|');

      // Create column key
      const colKey = columnFields.map(field => row[field] || '').join('|');

      // Initialize row entry
      if (!pivotMap.has(rowKey)) {
        pivotMap.set(rowKey, {
          rowValues: rowFields.map(field => row[field]),
          columns: new Map()
        });
      }

      const rowEntry = pivotMap.get(rowKey);

      // Initialize column entry
      if (!rowEntry.columns.has(colKey)) {
        rowEntry.columns.set(colKey, {
          values: {}
        });
      }

      const colEntry = rowEntry.columns.get(colKey);

      // Aggregate values
      valueFields.forEach(valueField => {
        const value = parseFloat(row[valueField.field]) || 0;
        const aggregation = valueField.aggregation || 'SUM';

        if (!colEntry.values[valueField.name]) {
          colEntry.values[valueField.name] = {
            sum: 0,
            count: 0,
            min: value,
            max: value
          };
        }

        const agg = colEntry.values[valueField.name];
        agg.sum += value;
        agg.count++;
        agg.min = Math.min(agg.min, value);
        agg.max = Math.max(agg.max, value);
      });
    });

    return pivotMap;
  }

  /**
   * Get unique column values for pivot table
   */
  getUniqueColumnValues(pivotData, columnFields) {
    const uniqueValues = new Set();

    for (const [, rowEntry] of pivotData) {
      for (const [colKey] of rowEntry.columns) {
        uniqueValues.add(colKey);
      }
    }

    return Array.from(uniqueValues);
  }

  /**
   * Render pivot table rows
   */
  renderPivotRows(sheet, pivotData, startRow, rowFields, columnFields, valueFields, showGrandTotals) {
    let currentRow = startRow;
    const uniqueColumnValues = this.getUniqueColumnValues(pivotData, columnFields);

    for (const [rowKey, rowEntry] of pivotData) {
      const excelRow = sheet.getRow(currentRow);
      let currentCol = 1;

      // Add row field values
      rowEntry.rowValues.forEach((value, index) => {
        const cell = excelRow.getCell(currentCol + index);
        cell.value = value;
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      currentCol += rowFields.length;

      // Add value cells for each column
      let rowTotal = {};
      valueFields.forEach(vf => {
        rowTotal[vf.name] = { sum: 0, count: 0 };
      });

      uniqueColumnValues.forEach(colValue => {
        valueFields.forEach(valueField => {
          const cell = excelRow.getCell(currentCol);
          const colEntry = rowEntry.columns.get(colValue);

          if (colEntry && colEntry.values[valueField.name]) {
            const agg = colEntry.values[valueField.name];
            let displayValue;

            switch (valueField.aggregation) {
              case 'AVG':
                displayValue = agg.sum / agg.count;
                break;
              case 'COUNT':
                displayValue = agg.count;
                break;
              case 'MIN':
                displayValue = agg.min;
                break;
              case 'MAX':
                displayValue = agg.max;
                break;
              case 'SUM':
              default:
                displayValue = agg.sum;
            }

            cell.value = displayValue;
            cell.numFmt = '#,##0.00';

            // Update row total
            rowTotal[valueField.name].sum += agg.sum;
            rowTotal[valueField.name].count += agg.count;
          } else {
            cell.value = 0;
            cell.numFmt = '#,##0.00';
          }

          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };

          currentCol++;
        });
      });

      // Add grand total cells
      if (showGrandTotals) {
        valueFields.forEach(valueField => {
          const cell = excelRow.getCell(currentCol);
          const total = rowTotal[valueField.name];

          let displayValue;
          switch (valueField.aggregation) {
            case 'AVG':
              displayValue = total.count > 0 ? total.sum / total.count : 0;
              break;
            case 'COUNT':
              displayValue = total.count;
              break;
            case 'SUM':
            default:
              displayValue = total.sum;
          }

          cell.value = displayValue;
          cell.numFmt = '#,##0.00';
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE699' }
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };

          currentCol++;
        });
      }

      currentRow++;
    }
  }

  /**
   * Create summary sheet with metadata
   */
  async createSummarySheet(sheet, metadata, config) {
    let currentRow = 1;

    // Title
    const titleCell = sheet.getCell(currentRow, 1);
    titleCell.value = 'Export Summary';
    titleCell.font = { bold: true, size: 16 };
    currentRow += 2;

    // Metadata
    const metadataItems = [
      ['Workbook Name', config.workbookName],
      ['Worksheet Name', config.worksheetName],
      ['Generated At', new Date().toLocaleString()],
      ['Total Rows', config.data.rows.length],
      ['Total Columns', config.data.columns?.length || Object.keys(config.data.rows[0] || {}).length],
      ['Has Pivot Table', config.pivotConfig ? 'Yes' : 'No']
    ];

    // Add filters applied
    if (metadata?.filters && metadata.filters.length > 0) {
      currentRow++;
      const filterHeaderCell = sheet.getCell(currentRow, 1);
      filterHeaderCell.value = 'Filters Applied:';
      filterHeaderCell.font = { bold: true };
      currentRow++;

      metadata.filters.forEach(filter => {
        const filterCell = sheet.getCell(currentRow, 1);
        filterCell.value = `  • ${filter.fieldName}: ${filter.values?.join(', ') || 'N/A'}`;
        currentRow++;
      });
    }

    currentRow++;

    // Add metadata items
    metadataItems.forEach(([label, value]) => {
      const labelCell = sheet.getCell(currentRow, 1);
      labelCell.value = label;
      labelCell.font = { bold: true };

      const valueCell = sheet.getCell(currentRow, 2);
      valueCell.value = value;

      currentRow++;
    });

    // Set column widths
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 40;
  }

  /**
   * Apply header formatting
   */
  applyHeaderFormatting(cell, formatting) {
    if (!formatting) return;

    if (formatting.bold) cell.font = { ...cell.font, bold: true };
    if (formatting.italic) cell.font = { ...cell.font, italic: true };
    if (formatting.fontSize) cell.font = { ...cell.font, size: formatting.fontSize };
    if (formatting.fontColor) cell.font = { ...cell.font, color: { argb: formatting.fontColor } };
    if (formatting.backgroundColor) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: formatting.backgroundColor }
      };
    }
    if (formatting.alignment) {
      cell.alignment = formatting.alignment;
    }
  }

  /**
   * Apply data cell formatting
   */
  applyDataFormatting(cell, value, columnFormatting) {
    // Apply column-specific formatting
    if (columnFormatting) {
      if (columnFormatting.numberFormat) {
        cell.numFmt = columnFormatting.numberFormat;
      }
      if (columnFormatting.alignment) {
        cell.alignment = columnFormatting.alignment;
      }
      if (columnFormatting.font) {
        cell.font = columnFormatting.font;
      }
    }

    // Auto-detect and format numbers
    if (typeof value === 'number') {
      if (!cell.numFmt) {
        if (Number.isInteger(value)) {
          cell.numFmt = '#,##0';
        } else {
          cell.numFmt = '#,##0.00';
        }
      }
    }

    // Format dates
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      if (!cell.numFmt) {
        cell.numFmt = 'yyyy-mm-dd';
      }
    }

    // Add borders
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
    };
  }

  /**
   * Apply conditional formatting rules
   */
  applyConditionalFormatting(cell, value, rules, columnName) {
    if (!rules || !Array.isArray(rules)) return;

    const applicableRules = rules.filter(rule =>
      !rule.field || rule.field === columnName
    );

    applicableRules.forEach(rule => {
      if (this.evaluateCondition(value, rule.condition, rule.threshold)) {
        if (rule.format.backgroundColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rule.format.backgroundColor.replace('#', 'FF') }
          };
        }
        if (rule.format.fontColor) {
          cell.font = {
            ...cell.font,
            color: { argb: rule.format.fontColor.replace('#', 'FF') }
          };
        }
        if (rule.format.fontWeight === 'bold') {
          cell.font = { ...cell.font, bold: true };
        }
      }
    });
  }

  /**
   * Evaluate conditional formatting condition
   */
  evaluateCondition(value, condition, threshold) {
    const numValue = parseFloat(value);
    const numThreshold = parseFloat(threshold);

    if (isNaN(numValue) || isNaN(numThreshold)) return false;

    switch (condition) {
      case 'greater-than':
        return numValue > numThreshold;
      case 'less-than':
        return numValue < numThreshold;
      case 'equal':
        return numValue === numThreshold;
      case 'greater-than-or-equal':
        return numValue >= numThreshold;
      case 'less-than-or-equal':
        return numValue <= numThreshold;
      default:
        return false;
    }
  }

  /**
   * Auto-fit columns based on content
   */
  autoFitColumns(sheet, columns) {
    columns.forEach((col, index) => {
      const column = sheet.getColumn(index + 1);
      let maxLength = 10;

      column.eachCell({ includeEmpty: false }, cell => {
        const length = cell.value ? cell.value.toString().length : 0;
        maxLength = Math.max(maxLength, length);
      });

      column.width = Math.min(maxLength + 2, 50);
    });
  }

  /**
   * Clean up exported file
   */
  async cleanup(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info('Cleaned up export file', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup export file', {
        filePath,
        error: error.message
      });
    }
  }
}

module.exports = new ExcelExportService();

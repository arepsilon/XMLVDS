/* global tableau */

class TableauService {
  constructor() {
    this.dashboard = null;
    this.workbook = null;
    this.worksheet = null;
  }

  /**
   * Initialize Tableau Extension
   */
  async initialize() {
    try {
      await tableau.extensions.initializeAsync();

      this.dashboard = tableau.extensions.dashboardContent.dashboard;
      this.workbook = this.dashboard.workbook;

      console.log('Tableau Extension initialized successfully');

      return true;
    } catch (error) {
      console.error('Failed to initialize Tableau Extension:', error);
      throw new Error('Failed to initialize Tableau Extension. Ensure this is running in a Tableau dashboard.');
    }
  }

  /**
   * Get workbook information
   */
  async getWorkbookInfo() {
    if (!this.dashboard) {
      throw new Error('Extension not initialized');
    }

    const info = {
      name: this.dashboard.name,
      workbookName: this.workbook ? await this.getWorkbookName() : 'Unknown',
      worksheets: this.getWorksheets(),
      activeSheet: null
    };

    return info;
  }

  /**
   * Get workbook name
   */
  async getWorkbookName() {
    try {
      // Tableau Extensions API doesn't provide direct access to workbook name
      // We can get it from the dashboard or worksheet
      if (this.dashboard) {
        return this.dashboard.name.split(' - ')[0] || 'Unknown Workbook';
      }
      return 'Unknown Workbook';
    } catch (error) {
      console.error('Error getting workbook name:', error);
      return 'Unknown Workbook';
    }
  }

  /**
   * Get all worksheets in dashboard
   */
  getWorksheets() {
    if (!this.dashboard) return [];

    return this.dashboard.worksheets.map(ws => ({
      name: ws.name,
      size: ws.size,
      index: ws.index
    }));
  }

  /**
   * Get worksheet by name
   */
  getWorksheet(name) {
    if (!this.dashboard) return null;

    return this.dashboard.worksheets.find(ws => ws.name === name);
  }

  /**
   * Get data from worksheet
   */
  async getWorksheetData(worksheetName) {
    try {
      const worksheet = this.getWorksheet(worksheetName);

      if (!worksheet) {
        throw new Error(`Worksheet not found: ${worksheetName}`);
      }

      // Get summary data
      const dataTable = await worksheet.getSummaryDataAsync({
        maxRows: 100000
      });

      // Transform to our format
      const columns = dataTable.columns.map(col => ({
        name: col.fieldName,
        dataType: col.dataType,
        index: col.index
      }));

      const rows = dataTable.data.map(row => {
        const rowData = {};
        row.forEach((cell, index) => {
          const column = columns[index];
          rowData[column.name] = cell.formattedValue || cell.value;
        });
        return rowData;
      });

      return {
        columns,
        rows,
        metadata: {
          rowCount: rows.length,
          columnCount: columns.length,
          isSummaryData: true
        }
      };
    } catch (error) {
      console.error('Error getting worksheet data:', error);
      throw new Error(`Failed to get worksheet data: ${error.message}`);
    }
  }

  /**
   * Get filters applied to worksheet
   */
  async getWorksheetFilters(worksheetName) {
    try {
      const worksheet = this.getWorksheet(worksheetName);

      if (!worksheet) {
        throw new Error(`Worksheet not found: ${worksheetName}`);
      }

      const filters = await worksheet.getFiltersAsync();

      return filters.map(filter => ({
        fieldName: filter.fieldName,
        filterType: filter.filterType,
        appliedValues: filter.appliedValues || [],
        isAllSelected: filter.isAllSelected,
        isExcludeMode: filter.isExcludeMode
      }));
    } catch (error) {
      console.error('Error getting worksheet filters:', error);
      return [];
    }
  }

  /**
   * Register event handlers
   */
  registerEventHandlers(handlers) {
    if (!this.dashboard) return;

    // Filter changed event
    if (handlers.onFilterChanged) {
      this.dashboard.worksheets.forEach(worksheet => {
        worksheet.addEventListener(
          tableau.TableauEventType.FilterChanged,
          handlers.onFilterChanged
        );
      });
    }

    // Mark selection changed event
    if (handlers.onMarkSelectionChanged) {
      this.dashboard.worksheets.forEach(worksheet => {
        worksheet.addEventListener(
          tableau.TableauEventType.MarkSelectionChanged,
          handlers.onMarkSelectionChanged
        );
      });
    }

    // Parameter changed event
    if (handlers.onParameterChanged) {
      this.dashboard.worksheets.forEach(worksheet => {
        worksheet.addEventListener(
          tableau.TableauEventType.ParameterChanged,
          handlers.onParameterChanged
        );
      });
    }
  }

  /**
   * Unregister event handlers
   */
  unregisterEventHandlers() {
    if (!this.dashboard) return;

    this.dashboard.worksheets.forEach(worksheet => {
      worksheet.removeEventListener(tableau.TableauEventType.FilterChanged);
      worksheet.removeEventListener(tableau.TableauEventType.MarkSelectionChanged);
      worksheet.removeEventListener(tableau.TableauEventType.ParameterChanged);
    });
  }

  /**
   * Get dashboard parameters
   */
  async getParameters() {
    try {
      if (!this.dashboard) return [];

      const parameters = await this.dashboard.getParametersAsync();

      return parameters.map(param => ({
        name: param.name,
        currentValue: param.currentValue,
        dataType: param.dataType,
        allowableValues: param.allowableValues
      }));
    } catch (error) {
      console.error('Error getting parameters:', error);
      return [];
    }
  }

  /**
   * Get settings (stored configuration)
   */
  getSettings(key) {
    try {
      const settings = tableau.extensions.settings.getAll();
      return key ? settings[key] : settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  /**
   * Save settings
   */
  async saveSettings(key, value) {
    try {
      tableau.extensions.settings.set(key, value);
      await tableau.extensions.settings.saveAsync();
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  /**
   * Show configuration dialog
   */
  async showConfigDialog() {
    try {
      const dialogUrl = window.location.origin + '/config.html';
      await tableau.extensions.ui.displayDialogAsync(
        dialogUrl,
        '{}',
        { height: 500, width: 600 }
      );
    } catch (error) {
      console.error('Error showing config dialog:', error);
    }
  }
}

export default new TableauService();

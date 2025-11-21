import React, { useState } from 'react';
import { Download, FileSpreadsheet, Settings } from 'lucide-react';
import useStore from '../store';
import apiService from '../services/apiService';
import { toast } from 'react-toastify';

const ExportPanel = () => {
  const { data, getExportConfig, pivotConfig, setPivotConfig, clearPivotConfig } = useStore();
  const [exporting, setExporting] = useState(false);
  const [includePivot, setIncludePivot] = useState(false);

  const handleExport = async () => {
    if (!data || !data.rows || data.rows.length === 0) {
      toast.warning('No data to export');
      return;
    }

    try {
      setExporting(true);
      toast.info('Generating Excel file...');

      const config = getExportConfig();

      // Preview export first
      const preview = await apiService.previewExport(config);

      if (preview.warnings && preview.warnings.length > 0) {
        preview.warnings.forEach(warning => toast.warning(warning));
      }

      // Generate Excel
      const result = await apiService.exportToExcel(config);

      // Download the file
      const blob = await apiService.downloadExcel(result.fileName);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const togglePivot = () => {
    if (includePivot) {
      clearPivotConfig();
      setIncludePivot(false);
    } else {
      // Set default pivot configuration
      if (data && data.columns && data.columns.length > 0) {
        setPivotConfig({
          rowFields: [data.columns[0].name],
          columnFields: [],
          valueFields: data.columns
            .slice(1, 3)
            .map(col => ({
              field: col.name,
              name: col.name,
              aggregation: 'SUM'
            })),
          showGrandTotals: true
        });
        setIncludePivot(true);
      }
    }
  };

  const isExportDisabled = !data || !data.rows || data.rows.length === 0 || exporting;

  return (
    <div className="export-panel card">
      <div className="card-header">
        <Download size={20} />
        <h2>Export</h2>
      </div>

      <div className="card-content">
        {/* Export Options */}
        <section className="export-section">
          <h3>Export Options</h3>

          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includePivot}
                onChange={togglePivot}
                disabled={isExportDisabled}
              />
              <span>Include Pivot Table</span>
            </label>
          </div>

          {includePivot && pivotConfig && (
            <div className="pivot-config">
              <div className="config-item">
                <label>Row Fields:</label>
                <span>{pivotConfig.rowFields.join(', ')}</span>
              </div>
              <div className="config-item">
                <label>Value Fields:</label>
                <span>
                  {pivotConfig.valueFields.map(vf => vf.name).join(', ')}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Export Statistics */}
        {data && data.rows && (
          <section className="export-section">
            <h3>Export Preview</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <label>Rows:</label>
                <span>{data.rows.length.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <label>Columns:</label>
                <span>{data.columns?.length || 0}</span>
              </div>
              <div className="stat-item">
                <label>Sheets:</label>
                <span>{includePivot ? '3' : '2'}</span>
              </div>
            </div>
          </section>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExportDisabled}
          className="btn-export"
        >
          {exporting ? (
            <>
              <div className="spinner-small"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet size={20} />
              <span>Export to Excel</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ExportPanel;

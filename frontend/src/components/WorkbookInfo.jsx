import React, { useState } from 'react';
import { Book, Sheet, Info } from 'lucide-react';
import useStore from '../store';
import apiService from '../services/apiService';
import tableauService from '../services/tableauService';
import { toast } from 'react-toastify';

const WorkbookInfo = () => {
  const { workbookInfo, selectedWorksheet, setSelectedWorksheet, setMetadata, setData, setLoading } = useStore();
  const [loadingData, setLoadingData] = useState(false);

  const handleWorksheetSelect = async (worksheet) => {
    setSelectedWorksheet(worksheet);

    try {
      setLoadingData(true);
      setLoading(true);

      // Get data from Tableau
      const data = await tableauService.getWorksheetData(worksheet.name);
      setData(data);

      toast.success(`Loaded data from ${worksheet.name}`);
    } catch (error) {
      console.error('Error loading worksheet data:', error);
      toast.error(`Failed to load worksheet data: ${error.message}`);
    } finally {
      setLoadingData(false);
      setLoading(false);
    }
  };

  if (!workbookInfo) return null;

  return (
    <div className="workbook-info card">
      <div className="card-header">
        <Book size={20} />
        <h2>Workbook Information</h2>
      </div>

      <div className="card-content">
        <div className="info-row">
          <label>Workbook:</label>
          <span>{workbookInfo.workbookName}</span>
        </div>

        <div className="info-row">
          <label>Dashboard:</label>
          <span>{workbookInfo.name}</span>
        </div>

        <div className="worksheets-section">
          <label>
            <Sheet size={16} />
            Select Worksheet:
          </label>

          <select
            value={selectedWorksheet?.name || ''}
            onChange={(e) => {
              const worksheet = workbookInfo.worksheets.find(ws => ws.name === e.target.value);
              if (worksheet) {
                handleWorksheetSelect(worksheet);
              }
            }}
            disabled={loadingData}
            className="worksheet-select"
          >
            <option value="">-- Select a worksheet --</option>
            {workbookInfo.worksheets.map(ws => (
              <option key={ws.name} value={ws.name}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        {loadingData && (
          <div className="loading-indicator">
            <div className="spinner-small"></div>
            <span>Loading worksheet data...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkbookInfo;

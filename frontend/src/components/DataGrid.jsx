import React, { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Table, Search } from 'lucide-react';
import useStore from '../store';

const DataGrid = () => {
  const { data, filteredData, setFilteredData } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const columnDefs = useMemo(() => {
    if (!data || !data.columns) return [];

    return data.columns.map(col => ({
      field: col.name,
      headerName: col.name,
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      minWidth: 100
    }));
  }, [data]);

  const rowData = useMemo(() => {
    if (!filteredData || !filteredData.rows) return [];

    if (!searchTerm) {
      return filteredData.rows;
    }

    // Simple search across all columns
    return filteredData.rows.filter(row => {
      return Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [filteredData, searchTerm]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100
  }), []);

  if (!data) {
    return (
      <div className="data-grid-container card">
        <div className="card-header">
          <Table size={20} />
          <h2>Data Preview</h2>
        </div>
        <div className="card-content empty-state">
          <Table size={48} strokeWidth={1} />
          <p>Select a worksheet to view data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-grid-container card">
      <div className="card-header">
        <div className="header-left">
          <Table size={20} />
          <h2>Data Preview</h2>
          <span className="row-count">
            {rowData.length.toLocaleString()} rows
          </span>
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card-content">
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact
            columnDefs={columnDefs}
            rowData={rowData}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={100}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            suppressDragLeaveHidesColumns={true}
          />
        </div>
      </div>
    </div>
  );
};

export default DataGrid;

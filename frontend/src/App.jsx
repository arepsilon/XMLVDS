import React, { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import tableauService from './services/tableauService';
import useStore from './store';
import Header from './components/Header';
import WorkbookInfo from './components/WorkbookInfo';
import DataGrid from './components/DataGrid';
import FormattingPanel from './components/FormattingPanel';
import ExportPanel from './components/ExportPanel';
import LoadingSpinner from './components/LoadingSpinner';
import './styles/App.css';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const { setWorkbookInfo, setError } = useStore();

  useEffect(() => {
    initializeExtension();
  }, []);

  const initializeExtension = async () => {
    try {
      setLoading(true);

      // Initialize Tableau Extension
      await tableauService.initialize();

      // Get workbook information
      const workbookInfo = await tableauService.getWorkbookInfo();
      setWorkbookInfo(workbookInfo);

      setIsInitialized(true);
      toast.success('Extension initialized successfully!');
    } catch (error) {
      console.error('Initialization error:', error);
      setError(error.message);
      toast.error(`Initialization failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app loading">
        <LoadingSpinner message="Initializing Tableau Extension..." />
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="app error">
        <div className="error-container">
          <h2>Failed to Initialize</h2>
          <p>Please ensure this extension is running within a Tableau Dashboard.</p>
          <button onClick={initializeExtension} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <Header />

      <div className="app-content">
        <div className="main-panel">
          <WorkbookInfo />
          <DataGrid />
        </div>

        <div className="side-panel">
          <FormattingPanel />
          <ExportPanel />
        </div>
      </div>
    </div>
  );
}

export default App;

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 60 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor
    this.client.interceptors.request.use(
      config => {
        console.log('API Request:', config.method.toUpperCase(), config.url);
        return config;
      },
      error => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      response => {
        console.log('API Response:', response.config.url, response.status);
        return response;
      },
      error => {
        console.error('Response error:', error.response || error);

        const message = error.response?.data?.message ||
                       error.response?.data?.error ||
                       error.message ||
                       'An error occurred';

        return Promise.reject(new Error(message));
      }
    );
  }

  // Workbook APIs

  async getWorkbookDetails(workbookId) {
    const response = await this.client.get(`/workbooks/${workbookId}`);
    return response.data.data;
  }

  async listWorkbookViews(workbookId) {
    const response = await this.client.get(`/workbooks/${workbookId}/views`);
    return response.data.data;
  }

  async downloadWorkbook(workbookId, includeExtract = false) {
    const response = await this.client.post(`/workbooks/${workbookId}/download`, {
      includeExtract
    });
    return response.data.data;
  }

  async parseWorkbook(workbookId, includeExtract = false, saveMetadata = true) {
    const response = await this.client.post(`/workbooks/${workbookId}/parse`, {
      includeExtract,
      saveMetadata
    });
    return response.data.data;
  }

  // Data APIs

  async queryData(workbookId, viewName, metadata) {
    const response = await this.client.post('/data/query', {
      workbookId,
      viewName,
      metadata
    });
    return response.data.data;
  }

  async queryDataCSV(workbookId, viewName, filters = []) {
    const response = await this.client.post('/data/query-csv', {
      workbookId,
      viewName,
      filters
    });
    return response.data.data;
  }

  async queryDataPaginated(workbookId, viewName, metadata, pageSize = 10000) {
    const response = await this.client.post('/data/query-paginated', {
      workbookId,
      viewName,
      metadata,
      pageSize
    });
    return response.data.data;
  }

  async buildQuery(metadata) {
    const response = await this.client.post('/data/build-query', {
      metadata
    });
    return response.data.data;
  }

  // Export APIs

  async exportToExcel(config) {
    const response = await this.client.post('/export/excel-info', config, {
      timeout: 120000 // 2 minutes for large exports
    });
    return response.data.data;
  }

  async downloadExcel(fileName) {
    const response = await this.client.get(`/export/download/${fileName}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async previewExport(config) {
    const response = await this.client.post('/export/preview', config);
    return response.data.data;
  }

  // Configuration APIs

  async getWorkbookConfigs() {
    const response = await this.client.get('/config/workbooks');
    return response.data.data;
  }

  async getWorkbookConfig(workbookName) {
    const response = await this.client.get(`/config/workbooks/${workbookName}`);
    return response.data.data;
  }

  async addWorkbookConfig(config) {
    const response = await this.client.post('/config/workbooks', config);
    return response.data.data;
  }

  async updateWorkbookConfig(workbookName, config) {
    const response = await this.client.put(`/config/workbooks/${workbookName}`, config);
    return response.data.data;
  }

  async deleteWorkbookConfig(workbookName) {
    const response = await this.client.delete(`/config/workbooks/${workbookName}`);
    return response.data;
  }

  async validateConfig(config) {
    const response = await this.client.post('/config/validate', config);
    return response.data.data;
  }
}

export default new ApiService();

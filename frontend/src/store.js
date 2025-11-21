import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Workbook state
  workbookInfo: null,
  selectedWorksheet: null,
  metadata: null,

  // Data state
  data: null,
  filteredData: null,
  loading: false,
  error: null,

  // Formatting state
  customHeaders: [],
  columnFormatting: {},
  conditionalRules: [],

  // Pivot state
  pivotConfig: null,

  // Export state
  exportProgress: null,

  // Actions
  setWorkbookInfo: (info) => set({ workbookInfo: info }),

  setSelectedWorksheet: (worksheet) => set({ selectedWorksheet: worksheet }),

  setMetadata: (metadata) => set({ metadata }),

  setData: (data) => set({ data, filteredData: data }),

  setFilteredData: (filteredData) => set({ filteredData }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  addCustomHeader: (header) => set((state) => ({
    customHeaders: [...state.customHeaders, header]
  })),

  removeCustomHeader: (index) => set((state) => ({
    customHeaders: state.customHeaders.filter((_, i) => i !== index)
  })),

  updateCustomHeader: (index, header) => set((state) => ({
    customHeaders: state.customHeaders.map((h, i) => i === index ? header : h)
  })),

  setColumnFormatting: (column, formatting) => set((state) => ({
    columnFormatting: {
      ...state.columnFormatting,
      [column]: formatting
    }
  })),

  removeColumnFormatting: (column) => set((state) => {
    const newFormatting = { ...state.columnFormatting };
    delete newFormatting[column];
    return { columnFormatting: newFormatting };
  }),

  addConditionalRule: (rule) => set((state) => ({
    conditionalRules: [...state.conditionalRules, rule]
  })),

  removeConditionalRule: (index) => set((state) => ({
    conditionalRules: state.conditionalRules.filter((_, i) => i !== index)
  })),

  updateConditionalRule: (index, rule) => set((state) => ({
    conditionalRules: state.conditionalRules.map((r, i) => i === index ? rule : r)
  })),

  setPivotConfig: (config) => set({ pivotConfig: config }),

  clearPivotConfig: () => set({ pivotConfig: null }),

  setExportProgress: (progress) => set({ exportProgress: progress }),

  reset: () => set({
    data: null,
    filteredData: null,
    loading: false,
    error: null,
    customHeaders: [],
    columnFormatting: {},
    conditionalRules: [],
    pivotConfig: null,
    exportProgress: null
  }),

  // Computed getters
  getFormattingConfig: () => {
    const state = get();
    return {
      customHeaders: state.customHeaders,
      columns: state.columnFormatting,
      conditionalRules: state.conditionalRules
    };
  },

  getExportConfig: () => {
    const state = get();
    return {
      worksheetName: state.selectedWorksheet?.name || 'Sheet1',
      workbookName: state.workbookInfo?.workbookName || 'Workbook',
      data: state.filteredData || state.data,
      metadata: state.metadata,
      formatting: state.getFormattingConfig(),
      pivotConfig: state.pivotConfig
    };
  }
}));

export default useStore;

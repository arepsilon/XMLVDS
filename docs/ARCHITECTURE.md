# Architecture Overview

## System Architecture

The XMLVDS (Tableau Dashboard Extension) is a full-stack application designed to extract worksheet configurations from Tableau workbooks, retrieve data via VizQL Data Service, and generate formatted Excel files.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Tableau Dashboard                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Tableau Extension (React Frontend)         │     │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │     │
│  │  │ Data Grid│  │ Formatting │  │ Export Panel │  │     │
│  │  └──────────┘  └────────────┘  └──────────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                   HTTPS (REST API)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Backend Server                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │                  API Layer (Express)                │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │                  Service Layer                      │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │ Tableau Auth │  │   Workbook   │               │     │
│  │  │   Service    │  │   Download   │               │     │
│  │  └──────────────┘  └──────────────┘               │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │ XML Parser   │  │    VizQL     │               │     │
│  │  │   Service    │  │   Service    │               │     │
│  │  └──────────────┘  └──────────────┘               │     │
│  │  ┌──────────────────────────────────┐             │     │
│  │  │      Excel Export Service         │             │     │
│  │  └──────────────────────────────────┘             │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                   Tableau REST API / VizQL
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tableau Server                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Workbooks   │  │ Data Sources │  │    Views     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (React)

#### Component Tree

```
App
├── Header
├── WorkbookInfo
│   └── WorksheetSelector
├── DataGrid (AG Grid)
│   ├── ColumnHeaders
│   ├── DataRows
│   └── Pagination
├── FormattingPanel
│   ├── CustomHeaders
│   ├── ColumnFormatting
│   └── ConditionalRules
└── ExportPanel
    ├── PivotConfiguration
    └── ExportButton
```

#### State Management (Zustand)

```javascript
Store
├── workbookInfo
├── selectedWorksheet
├── metadata
├── data
├── filteredData
├── customHeaders
├── columnFormatting
├── conditionalRules
├── pivotConfig
└── actions
    ├── setData()
    ├── addCustomHeader()
    ├── setColumnFormatting()
    └── exportToExcel()
```

#### Services

- **TableauService**: Interfaces with Tableau Extensions API
  - Initialize extension
  - Get workbook/worksheet information
  - Retrieve data from worksheets
  - Handle Tableau events

- **ApiService**: Communicates with backend
  - HTTP client (Axios)
  - Request/response interceptors
  - Error handling

### Backend (Node.js + Express)

#### API Routes

```
/api
├── /workbooks
│   ├── GET    /:workbookId
│   ├── GET    /:workbookId/views
│   ├── POST   /:workbookId/download
│   └── POST   /:workbookId/parse
├── /data
│   ├── POST   /query
│   ├── POST   /query-csv
│   ├── POST   /query-paginated
│   └── POST   /build-query
├── /export
│   ├── POST   /excel
│   ├── POST   /excel-info
│   ├── GET    /download/:fileName
│   └── POST   /preview
└── /config
    ├── GET    /workbooks
    ├── GET    /workbooks/:name
    ├── POST   /workbooks
    ├── PUT    /workbooks/:name
    └── DELETE /workbooks/:name
```

#### Service Layer

1. **TableauAuthService**
   - Singleton pattern
   - Manages PAT authentication
   - Token caching and refresh
   - Authenticated HTTP client

2. **WorkbookDownloadService**
   - Download workbooks via REST API
   - Extract TWBX archives
   - Temporary file management
   - Cleanup operations

3. **XMLParserService**
   - Parse TWB XML files
   - Extract worksheet metadata
   - Generate JSON structures
   - Handle complex hierarchies

4. **VizQLService**
   - Build VizQL queries
   - Execute queries via REST API
   - Handle pagination
   - CSV data parsing

5. **ExcelExportService**
   - Generate Excel workbooks
   - Apply formatting
   - Create pivot tables
   - Multi-sheet management

## Data Flow

### 1. Extension Initialization

```
User opens Dashboard
    ↓
Extension loads in iframe
    ↓
Tableau Extensions API initialized
    ↓
Get workbook/worksheet information
    ↓
Display in UI
```

### 2. Data Retrieval

```
User selects worksheet
    ↓
Frontend calls Tableau Extensions API
    ↓
Get worksheet summary data
    ↓
Transform to standard format
    ↓
Display in DataGrid
```

### 3. Workbook Parsing (Optional)

```
User requests full metadata
    ↓
Frontend → Backend: POST /workbooks/:id/parse
    ↓
Backend authenticates with Tableau Server
    ↓
Download workbook (.twbx/.twb)
    ↓
Extract and parse XML
    ↓
Extract comprehensive metadata
    ↓
Return JSON to frontend
```

### 4. Excel Export

```
User configures formatting
    ↓
User clicks Export
    ↓
Frontend → Backend: POST /export/excel
    ↓
Backend generates Excel:
  - Create workbook
  - Add data sheet
  - Apply formatting
  - Create pivot table (if configured)
  - Add summary sheet
    ↓
Return download URL
    ↓
Frontend downloads file
    ↓
Browser saves Excel file
```

## Security Architecture

### Authentication

```
Backend ← PAT → Tableau Server
   ↓
Cached token (4 hours)
   ↓
Auto-refresh on expiry
```

### Communication

```
Frontend (HTTPS) ← → Backend (HTTP/HTTPS) ← → Tableau Server (HTTPS)
```

### Security Measures

- HTTPS required for Tableau Extensions
- PAT stored in environment variables
- Rate limiting on API endpoints
- CORS configuration
- Input validation
- XML parsing protection (XXE prevention)
- Temporary file cleanup
- Session management

## Performance Considerations

### Frontend

- Virtual scrolling in data grid (AG Grid)
- Pagination for large datasets
- Debounced search/filter
- Lazy loading of components
- Optimized re-renders (React.memo)

### Backend

- Token caching (avoid repeated auth)
- Temporary file cleanup (scheduled job)
- Streaming for large files
- Pagination support
- Connection pooling
- Memory limits

### Data Transfer

- Compression (gzip)
- Chunked transfer encoding
- Binary response for Excel files
- Request timeout limits

## Scalability

### Horizontal Scaling

```
Load Balancer
    ├── Backend Instance 1
    ├── Backend Instance 2
    └── Backend Instance 3
```

Considerations:
- Stateless backend design
- Shared configuration storage
- Session affinity not required
- Temporary file coordination

### Vertical Scaling

- Increase Node.js memory limit
- Worker threads for heavy processing
- Clustering mode

## Technology Stack Summary

### Frontend
- React 18
- Vite (build tool)
- Zustand (state management)
- AG Grid (data grid)
- Axios (HTTP client)
- Tableau Extensions API
- Lucide React (icons)

### Backend
- Node.js 18+
- Express.js (web framework)
- ExcelJS (Excel generation)
- fast-xml-parser (XML parsing)
- Axios (HTTP client)
- Winston (logging)
- AdmZip (archive handling)

### Development
- Docker & Docker Compose
- ESLint (code quality)
- Nodemon (development)
- PM2 (production process manager)

## File Structure

```
XMLVDS/
├── backend/
│   ├── config/          # Configuration files
│   ├── logs/            # Application logs
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Express middleware
│   │   └── utils/       # Utilities
│   ├── temp-workbooks/  # Downloaded workbooks
│   ├── temp-exports/    # Generated Excel files
│   └── server.js        # Entry point
├── frontend/
│   ├── public/          # Static files
│   │   └── manifest.trex # Extension manifest
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API/Tableau services
│   │   ├── hooks/       # Custom hooks
│   │   ├── styles/      # CSS files
│   │   └── store.js     # State management
│   └── vite.config.js   # Build configuration
├── docs/               # Documentation
└── docker-compose.yml  # Container orchestration
```

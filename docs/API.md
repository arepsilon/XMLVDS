# API Documentation

Complete API reference for the XMLVDS backend server.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Currently, the API uses Tableau Server PAT authentication configured in environment variables. Future versions may implement user-level authentication.

## Workbook Endpoints

### Get Workbook Details

Retrieve metadata about a specific workbook.

```http
GET /api/workbooks/:workbookId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "Sales Dashboard",
    "description": "Q4 Sales Analysis",
    "contentUrl": "SalesDashboard",
    "webpageUrl": "https://server/site/workbooks/123",
    "showTabs": true,
    "size": 1024000,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z",
    "project": { "id": "proj123", "name": "Sales" },
    "owner": { "id": "user123", "name": "John Doe" },
    "tags": ["sales", "q4"]
  }
}
```

### List Workbook Views

Get all views (worksheets) in a workbook.

```http
GET /api/workbooks/:workbookId/views
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "view123",
      "name": "Sales by Region",
      "contentUrl": "SalesbyRegion",
      "viewUrlName": "sales-by-region",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Download Workbook

Download a workbook file from Tableau Server.

```http
POST /api/workbooks/:workbookId/download
```

**Request Body:**

```json
{
  "includeExtract": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "workbookId": "abc123",
    "fileName": "workbook_abc123_uuid.twbx",
    "filePath": "/temp-workbooks/workbook_abc123_uuid.twbx",
    "size": 1024000,
    "extension": ".twbx",
    "downloadedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Parse Workbook

Download and parse workbook to extract metadata.

```http
POST /api/workbooks/:workbookId/parse
```

**Request Body:**

```json
{
  "includeExtract": false,
  "saveMetadata": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "workbookName": "Sales Dashboard",
    "worksheetCount": 3,
    "worksheets": [
      {
        "worksheetName": "Sales by Region",
        "worksheetId": "sales-by-region",
        "structure": {
          "rows": [...],
          "columns": [...],
          "values": [...],
          "filters": [...],
          "conditionalFormatting": [...],
          "calculatedFields": [...],
          "sorting": [...]
        },
        "dataSource": {
          "name": "Sample - Superstore",
          "caption": "Sample - Superstore"
        }
      }
    ],
    "metadataPath": "/temp-workbooks/Sales_Dashboard_metadata.json"
  }
}
```

## Data Endpoints

### Query Data

Execute a VizQL query based on worksheet metadata.

```http
POST /api/data/query
```

**Request Body:**

```json
{
  "workbookId": "abc123",
  "viewName": "Sales by Region",
  "metadata": {
    "worksheetName": "Sales by Region",
    "structure": { ... }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "columns": [
      { "name": "Region", "originalName": "[Region]", "type": "dimension" },
      { "name": "Sales", "originalName": "SUM([Sales])", "type": "measure" }
    ],
    "rows": [
      { "Region": "East", "Sales": 45000 },
      { "Region": "West", "Sales": 52000 }
    ],
    "metadata": {
      "rowCount": 2,
      "columnCount": 2
    }
  }
}
```

### Query Data via CSV

Query data using Tableau's CSV export endpoint.

```http
POST /api/data/query-csv
```

**Request Body:**

```json
{
  "workbookId": "abc123",
  "viewName": "Sales by Region",
  "filters": [
    {
      "field": "Category",
      "values": ["Technology", "Furniture"]
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "columns": [...],
    "rows": [...],
    "metadata": { "rowCount": 150, "columnCount": 5 }
  }
}
```

### Query Data with Pagination

Execute a paginated query for large datasets.

```http
POST /api/data/query-paginated
```

**Request Body:**

```json
{
  "workbookId": "abc123",
  "viewName": "Sales by Region",
  "metadata": { ... },
  "pageSize": 10000
}
```

**Response:**

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "totalRows": 50000,
    "pageSize": 10000
  }
}
```

### Build Query

Build a VizQL query from metadata without executing.

```http
POST /api/data/build-query
```

**Request Body:**

```json
{
  "metadata": {
    "worksheetName": "Sales by Region",
    "structure": { ... }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "worksheetName": "Sales by Region",
    "fieldMap": {
      "dimensions": ["[Region]", "DATEPART('year', [Order Date])"],
      "measures": ["SUM([Sales])"]
    },
    "filters": [...],
    "sort": [...],
    "options": { "includeNulls": false, "maxRows": 100000 }
  }
}
```

## Export Endpoints

### Export to Excel

Generate an Excel file from data.

```http
POST /api/export/excel-info
```

**Request Body:**

```json
{
  "worksheetName": "Sales by Region",
  "workbookName": "Sales Dashboard",
  "data": {
    "columns": [...],
    "rows": [...]
  },
  "metadata": { ... },
  "formatting": {
    "customHeaders": [
      {
        "text": "Q4 2024 Sales Report",
        "mergeColumns": 5,
        "formatting": { "bold": true, "fontSize": 16 }
      }
    ],
    "columns": {
      "Sales": {
        "numberFormat": "$#,##0.00",
        "alignment": { "horizontal": "right" }
      }
    },
    "conditionalRules": [...]
  },
  "pivotConfig": {
    "rowFields": ["Region"],
    "columnFields": [],
    "valueFields": [
      { "field": "Sales", "name": "Sales", "aggregation": "SUM" }
    ],
    "showGrandTotals": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fileName": "Sales_Dashboard_Sales_by_Region_2024-01-15.xlsx",
    "filePath": "/temp-exports/...",
    "size": 50000,
    "sheetCount": 3,
    "rowCount": 150,
    "generatedAt": "2024-01-15T10:00:00Z"
  },
  "downloadUrl": "/api/export/download/Sales_Dashboard_Sales_by_Region_2024-01-15.xlsx"
}
```

### Download Excel File

Download a previously generated Excel file.

```http
GET /api/export/download/:fileName
```

**Response:**

Binary Excel file download.

### Preview Export

Preview the structure of an Excel export without generating the file.

```http
POST /api/export/preview
```

**Request Body:**

```json
{
  "data": { ... },
  "formatting": { ... },
  "pivotConfig": { ... }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "dataSheet": {
      "headerRows": 2,
      "dataRows": 150,
      "totalRows": 153,
      "columns": 5
    },
    "pivotSheet": {
      "rowFields": 1,
      "columnFields": 0,
      "valueFields": 2,
      "hasPivot": true
    },
    "summarySheet": { "exists": true },
    "estimatedSize": "50.00 KB",
    "warnings": []
  }
}
```

## Configuration Endpoints

### Get All Workbook Configurations

```http
GET /api/config/workbooks
```

**Response:**

```json
{
  "success": true,
  "data": {
    "workbooks": [...],
    "lastUpdated": "2024-01-15T10:00:00Z",
    "version": "1.0.0"
  }
}
```

### Get Workbook Configuration

```http
GET /api/config/workbooks/:workbookName
```

**Response:**

```json
{
  "success": true,
  "data": {
    "workbookName": "Sales Dashboard",
    "workbookId": "abc123",
    "datasourceId": "ds123",
    "serverUrl": "https://server.com",
    "siteId": "site123",
    "description": "Q4 Sales",
    "enabled": true
  }
}
```

### Add Workbook Configuration

```http
POST /api/config/workbooks
```

**Request Body:**

```json
{
  "workbookName": "Sales Dashboard",
  "workbookId": "abc123",
  "datasourceId": "ds123",
  "serverUrl": "https://server.com",
  "siteId": "site123",
  "description": "Q4 Sales",
  "enabled": true
}
```

### Update Workbook Configuration

```http
PUT /api/config/workbooks/:workbookName
```

**Request Body:**

```json
{
  "description": "Updated description",
  "enabled": false
}
```

### Delete Workbook Configuration

```http
DELETE /api/config/workbooks/:workbookName
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Common Error Codes

- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (authentication failed)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `408` - Request Timeout (query took too long)
- `422` - Unprocessable Entity (XML parsing failed)
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- Window: 15 minutes
- Max Requests: 100 per IP address

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

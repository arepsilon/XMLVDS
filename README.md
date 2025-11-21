# Tableau Dashboard Extension - XMLVDS

A comprehensive Tableau Dashboard Extension that automatically extracts worksheet configurations from Tableau workbooks, retrieves data via VizQL Data Service, and generates formatted Excel files with pivot table structures.

## Architecture

### Technology Stack
- **Frontend**: React.js with Tableau Extensions API
- **Backend**: Node.js with Express.js
- **Tableau Integration**:
  - Tableau REST API (for workbook download)
  - VizQL Data Service API (for data retrieval)
  - Tableau Extensions API (for dashboard integration)
- **Authentication**: Personal Access Token (PAT)
- **Data Processing**: XML parsing, JSON transformation
- **Export Library**: ExcelJS for Excel generation

## Project Structure

```
XMLVDS/
├── frontend/           # React-based Tableau Extension
├── backend/           # Node.js backend server
├── docs/              # Documentation
├── docker-compose.yml # Docker orchestration
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Tableau Server with REST API access
- Personal Access Token (PAT) for Tableau Server

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd XMLVDS
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Configure environment variables:
```bash
cp backend/.env.example backend/.env
# Edit .env with your Tableau Server credentials
```

### Running the Application

#### Development Mode

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

#### Production Mode with Docker

```bash
docker-compose up -d
```

## Features

### Phase 1: Configuration & Workbook Identification
- Centralized workbook mapping configuration
- Automatic workbook detection using Tableau Extensions API
- Support for multiple workbook entries

### Phase 2: Tableau Server Authentication & Download
- PAT-based authentication for Tableau Server REST API
- Workbook download (.twbx and .twb)
- Secure credential management

### Phase 3: XML Extraction & Parsing
- Comprehensive worksheet metadata extraction
- Support for rows, columns, values, filters, conditional formatting
- Calculated fields and sorting configuration
- JSON structure generation

### Phase 4: VizQL Data Service Integration
- Programmatic VizQL query construction
- Filter and sorting translation
- Pagination for large datasets
- Response transformation

### Phase 5: Frontend Data Display & Modifications
- Interactive data grid with editing capabilities
- Header row management
- Formatting options (cell, column, row level)
- Conditional formatting editor
- Pivot configuration interface

### Phase 6: Excel Export with Pivot Tables
- Native Excel pivot table generation
- Multi-sheet workbooks (data, pivot, summary)
- Comprehensive formatting application
- Download mechanism with progress tracking

## API Documentation

See [API Documentation](./docs/API.md) for detailed API endpoints and usage.

## Development Phases

- **Phase 1**: Configuration & Authentication (Weeks 1-2)
- **Phase 2**: Workbook Download & XML Parsing (Weeks 3-4)
- **Phase 3**: VizQL Integration (Weeks 5-6)
- **Phase 4**: Frontend Development (Weeks 7-9)
- **Phase 5**: Excel Export (Weeks 10-12)
- **Phase 6**: Testing & Optimization (Weeks 13-14)

## Security Considerations

- Secure PAT credential storage (environment variables)
- Input validation for all user inputs
- Sanitized XML parsing to prevent XXE attacks
- Rate limiting on API calls
- HTTPS for all communications
- CORS configuration

## Performance Requirements

- Workbook download: < 30 seconds
- XML parsing: < 5 seconds
- VizQL query execution: < 10 seconds (up to 50K rows)
- Frontend rendering: Support up to 100K rows
- Excel generation: < 15 seconds (up to 10K rows)

## License

MIT

## Contributors

[Your Team]

## Support

For issues and questions, please open an issue in the GitHub repository.

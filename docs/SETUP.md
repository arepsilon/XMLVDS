# Setup Guide

This guide will help you set up the Tableau Dashboard Extension (XMLVDS) project on your local development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Git**
- **Tableau Desktop** or **Tableau Server** (for testing the extension)
- **Personal Access Token (PAT)** for Tableau Server

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd XMLVDS
```

## Step 2: Backend Setup

### Install Dependencies

```bash
cd backend
npm install
```

### Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` and configure the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
HOST=localhost

# Tableau Server Configuration
TABLEAU_SERVER_URL=https://your-tableau-server.com
TABLEAU_API_VERSION=3.22
TABLEAU_SITE_ID=your-site-id

# Tableau Authentication
TABLEAU_PAT_NAME=your-pat-name
TABLEAU_PAT_SECRET=your-pat-secret
TABLEAU_USERNAME=your-username

# Security
JWT_SECRET=generate-a-random-secret-key
SESSION_SECRET=generate-a-random-secret-key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,https://localhost:8443
```

### Create Required Directories

```bash
mkdir -p logs temp-workbooks temp-exports
```

### Start the Backend Server

```bash
npm run dev
```

The backend server should now be running on `http://localhost:3001`.

## Step 3: Frontend Setup

### Install Dependencies

```bash
cd ../frontend
npm install
```

### Generate SSL Certificates

Tableau Extensions require HTTPS. Generate self-signed certificates for local development:

```bash
mkdir -p cert
cd cert

# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate
openssl req -new -x509 -key key.pem -out cert.pem -days 365

# Answer the prompts (you can use default values for local development)
```

For production, use proper SSL certificates from a Certificate Authority.

### Configure API URL

Create a `.env` file in the frontend directory:

```bash
cd ..
touch .env
```

Add the following:

```env
VITE_API_URL=http://localhost:3001/api
```

### Start the Frontend Development Server

```bash
npm run dev
```

The frontend should now be running on `https://localhost:8443`.

## Step 4: Configure Tableau Extension

### Update Manifest File

Edit `frontend/public/manifest.trex` and update the `<url>` to match your development URL:

```xml
<source-location>
  <url>https://localhost:8443/</url>
</source-location>
```

### Add Extension to Tableau

1. Open Tableau Desktop or connect to Tableau Server
2. Create a new dashboard or open an existing one
3. Drag an "Extension" object onto the dashboard
4. Click "Access Local Extensions"
5. Browse to `frontend/public/manifest.trex` and select it
6. The extension should load in the dashboard

## Step 5: Configure Workbook Mappings

### Add Your Workbook Configuration

Edit `backend/config/workbooks.json`:

```json
{
  "workbooks": [
    {
      "workbookName": "Your Workbook Name",
      "workbookId": "your-workbook-id",
      "datasourceId": "your-datasource-id",
      "serverUrl": "https://your-tableau-server.com",
      "siteId": "your-site-id",
      "description": "Description of your workbook",
      "enabled": true
    }
  ]
}
```

To find your workbook ID:
1. Open the workbook in Tableau Server
2. Check the URL: `https://server/site/workbooks/<workbook-id>`

## Step 6: Test the Application

1. Open a Tableau dashboard with the extension loaded
2. Select a worksheet from the dropdown
3. The extension should load data from the worksheet
4. Configure formatting options as needed
5. Click "Export to Excel" to generate an Excel file

## Troubleshooting

### Extension Not Loading

- **Certificate Issues**: Ensure your browser trusts the self-signed certificate
  - Chrome: Type `thisisunsafe` when you see the security warning
  - Firefox: Add an exception for the certificate

- **CORS Errors**: Check that the backend's `CORS_ORIGIN` includes your frontend URL

### Authentication Errors

- Verify your PAT credentials are correct
- Ensure the PAT has appropriate permissions on Tableau Server
- Check that the site ID matches your Tableau site

### Backend Connection Issues

- Ensure the backend server is running
- Check that the `VITE_API_URL` in frontend `.env` matches the backend URL
- Verify firewall settings allow connections to port 3001

### Data Not Loading

- Check browser console for errors
- Verify the worksheet name matches exactly (case-sensitive)
- Ensure the user has permissions to access the worksheet data

## Next Steps

- Review the [API Documentation](./API.md) for detailed API endpoints
- Check [Development Guide](./DEVELOPMENT.md) for development best practices
- See [Deployment Guide](./DEPLOYMENT.md) for production deployment instructions

## Support

For issues and questions:
- Check the troubleshooting section above
- Review application logs in `backend/logs/`
- Open an issue in the GitHub repository

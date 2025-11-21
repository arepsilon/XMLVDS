# Frontend Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed

## Installation

1. Install dependencies:
```bash
npm install
```

## SSL Certificate Setup (Required for Tableau Extensions)

Tableau Extensions **require HTTPS**. Generate self-signed certificates for local development:

### On Windows (using Git Bash or WSL):
```bash
mkdir cert
openssl genrsa -out cert/key.pem 2048
openssl req -new -x509 -key cert/key.pem -out cert/cert.pem -days 365
```

### On Windows (using PowerShell without OpenSSL):
If you don't have OpenSSL installed, you can use PowerShell:

```powershell
# Create cert directory
New-Item -ItemType Directory -Force -Path cert

# Generate certificate (requires PowerShell 5.1+)
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1)

# Export certificate
$certPath = "cert:\CurrentUser\My\$($cert.Thumbprint)"
Export-Certificate -Cert $certPath -FilePath "cert\cert.pem" -Type CERT
$mypwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert $certPath -FilePath "cert\cert.pfx" -Password $mypwd

# Convert to PEM format (you may need to install OpenSSL or use online converter)
# Alternatively, just use Git Bash which comes with Git for Windows
```

**Easiest Option on Windows:** Install [Git for Windows](https://git-scm.com/download/win) which includes OpenSSL, then use Git Bash to run the commands.

### On macOS/Linux:
```bash
mkdir cert
openssl genrsa -out cert/key.pem 2048
openssl req -new -x509 -key cert/key.pem -out cert/cert.pem -days 365
```

When prompted for certificate information, you can press Enter to use defaults for local development.

## Environment Configuration

Create a `.env` file in the frontend directory:

```bash
# Copy from example (if exists)
# Or create new file with:
echo "VITE_API_URL=http://localhost:3001/api" > .env
```

Edit `.env` if needed:
```env
VITE_API_URL=http://localhost:3001/api
```

## Running the Application

### Development Mode

```bash
npm start
# or
npm run dev
```

The application will start on:
- **With HTTPS**: `https://localhost:8443`
- **Without HTTPS** (if certificates missing): `http://localhost:3000`

⚠️ **Important**: Tableau Extensions require HTTPS, so you must generate certificates to test with Tableau.

### Trust the Self-Signed Certificate

When you first visit `https://localhost:8443`, your browser will warn about the self-signed certificate:

**Chrome/Edge:**
- Click "Advanced"
- Click "Proceed to localhost (unsafe)"
- Or type: `thisisunsafe` anywhere on the warning page

**Firefox:**
- Click "Advanced"
- Click "Accept the Risk and Continue"

## Loading Extension in Tableau

1. Open Tableau Desktop or Tableau Server
2. Create a new dashboard or open an existing one
3. From the left sidebar, drag an **Extension** object onto the dashboard
4. Click **"Access Local Extensions"** (or "My Extensions" for already added)
5. Browse to `frontend/public/manifest.trex`
6. Click **Open**

The extension should now load in your Tableau dashboard!

## Common Issues

### "npm start" not found
- Run `npm install` first
- Use `npm run dev` instead

### SSL Certificate Errors
- Make sure certificates are in the `cert/` directory
- Check that files are named `key.pem` and `cert.pem`
- Restart the dev server after adding certificates

### Extension Won't Load in Tableau
- Ensure you're using HTTPS (certificates must be generated)
- Check that the URL in `manifest.trex` matches your dev server
- Verify the backend is running on port 3001
- Check browser console for errors

### CORS Errors
- Ensure backend `.env` has `CORS_ORIGIN=http://localhost:3000,https://localhost:8443`
- Restart the backend server after changing environment variables

### Port Already in Use
- Change the port in `vite.config.js` if 8443 is taken
- Update the manifest.trex with the new port

## Available Scripts

- `npm start` - Start development server with HTTPS
- `npm run dev` - Same as start
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically

## Project Structure

```
frontend/
├── cert/                 # SSL certificates (git-ignored)
├── public/
│   ├── index.html       # HTML template
│   └── manifest.trex    # Tableau Extension manifest
├── src/
│   ├── components/      # React components
│   ├── services/        # API and Tableau services
│   ├── styles/          # CSS files
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── store.js         # State management
├── .env                 # Environment variables (git-ignored)
├── package.json         # Dependencies and scripts
└── vite.config.js       # Vite configuration
```

## Next Steps

1. ✅ Generate SSL certificates
2. ✅ Install dependencies
3. ✅ Start the development server
4. ✅ Ensure backend is running on port 3001
5. ✅ Load the extension in Tableau
6. 🎉 Start developing!

## Need Help?

- Check the main [README.md](../README.md) for project overview
- See [docs/SETUP.md](../docs/SETUP.md) for detailed setup
- Review [docs/API.md](../docs/API.md) for API documentation
- Check browser console for errors
- Review backend logs for server-side issues

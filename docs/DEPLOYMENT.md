# Deployment Guide

This guide covers deploying the XMLVDS application to production environments.

## Prerequisites

- Docker and Docker Compose installed
- SSL certificates for your domain
- Access to a server or cloud platform
- Tableau Server with REST API access

## Deployment Options

### Option 1: Docker Compose (Recommended)

#### 1. Prepare SSL Certificates

Place your SSL certificates in the appropriate directories:

```bash
# Backend certificates (if needed)
mkdir -p backend/cert
cp /path/to/your/cert.pem backend/cert/
cp /path/to/your/key.pem backend/cert/

# Frontend certificates
mkdir -p frontend/cert
cp /path/to/your/cert.pem frontend/cert/
cp /path/to/your/key.pem frontend/cert/
```

#### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Tableau Server Configuration
TABLEAU_SERVER_URL=https://your-tableau-server.com
TABLEAU_PAT_NAME=your-production-pat-name
TABLEAU_PAT_SECRET=your-production-pat-secret
TABLEAU_SITE_ID=your-site-id

# Security
JWT_SECRET=generate-strong-random-secret
SESSION_SECRET=generate-strong-random-secret

# Production settings
NODE_ENV=production
```

#### 3. Build and Deploy

```bash
# Build and start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

#### 4. Update Tableau Extension Manifest

Update `frontend/public/manifest.trex` with your production URL:

```xml
<source-location>
  <url>https://your-domain.com/</url>
</source-location>
```

#### 5. Access the Application

- Frontend: `https://your-domain.com`
- Backend API: `https://your-domain.com/api`

### Option 2: Manual Deployment

#### Backend Deployment

1. **Install Dependencies**

```bash
cd backend
npm ci --only=production
```

2. **Configure Environment**

```bash
cp .env.example .env
# Edit .env with production values
```

3. **Set Up Process Manager (PM2)**

```bash
npm install -g pm2

# Start application
pm2 start src/server.js --name tableau-extension-backend

# Save PM2 configuration
pm2 save

# Set up auto-restart on system reboot
pm2 startup
```

4. **Configure Reverse Proxy (Nginx)**

```nginx
server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Frontend Deployment

1. **Build Production Bundle**

```bash
cd frontend
npm ci
npm run build
```

2. **Configure Web Server (Nginx)**

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api.your-domain.com;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

3. **Deploy Files**

```bash
# Copy built files to web server
rsync -avz dist/ user@server:/var/www/tableau-extension/
```

### Option 3: Cloud Platform Deployment

#### AWS Deployment

1. **Backend (Elastic Beanstalk)**

```bash
# Initialize EB CLI
cd backend
eb init

# Create environment
eb create production

# Deploy
eb deploy
```

2. **Frontend (S3 + CloudFront)**

```bash
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name/

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

#### Azure Deployment

1. **Backend (App Service)**

```bash
cd backend

# Create App Service
az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name tableau-extension-api

# Deploy
az webapp deployment source config-local-git --name tableau-extension-api --resource-group myResourceGroup
git push azure main
```

2. **Frontend (Static Web Apps)**

```bash
cd frontend
npm run build

# Deploy using Azure CLI
az staticwebapp create --name tableau-extension --resource-group myResourceGroup --source dist/ --location "East US 2"
```

#### Google Cloud Platform

1. **Backend (Cloud Run)**

```bash
cd backend

# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/tableau-extension-backend

# Deploy
gcloud run deploy tableau-extension-backend --image gcr.io/PROJECT_ID/tableau-extension-backend --platform managed
```

2. **Frontend (Firebase Hosting)**

```bash
cd frontend
npm run build

# Initialize Firebase
firebase init hosting

# Deploy
firebase deploy --only hosting
```

## Production Checklist

### Security

- [ ] Use strong, randomly generated secrets for JWT and sessions
- [ ] Enable HTTPS for all communications
- [ ] Use valid SSL certificates (not self-signed)
- [ ] Configure CORS to only allow trusted origins
- [ ] Implement rate limiting on all API endpoints
- [ ] Regularly rotate PAT credentials
- [ ] Enable firewall rules to restrict access
- [ ] Implement logging and monitoring
- [ ] Regular security audits

### Performance

- [ ] Enable compression (gzip)
- [ ] Configure caching headers
- [ ] Use CDN for static assets
- [ ] Optimize database queries
- [ ] Set up connection pooling
- [ ] Monitor memory usage
- [ ] Configure auto-scaling if needed
- [ ] Implement request timeout limits

### Monitoring

- [ ] Set up application logging
- [ ] Configure error tracking (e.g., Sentry)
- [ ] Implement health check endpoints
- [ ] Monitor API response times
- [ ] Track usage metrics
- [ ] Set up alerts for errors and downtime
- [ ] Regular backup of configuration files

### Maintenance

- [ ] Document deployment process
- [ ] Create rollback procedures
- [ ] Schedule regular updates
- [ ] Monitor dependencies for vulnerabilities
- [ ] Test disaster recovery procedures
- [ ] Maintain changelog
- [ ] Document known issues

## Updating the Application

### Backend Updates

```bash
# Pull latest changes
git pull origin main

# Install dependencies
cd backend
npm ci --only=production

# Restart application
pm2 restart tableau-extension-backend

# Or with Docker
docker-compose build backend
docker-compose up -d backend
```

### Frontend Updates

```bash
# Pull latest changes
git pull origin main

# Build new version
cd frontend
npm ci
npm run build

# Deploy (depends on hosting method)
# Example for static hosting:
rsync -avz dist/ user@server:/var/www/tableau-extension/

# Or with Docker
docker-compose build frontend
docker-compose up -d frontend
```

## Troubleshooting Production Issues

### Application Won't Start

1. Check logs: `docker-compose logs` or `pm2 logs`
2. Verify environment variables are set correctly
3. Ensure all required directories exist
4. Check file permissions

### High Memory Usage

1. Monitor with: `docker stats` or `pm2 monit`
2. Check for memory leaks in logs
3. Adjust Node.js memory limits if needed
4. Consider scaling horizontally

### Slow Performance

1. Check API response times
2. Monitor database query performance
3. Review application logs for errors
4. Check network latency to Tableau Server
5. Consider caching frequently accessed data

### Authentication Failures

1. Verify PAT credentials are valid
2. Check PAT permissions on Tableau Server
3. Ensure correct site ID is configured
4. Check network connectivity to Tableau Server

## Rollback Procedures

### Quick Rollback

```bash
# Docker Compose
docker-compose down
git checkout <previous-commit>
docker-compose up -d

# PM2
pm2 stop tableau-extension-backend
git checkout <previous-commit>
cd backend && npm ci --only=production
pm2 restart tableau-extension-backend
```

### Database Rollback

```bash
# Restore configuration from backup
cp backend/config/workbooks.json.backup backend/config/workbooks.json
```

## Support and Maintenance

For production support:
- Monitor application logs regularly
- Set up automated alerts
- Maintain documentation of configuration changes
- Keep dependencies up to date
- Regular security patches

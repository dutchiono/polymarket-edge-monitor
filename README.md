# Polymarket Edge Monitor

Real-time Polymarket market monitoring system that detects pricing inefficiencies and edge opportunities. Updates Google Sheets every 10 seconds with live market data and serves a web dashboard.

## Features

- **Live Market Monitoring**: Polls Polymarket API every 10 seconds for real-time data
- **Edge Detection Algorithms**: Identifies mispriced markets through outlier detection, extreme pricing, and catalyst analysis
- **Google Sheets Integration**: Auto-updates spreadsheet with top 100 edge opportunities
- **Web Dashboard**: Live interface at edge.bushleague.xyz showing current edges
- **Automated Alerts**: Price change tracking and conditional formatting

## Tech Stack

- Node.js + Express
- Gamma API (Polymarket)
- Google Sheets API
- PM2 process manager
- GitHub Actions for deployment

## Deployment

Automated deployment to edge.bushleague.xyz via GitHub Actions. Push to `main` branch triggers automatic deployment.

### Required GitHub Secrets

Configure these in your repository settings:

- `SERVER_HOST` - Your server IP/hostname
- `SERVER_USER` - SSH username
- `SSH_PRIVATE_KEY` - SSH private key for authentication
- `GAMMA_API_KEY` - Polymarket Gamma API key
- `GOOGLE_SHEETS_SHEET_ID` - Target Google Sheet ID
- `GOOGLE_SHEETS_CREDENTIALS` - Service account JSON credentials (as string)

### Environment Variables

Create `.env` file on server:

```
GAMMA_API_KEY=your_gamma_api_key
GOOGLE_SHEETS_SHEET_ID=your_sheet_id
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account",...}'
PORT=3000
```

## Usage

The system runs continuously via PM2:
- Backend polls Polymarket every 10 seconds
- Calculates edge scores for all active markets
- Updates Google Sheet with top 100 opportunities
- Serves live dashboard at configured domain
# 📊 Polymarket Edge Monitor

> **Real-time Polymarket market monitoring and edge detection system**

---

## 🎯 Overview

Polymarket Edge Monitor is an automated system for identifying mispriced prediction markets on Polymarket by cross-referencing real-time market odds with external data sources. It helps traders spot arbitrage opportunities and value bets through continuous market monitoring and research integration.

---

## ✨ Key Features

- **Real-time Market Monitoring**: Track prices, odds, volume, and liquidity across Polymarket markets
- **Historical Analysis**: Retrieve price trends and volume patterns for pattern recognition
- **Smart Market Discovery**: Search and filter markets by keywords, tags, events, sports leagues, liquidity, and volume thresholds
- **Web Research Integration**: Automatically search and scrape authoritative news, polls, and statistical sources
- **Edge Detection**: Generate reports comparing implied market probabilities against research-based assessments
- **Portfolio Tracking**: Monitor positions and receive timely alerts on emerging opportunities

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google Sheets API credentials (for portfolio tracking)
- Polymarket Gamma API access

### Installation

```bash
# Clone the repository
git clone https://github.com/dutchiono/polymarket-edge-monitor.git
cd polymarket-edge-monitor

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your API credentials

# Start the server
npm start
```

---

## 🏗️ Architecture

The system consists of several key components:

### Server Components
- **Express Server**: Handles HTTP requests and serves the dashboard
- **Sheets Integration**: Syncs market data with Google Sheets for portfolio tracking
- **API Routes**: Endpoints for fetching Polymarket data and executing edge detection

### Data Sources
- **Polymarket Gamma API**: Market prices, odds, events, and historical data
- **Web Scraping**: News articles, polls, and research sources
- **Google Sheets**: Portfolio tracking and P&L calculations

### Key Files
- `server/index.js`: Main Express server
- `server/sheets-integration.js`: Google Sheets API integration
- `public/index.html`: Dashboard UI
- `deploy.yml`: GitHub Actions deployment workflow

---

## 📡 API Endpoints

### Polymarket Gamma API

The system uses the following Gamma API endpoints:

- `get_markets`: Fetch market data with filtering options
- `get_prices`: Real-time price monitoring
- `get_search`: Search markets by keywords
- `get_events`: Retrieve grouped events
- `get_events_slug`: Event details by slug
- `get_markets_data`: Bulk market data retrieval
- `get_series`: Market series information
- `get_sports`: Sports-related markets
- `get_tags`: Tag-based filtering
- `get_markets_condition_id`: Markets by condition ID

---

## 🔧 Configuration

### Environment Variables

```env
# Google Sheets
GOOGLE_SHEETS_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=your_private_key_here

# Server
PORT=3000
NODE_ENV=production
```

### GitHub Secrets (for deployment)

- `SSH_PRIVATE_KEY`: SSH key for server deployment

---

## 📊 Usage

### Portfolio Tracking

The system automatically syncs with Google Sheets to track:
- Current market positions
- Real-time price updates
- P&L calculations
- Position sizing and risk metrics

### Edge Detection

Run edge detection scans to identify:
- Pricing inefficiencies
- Arbitrage opportunities across related markets
- Value bets based on research
- Catalyst-driven price movements

### Dashboard

Access the web dashboard at `http://localhost:3000` to:
- View live market data
- Monitor portfolio performance
- Review edge detection reports
- Track historical trends

---

## 🚢 Deployment

### Automated Deployment

The repository includes a GitHub Actions workflow (`deploy.yml`) that automatically deploys to your server on push to main:

```yaml
on:
  push:
    branches: [ main ]
  workflow_dispatch:
```

The workflow:
1. Connects to your server via SSH
2. Pulls the latest code
3. Installs dependencies
4. Restarts the application with PM2

### Manual Deployment

```bash
# SSH into your server
ssh root@your-server-ip

# Navigate to project directory
cd /root/polymarket-edge-monitor

# Pull latest changes
git pull origin main

# Install dependencies
npm install --legacy-peer-deps

# Restart with PM2
pm2 restart polymarket-edge-monitor || pm2 start npm --name polymarket-edge-monitor -- start
```

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **APIs**: Polymarket Gamma API, Google Sheets API
- **Deployment**: GitHub Actions, PM2
- **Server**: Ubuntu with SSH access

---

## 📈 Use Cases

1. **Arbitrage Detection**: Identify pricing inefficiencies across related markets
2. **Value Betting**: Find markets where odds don't match research-based probabilities
3. **Portfolio Management**: Track positions and P&L in real-time
4. **Market Research**: Automated research gathering and analysis
5. **Risk Assessment**: Data-driven betting strategies with risk metrics

---

## 🤝 Contributing

Pull requests welcome. For major changes, please open an issue first to discuss proposed changes.

---

## ⚠️ Disclaimer

This tool is for informational purposes only. **NOT FINANCIAL ADVICE.** 

- Trading prediction markets involves risk
- Past performance does not guarantee future results
- Always conduct your own research
- Only bet what you can afford to lose

---

## 📝 License

MIT License - Open source freedom for edge detection

---

**Built with 💰 by dutchiono**  
*Powered by Polymarket Gamma API. Inspired by the pursuit of alpha.*

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const SheetsIntegration = require('./sheets-integration');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3690;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 10000; // 10 seconds default
const SHEETS_SYNC_INTERVAL = parseInt(process.env.SHEETS_SYNC_INTERVAL) || 3600000; // 1 hour default

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Polymarket API base URL
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// Google Sheets integration
const sheetsIntegration = new SheetsIntegration();

// In-memory cache for markets
let marketsCache = [];
let edgeCandidates = [];
let lastUpdate = null;
let lastSheetsSync = null;

// Edge detection algorithm
const detectEdges = (markets) => {
  const edges = [];
  
  markets.forEach(market => {
    if (!market || !market.tokens) return;
    
    const yesToken = market.tokens.find(t => t.outcome === 'Yes');
    const noToken = market.tokens.find(t => t.outcome === 'No');
    
    if (!yesToken || !noToken) return;
    
    const yesPrice = parseFloat(yesToken.price);
    const noPrice = parseFloat(noToken.price);
    const volume24h = parseFloat(market.volume24hr) || 0;
    const liquidity = parseFloat(market.liquidity) || 0;
    
    // Edge detection criteria
    const edgeScore = calculateEdgeScore(market, yesPrice, noPrice, volume24h, liquidity);
    
    if (edgeScore > 0) {
      edges.push({
        ...market,
        yesPrice,
        noPrice,
        volume24h,
        liquidity,
        edgeScore,
        edgeType: determineEdgeType(market, yesPrice, noPrice, volume24h, liquidity),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Sort by edge score (highest first)
  return edges.sort((a, b) => b.edgeScore - a.edgeScore);
};

const calculateEdgeScore = (market, yesPrice, noPrice, volume24h, liquidity) => {
  let score = 0;
  
  // 1. Mispricing detection (price sum != 1.0)
  const priceSum = yesPrice + noPrice;
  const pricingError = Math.abs(1.0 - priceSum);
  if (pricingError > 0.02) { // >2% deviation
    score += pricingError * 100;
  }
  
  // 2. Extreme pricing (very high or very low probabilities)
  if (yesPrice > 0.95 || yesPrice < 0.05) {
    score += 15;
  }
  
  // 3. Volume anomaly detection
  if (volume24h > 50000 && liquidity > 10000) {
    const volumeLiquidityRatio = volume24h / liquidity;
    if (volumeLiquidityRatio > 5) { // High turnover
      score += 20;
    }
  }
  
  // 4. Low liquidity + high volume = potential manipulation or catalyst
  if (liquidity < 5000 && volume24h > 10000) {
    score += 25;
  }
  
  // 5. Recent market (potential early edge)
  const createdDate = new Date(market.createdAt);
  const hoursSinceCreation = (Date.now() - createdDate) / (1000 * 60 * 60);
  if (hoursSinceCreation < 48) {
    score += 10;
  }
  
  return score;
};

const determineEdgeType = (market, yesPrice, noPrice, volume24h, liquidity) => {
  const types = [];
  
  const priceSum = yesPrice + noPrice;
  const pricingError = Math.abs(1.0 - priceSum);
  
  if (pricingError > 0.02) types.push('MISPRICING');
  if (yesPrice > 0.95 || yesPrice < 0.05) types.push('EXTREME');
  if (liquidity < 5000 && volume24h > 10000) types.push('CATALYST');
  if (volume24h / liquidity > 5 && liquidity > 10000) types.push('VOLUME_ANOMALY');
  
  const hoursSinceCreation = (Date.now() - new Date(market.createdAt)) / (1000 * 60 * 60);
  if (hoursSinceCreation < 48) types.push('NEW_MARKET');
  
  return types.join(', ') || 'UNKNOWN';
};

// Fetch markets from Polymarket
const fetchMarkets = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching markets...`);
    
    const response = await axios.get(`${GAMMA_API_BASE}/markets`, {
      params: {
        limit: 100,
        active: true
      }
    });
    
    marketsCache = response.data;
    edgeCandidates = detectEdges(marketsCache);
    lastUpdate = new Date().toISOString();
    
    console.log(`[${lastUpdate}] Fetched ${marketsCache.length} markets, found ${edgeCandidates.length} edge candidates`);
    
    // Emit to all connected clients
    io.emit('markets-update', {
      markets: marketsCache,
      edges: edgeCandidates,
      lastUpdate
    });
    
    return { markets: marketsCache, edges: edgeCandidates };
  } catch (error) {
    console.error('Error fetching markets:', error.message);
    return { error: error.message };
  }
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    lastUpdate,
    lastSheetsSync,
    marketsCount: marketsCache.length,
    edgesCount: edgeCandidates.length
  });
});

app.get('/api/markets', (req, res) => {
  res.json({
    markets: marketsCache,
    lastUpdate
  });
});

app.get('/api/edges', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    edges: edgeCandidates.slice(0, limit),
    total: edgeCandidates.length,
    lastUpdate
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current data immediately
  socket.emit('markets-update', {
    markets: marketsCache,
    edges: edgeCandidates,
    lastUpdate
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Google Sheets sync function
const syncToSheets = async () => {
  if (edgeCandidates.length === 0) {
    console.log('No edge candidates to sync');
    return;
  }

  try {
    const result = await sheetsIntegration.syncEdgeCandidates(edgeCandidates);
    if (result.success) {
      lastSheetsSync = new Date().toISOString();
      console.log(`[${lastSheetsSync}] Successfully synced ${result.rowsAdded} edges to Google Sheets`);
    } else {
      console.error('Failed to sync to Google Sheets:', result.error);
    }
  } catch (error) {
    console.error('Error during sheets sync:', error.message);
  }
};

// Start polling
let pollingInterval;
let sheetsSyncInterval;

const startPolling = () => {
  // Initial fetch
  fetchMarkets();
  
  // Set up interval
  pollingInterval = setInterval(fetchMarkets, POLL_INTERVAL);
  console.log(`Polling started with ${POLL_INTERVAL}ms interval`);
};

const startSheetsSync = async () => {
  // Initialize sheets integration
  await sheetsIntegration.initialize();
  
  // Initial sync
  syncToSheets();
  
  // Set up interval
  sheetsSyncInterval = setInterval(syncToSheets, SHEETS_SYNC_INTERVAL);
  console.log(`Google Sheets sync started with ${SHEETS_SYNC_INTERVAL}ms interval`);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    console.log('Polling stopped');
  }
  if (sheetsSyncInterval) {
    clearInterval(sheetsSyncInterval);
    console.log('Sheets sync stopped');
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopPolling();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Polymarket Edge Monitor running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  startPolling();
  startSheetsSync();
});

module.exports = { app, server, io };

require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class SheetsIntegration {
  constructor() {
    this.doc = null;
    this.sheet = null;
    this.initialized = false;
    this.lastPrices = new Map(); // Track price changes
    this.updateInterval = 10000; // 10 seconds
    this.rateLimitDelay = 0;
    this.requestCount = 0;
    this.requestWindow = 100000; // 100 seconds
  }

  async initialize() {
    try {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
        console.warn('Google Sheets credentials not configured. Skipping integration.');
        return false;
      }

      const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      
      // Get or create "Edge Candidates" sheet
      this.sheet = this.doc.sheetsByTitle['Edge Candidates'];
      if (!this.sheet) {
        this.sheet = await this.doc.addSheet({
          title: 'Edge Candidates',
          headerValues: [
            'Market Title',
            'Yes Price',
            'No Price',
            'Volume 24h',
            'Liquidity',
            'Edge Score',
            'Edge Type',
            'Last Updated',
            'Price Change',
            'Market ID',
            'URL'
          ]
        });
        
        // Apply conditional formatting
        await this.applyConditionalFormatting();
      }

      this.initialized = true;
      console.log('Google Sheets integration initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error.message);
      return false;
    }
  }

  async applyConditionalFormatting() {
    try {
      // Apply conditional formatting to Edge Score column (column F)
      await this.sheet.setConditionalFormatRules([
        {
          ranges: [{
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 5,
            endColumnIndex: 6
          }],
          gradientRule: {
            minpoint: {
              color: { red: 1, green: 1, blue: 0.5 }, // Light yellow
              type: 'NUMBER',
              value: '0'
            },
            midpoint: {
              color: { red: 1, green: 1, blue: 0 }, // Yellow
              type: 'NUMBER',
              value: '30'
            },
            maxpoint: {
              color: { red: 0, green: 1, blue: 0 }, // Green
              type: 'NUMBER',
              value: '60'
            }
          }
        }
      ]);
      
      console.log('Applied conditional formatting to sheet');
    } catch (error) {
      console.error('Error applying conditional formatting:', error.message);
    }
  }

  async updateLiveSheet(edges) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return { success: false, error: 'Not initialized' };
    }

    // Rate limit protection
    await this.checkRateLimit();

    try {
      const timestamp = new Date().toISOString();
      
      // Take top 100 edges
      const topEdges = edges.slice(0, 100);
      
      // Build rows with price change tracking
      const rows = topEdges.map(edge => {
        const marketId = edge.id || edge.condition_id || '';
        const currentPrice = edge.yesPrice;
        const lastPrice = this.lastPrices.get(marketId);
        
        let priceChange = '';
        if (lastPrice !== undefined) {
          const change = ((currentPrice - lastPrice) / lastPrice * 100).toFixed(2);
          priceChange = change > 0 ? `+${change}%` : `${change}%`;
        }
        
        // Store current price for next update
        this.lastPrices.set(marketId, currentPrice);
        
        return {
          'Market Title': edge.question || edge.title || 'Untitled',
          'Yes Price': edge.yesPrice?.toFixed(4) || '0',
          'No Price': edge.noPrice?.toFixed(4) || '0',
          'Volume 24h': edge.volume24h?.toFixed(2) || '0',
          'Liquidity': edge.liquidity?.toFixed(2) || '0',
          'Edge Score': edge.edgeScore?.toFixed(2) || '0',
          'Edge Type': edge.edgeType || 'UNKNOWN',
          'Last Updated': timestamp,
          'Price Change': priceChange,
          'Market ID': marketId,
          'URL': edge.id ? `https://polymarket.com/event/${edge.id}` : ''
        };
      });

      // Clear existing data (except header)
      await this.sheet.clear('A2:K1000');
      
      // Update with new data in single batch
      await this.sheet.addRows(rows);
      
      this.requestCount++;
      console.log(`✅ Live update: ${rows.length} markets synced to sheet at ${new Date().toLocaleTimeString()}`);
      return { success: true, rowsUpdated: rows.length };
    } catch (error) {
      console.error('Error updating sheet:', error.message);
      
      // If rate limited, increase delay
      if (error.message.includes('rate') || error.message.includes('quota')) {
        this.rateLimitDelay = Math.min(this.rateLimitDelay + 5000, 20000);
        console.warn(`⚠️ Rate limit detected. Slowing down to ${this.updateInterval + this.rateLimitDelay}ms`);
      }
      
      return { success: false, error: error.message };
    }
  }

  async checkRateLimit() {
    // Google Sheets API: 100 requests per 100 seconds per user
    // We're doing 6 requests per minute (every 10 seconds)
    // This is well under the limit, but we add protection anyway
    
    if (this.rateLimitDelay > 0) {
      console.log(`⏳ Rate limit delay: ${this.rateLimitDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      
      // Gradually decrease delay if successful
      this.rateLimitDelay = Math.max(this.rateLimitDelay - 1000, 0);
    }
  }

  // Legacy method for backward compatibility
  async syncEdgeCandidates(edges) {
    return this.updateLiveSheet(edges);
  }

  async getRecentSnapshots(limit = 10) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return { success: false, error: 'Not initialized' };
    }

    try {
      const rows = await this.sheet.getRows();
      const snapshots = rows
        .slice(-limit)
        .map(row => ({
          timestamp: row['Timestamp'] || row['Last Updated'],
          market: row['Market Title'],
          yesPrice: parseFloat(row['Yes Price']),
          edgeScore: parseFloat(row['Edge Score']),
          edgeType: row['Edge Type'],
          priceChange: row['Price Change']
        }));
      
      return { success: true, snapshots };
    } catch (error) {
      console.error('Error fetching snapshots:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SheetsIntegration;
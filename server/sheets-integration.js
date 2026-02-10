require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class SheetsIntegration {
  constructor() {
    this.doc = null;
    this.sheet = null;
    this.initialized = false;
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
      
      // Get or create "Edge Monitor" sheet
      this.sheet = this.doc.sheetsByTitle['Edge Monitor'];
      if (!this.sheet) {
        this.sheet = await this.doc.addSheet({
          title: 'Edge Monitor',
          headerValues: [
            'Timestamp',
            'Market Title',
            'Yes Price',
            'No Price',
            'Volume 24h',
            'Liquidity',
            'Edge Score',
            'Edge Type',
            'Market ID',
            'URL'
          ]
        });
      }

      this.initialized = true;
      console.log('Google Sheets integration initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error.message);
      return false;
    }
  }

  async syncEdgeCandidates(edges) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return { success: false, error: 'Not initialized' };
    }

    try {
      const timestamp = new Date().toISOString();
      const rows = edges.map(edge => ({
        Timestamp: timestamp,
        'Market Title': edge.question || edge.title || 'Untitled',
        'Yes Price': edge.yesPrice?.toFixed(4) || '0',
        'No Price': edge.noPrice?.toFixed(4) || '0',
        'Volume 24h': edge.volume24h?.toFixed(2) || '0',
        'Liquidity': edge.liquidity?.toFixed(2) || '0',
        'Edge Score': edge.edgeScore?.toFixed(2) || '0',
        'Edge Type': edge.edgeType || 'UNKNOWN',
        'Market ID': edge.id || edge.condition_id || '',
        'URL': edge.id ? `https://polymarket.com/event/${edge.id}` : ''
      }));

      await this.sheet.addRows(rows);
      console.log(`Synced ${rows.length} edge candidates to Google Sheets`);
      return { success: true, rowsAdded: rows.length };
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getRecentSnapshots(limit = 10) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return [];
    }

    try {
      const rows = await this.sheet.getRows({ limit, offset: 0 });
      return rows.map(row => row.toObject());
    } catch (error) {
      console.error('Error fetching recent snapshots:', error.message);
      return [];
    }
  }
}

module.exports = SheetsIntegration;

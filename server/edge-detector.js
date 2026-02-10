// Edge detection algorithm for Polymarket markets
// Exported for use in server and testing

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

module.exports = {
  detectEdges,
  calculateEdgeScore,
  determineEdgeType
};

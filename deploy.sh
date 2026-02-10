#!/bin/bash

# Polymarket Edge Monitor Deployment Script
# For edge.bushleague.xyz on port 3690

set -e  # Exit on any error

echo "====================================="
echo "Polymarket Edge Monitor Deployment"
echo "====================================="

# Configuration
APP_NAME="polymarket-edge-monitor"
APP_DIR="/var/www/scolypan/$APP_NAME"
REPO_URL="https://github.com/dutchiono/polymarket-edge-monitor.git"
PORT=3690
DOMAIN="edge.bushleague.xyz"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/8] Checking if app directory exists...${NC}"
if [ -d "$APP_DIR" ]; then
    echo -e "${GREEN}Directory exists. Pulling latest changes...${NC}"
    cd "$APP_DIR"
    git pull origin main
else
    echo -e "${YELLOW}Directory doesn't exist. Cloning repository...${NC}"
    mkdir -p /var/www/scolypan
    cd /var/www/scolypan
    git clone "$REPO_URL"
    cd "$APP_NAME"
fi

echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
npm install --production

echo -e "${YELLOW}[3/8] Checking .env file...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}ERROR: .env file not found!${NC}"
    echo "Please create .env with these variables:"
    echo "  PORT=3690"
    echo "  GOOGLE_SHEET_ID=your-sheet-id"
    echo "  GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com"
    echo "  GOOGLE_PRIVATE_KEY=your-private-key"
    exit 1
else
    echo -e "${GREEN}.env file found${NC}"
fi

echo -e "${YELLOW}[4/8] Setting up PM2 process...${NC}"
if pm2 list | grep -q "$APP_NAME"; then
    echo -e "${GREEN}PM2 process exists. Restarting...${NC}"
    pm2 restart "$APP_NAME"
else
    echo -e "${YELLOW}Starting new PM2 process...${NC}"
    pm2 start ecosystem.config.json
fi

echo -e "${YELLOW}[5/8] Saving PM2 configuration...${NC}"
pm2 save

echo -e "${YELLOW}[6/8] Configuring Nginx...${NC}"
if [ -f "/etc/nginx/sites-available/$DOMAIN" ]; then
    echo -e "${GREEN}Nginx config already exists${NC}"
else
    echo -e "${YELLOW}Creating Nginx configuration...${NC}"
    sudo cp nginx-edge.bushleague.xyz.conf "/etc/nginx/sites-available/$DOMAIN"
    sudo ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
fi

echo -e "${YELLOW}[7/8] Testing and reloading Nginx...${NC}"
sudo nginx -t
sudo systemctl reload nginx

echo -e "${YELLOW}[8/8] Checking SSL certificate...${NC}"
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}SSL certificate already exists for $DOMAIN${NC}"
else
    echo -e "${YELLOW}Setting up SSL with Certbot...${NC}"
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email dutchiono@gmail.com
fi

echo ""
echo -e "${GREEN}====================================="
echo "✓ Deployment Complete!"
echo "=====================================${NC}"
echo ""
echo "Service Status:"
pm2 status "$APP_NAME"
echo ""
echo "Access your app at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  View logs:    pm2 logs $APP_NAME"
echo "  Restart:      pm2 restart $APP_NAME"
echo "  Stop:         pm2 stop $APP_NAME"
echo "  Monitor:      pm2 monit"
echo ""

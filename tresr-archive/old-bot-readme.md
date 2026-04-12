# TRESR Telegram Bot

Automated POD (Print-on-Demand) trend detection, product creation, and in-house fulfillment management.

## Features

- **Trend Detection**: Scans Twitter/X, Reddit, Google Trends for POD opportunities
- **Design Generation**: Creates design briefs using Claude, supports AI image generation
- **Shopify Integration**: Creates products, attaches artwork as metafields
- **Fulfillment Management**: Sends high-res artwork to print shop via email/webhook
- **Telegram Control**: Full command interface for approvals, status, and manual actions
- **Scheduled Automation**: Daily trend scans, order checks, and reports

## Quick Start

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Follow prompts to create your bot
4. Save the bot token

### 2. Get Your Chat ID

1. Message [@userinfobot](https://t.me/userinfobot)
2. It will reply with your user ID
3. This is your `TELEGRAM_CHAT_ID`

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Test Connections

```bash
npm test
```

### 6. Start the Bot

```bash
npm start
# Or for development with auto-reload:
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and quick start |
| `/status` | System status overview |
| `/trends` | Scan for trending opportunities |
| `/trends [niche]` | Scan specific niche |
| `/orders` | View recent orders |
| `/orders pending` | View orders needing artwork |
| `/pending` | View pending approvals |
| `/artwork [order_id]` | Send artwork to print shop |
| `/pause` | Pause all automations |
| `/resume` | Resume automations |
| `/help` | Show all commands |

## Scheduled Jobs

| Time | Job | Description |
|------|-----|-------------|
| 6:00 AM | Trend Scan | Scan all niches for opportunities |
| 2:00 PM | Trend Scan | Second daily scan |
| Every 2h (8am-8pm) | Order Check | Check for new orders |
| 9:00 PM | Daily Report | Send daily summary |

*All times in America/Chicago timezone (configurable)*

## Product Workflow

```
1. TREND DETECTED
   └── Bot sends opportunity to Telegram
   └── You approve with ✅ button

2. DESIGN GENERATED
   └── Claude creates design brief
   └── AI generates artwork (or queued for manual)
   └── Uploaded to Cloudinary

3. PRODUCT CREATED
   └── Shopify product created as draft
   └── Artwork attached as metafield
   └── You review and publish

4. ORDER RECEIVED
   └── Bot notifies of new order
   └── Links to product artwork
   └── /artwork [order] sends to print shop
```

## Artwork Flow (In-House Fulfillment)

Since TRESR handles fulfillment in-house, artwork is managed via:

1. **Shopify Metafields**: Each product has `tresr.artwork_url` and `tresr.high_res_artwork`
2. **Cloudinary Storage**: High-res files stored with on-the-fly transformations
3. **Print Shop Delivery**: Via webhook or email when orders come in

### Artwork Delivery Options

**Option 1: Webhook (Recommended for API-enabled print shop)**
```env
PRINT_SHOP_WEBHOOK_URL=https://your-printshop.com/api/orders
```

**Option 2: Email**
```env
PRINT_SHOP_EMAIL=printshop@example.com
```

**Option 3: Manual Download**
- Bot prepares download links
- You forward to print shop manually

## Niches Monitored

1. Coffee Culture
2. Fitness/Gym
3. Gaming
4. Millennials/Gen X Nostalgia
5. Mental Health
6. Dog Lovers
7. Science/Space
8. Crypto
9. Entrepreneurs
10. AI/Developers

## Environment Variables

```env
# Required
TELEGRAM_BOT_TOKEN=        # From BotFather
TELEGRAM_CHAT_ID=          # Your user ID
ANTHROPIC_API_KEY=         # Claude API key
SHOPIFY_STORE_URL=         # your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=      # Shopify Admin API token

# Recommended
CLOUDINARY_CLOUD_NAME=     # For artwork storage
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
DATAFORSEO_LOGIN=          # For trend analysis
DATAFORSEO_PASSWORD=

# Optional
X_BEARER_TOKEN=            # For Twitter trends
PRINT_SHOP_EMAIL=          # Email artwork delivery
PRINT_SHOP_WEBHOOK_URL=    # Webhook artwork delivery
```

## File Structure

```
tresr-bot/
├── src/
│   ├── index.js              # Main bot and commands
│   ├── modules/
│   │   ├── trend-detector.js   # Trend scanning
│   │   ├── design-generator.js # Design creation
│   │   ├── shopify-manager.js  # Shopify API
│   │   └── fulfillment-manager.js # Print shop delivery
│   └── services/
│       ├── database.js         # SQLite database
│       └── formatters.js       # Message formatting
├── data/
│   └── tresr.db              # SQLite database (auto-created)
├── config/
├── .env                      # Your configuration
├── .env.example              # Template
└── package.json
```

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect repo to Railway
3. Add environment variables
4. Deploy

### Manual Server

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name tresr-bot

# View logs
pm2 logs tresr-bot
```

## Troubleshooting

### Bot not responding
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is started (`npm start`)
- Check `TELEGRAM_ADMIN_IDS` includes your user ID

### Trends not finding anything
- Check `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`
- Lower threshold: `/threshold 60`
- Try specific niche: `/trends coffee`

### Artwork not sending
- Verify `PRINT_SHOP_EMAIL` or `PRINT_SHOP_WEBHOOK_URL`
- Check `CLOUDINARY` credentials for high-res URLs
- View order status: `/orders pending`

## Development

```bash
# Run with auto-reload
npm run dev

# Test API connections
npm test

# Check logs
tail -f data/logs/*.log
```

## License

Private - TRESR.com

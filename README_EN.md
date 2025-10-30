# RSSHub MCP Server

[中文文档](./README.md) | English

A Model Context Protocol (MCP) server for [RSSHub](https://docs.rsshub.app/), enabling AI assistants to access and query various RSS feeds through the MCP protocol.

## Features

- 🔍 **RSS Feed Fetching**: Get RSS feeds from various websites via routes
- ⭐ **Subscription Management** (New):
  - Add/remove feed subscriptions
  - Fetch all subscriptions with one click
  - Local persistent storage for subscription list
  - Set default parameters and custom names for each subscription
- 🔎 **Smart Route Search**: Automatically fetch all available routes from RSSHub API with fuzzy search support
- 💾 **Route Caching**: Automatically cache route data (24 hours) for faster response
- ⚙️ **Flexible Instance Configuration**:
  - Support `RSSHUB_INSTANCE` environment variable for custom instance
  - Defaults to public instance `https://rsshub.app`
- 🎯 **Universal Parameters**: Filtering, item limit, full-text output, etc.
- 🌐 **Complete Platform Coverage**: All platforms and routes supported by RSSHub
- ⏱️ **Smart Timeout Handling**: 60-second timeout, supports complex routes
- 🔧 **Detailed Error Diagnostics**: Specific solutions for different error types
- 📊 **Request Logging**: Log request URL, duration, and detailed error information
- 🚀 **Lightweight**: Only 40 dependency packages, fast installation and startup

## Installation

### Option 1: Via npx (Recommended)

No manual installation required, use npx directly in Claude Desktop configuration:

Edit configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rsshub": {
      "command": "npx",
      "args": ["rsshub-mcp"]
    }
  }
}
```

To use a custom RSSHub instance:

```json
{
  "mcpServers": {
    "rsshub": {
      "command": "npx",
      "args": ["rsshub-mcp"],
      "env": {
        "RSSHUB_INSTANCE": "http://localhost:1200"
      }
    }
  }
}
```

### Option 2: Build from Source

```bash
# Clone repository
git clone https://github.com/panxiande/RSSHub-MCP.git
cd RSSHub-MCP

# Install dependencies
npm install

# Build project
npm run build
```

Then add to Claude Desktop configuration file:

#### macOS

```json
{
  "mcpServers": {
    "rsshub": {
      "command": "node",
      "args": ["/path/to/RSSHub-MCP/dist/index.js"]
    }
  }
}
```

#### Windows

```json
{
  "mcpServers": {
    "rsshub": {
      "command": "node",
      "args": ["C:\\path\\to\\RSSHub-MCP\\dist\\index.js"]
    }
  }
}
```

### Using Custom Instance (Recommended)

Configure custom instance via `RSSHUB_INSTANCE` environment variable for better stability:

```json
{
  "mcpServers": {
    "rsshub": {
      "command": "npx",
      "args": ["rsshub-mcp"],
      "env": {
        "RSSHUB_INSTANCE": "http://localhost:1200"
      }
    }
  }
}
```

Restart Claude Desktop after configuration to use.

### Custom Data Storage Location

Subscription data is saved by default to `~/.rsshub-mcp/subscriptions.json`. To customize the location, set the environment variable:

```json
{
  "mcpServers": {
    "rsshub": {
      "command": "npx",
      "args": ["rsshub-mcp"],
      "env": {
        "RSSHUB_INSTANCE": "http://localhost:1200",
        "RSSHUB_MCP_DATA_DIR": "/custom/path/to/data"
      }
    }
  }
}
```

## Available Tools

### 1. get_feed

Get RSSHub feed content. Supports two modes:

**Mode 1: Get All Subscriptions (No Parameters)**
- Call without any parameters to automatically fetch all subscribed feeds
- Returns aggregated subscription list with their data

**Mode 2: Get Specific Route (With route Parameter)**
- Fetch RSS feed for a specific route

**Parameters:**
- `route` (optional): RSSHub route path, e.g., `/bilibili/bangumi/media/9192`. Omit to fetch all subscriptions
- `params` (optional): Universal parameters object, e.g., `{ "limit": "10", "filter": "keyword" }`

**Examples:**
```
# Get all subscription updates
Get all my subscription updates

# Get specific route
Get Telegram channel awesomeRSSHub feed content
Get Bilibili anime 9192 updates
Subscribe to GitHub repository anthropics/anthropic-sdk-python releases
```

### 2. subscribe

Add an RSS feed to your subscription list.

**Parameters:**
- `route` (required): RSSHub route path to subscribe to
- `name` (optional): Custom friendly name for this subscription
- `params` (optional): Default parameters for this subscription, automatically applied on fetch

**Features:**
- Automatic duplicate subscription detection
- Support friendly names for subscriptions
- Preset default parameters (like filter rules, item limits)
- Data persisted locally

**Examples:**
```
Subscribe to Bilibili anime /bilibili/bangumi/media/9192, name it "My Anime"
Add GitHub repository /github/issue/vuejs/core to subscription list
Subscribe to /telegram/channel/awesomeRSSHub with limit 10
```

### 3. unsubscribe

Remove an RSS feed from your subscription list.

**Parameters:**
- `id` (optional): Unique subscription ID
- `route` (optional): Route path to unsubscribe from

**Note:** At least one of `id` or `route` must be provided

**Examples:**
```
Unsubscribe from /bilibili/bangumi/media/9192
Remove subscription with ID sub_xxx
```

### 4. list_subscriptions

List all saved subscriptions.

**Parameters:** None

**Returned Information:**
- Subscription ID
- Route path
- Custom name
- Default parameters
- Creation time
- Full URL

**Examples:**
```
Show all my subscriptions
List subscription list
```

### 5. search_routes

Search RSSHub routes. Automatically fetch latest routes from RSSHub API with fuzzy search support.

**Parameters:**
- `query` (required): Search keyword, supports platform names, route names, categories, etc.

**Features:**
- Fetch all available routes from RSSHub API in real-time
- 24-hour local cache for faster response
- Search by platform name (e.g., 'bilibili', 'github')
- Search by category (e.g., 'social-media', 'programming')
- Fuzzy search by route name and description
- Return up to 50 matching results

**Examples:**
```
Search for bilibili related routes
Find github subscription methods
Search telegram routes
Find routes under social-media category
```

## Usage Examples

After configuration, you can directly ask in Claude Desktop:

1. **Manage subscriptions:**
   - "Subscribe to Bilibili anime /bilibili/bangumi/media/9192, name it 'My Anime'"
   - "Add GitHub repository vuejs/core issues to subscription list"
   - "Show all my subscriptions"
   - "Unsubscribe from /telegram/channel/awesomeRSSHub"

2. **Get feed content:**
   - "Get all my subscription updates" (fetch all subscriptions with one click)
   - "Get the latest content from Telegram channel awesomeRSSHub"
   - "Check latest episode of Bilibili anime 9192"
   - "Check latest issues from GitHub repository vuejs/core"

3. **Search routes:**
   - "Search for bilibili related routes"
   - "Find github subscription methods"
   - "What telegram routes are available?"
   - "Search routes under social-media category"
   - "How to subscribe to Twitter users?"
   - "How to subscribe to Weibo?"

## RSSHub Route Format

RSSHub routes follow this format:
```
/<platform>/<content-type>/<parameters>
```

Examples:
- `/telegram/channel/awesomeRSSHub` - Telegram channel
- `/bilibili/user/dynamic/2267573` - Bilibili user updates
- `/github/issue/vuejs/core` - GitHub Issues
- `/twitter/user/elonmusk` - Twitter user tweets

For more routes, visit [RSSHub Official Documentation](https://docs.rsshub.app/).

## Universal Parameters

RSSHub supports the following universal parameters:

- `limit`: Limit number of returned items, e.g., `{ "limit": "10" }`
- `filter`: Filter title and description, e.g., `{ "filter": "keyword" }`
- `filterout`: Exclude items containing specific content
- `mode`: Output mode, e.g., `fulltext` for full-text output

**Usage Example:**
```
Get latest 10 items from Telegram channel, route is /telegram/channel/awesomeRSSHub, limit to 10 items
```

## Troubleshooting

### Common Issues

#### 1. 502 Bad Gateway Error

**Causes:**
- RSSHub server overloaded
- Upstream website (e.g., arxiv.org) temporarily inaccessible or timeout
- Network connection issues

**Solutions:**
- Retry later (usually temporary issue)
- Use other RSSHub instances (self-deploy or other public instances)
- Check if upstream website is working properly

#### 2. Request Timeout

**Causes:**
- Some routes take longer to process (over 60 seconds)
- Slow network connection
- Slow RSSHub server response

**Solutions:**
- Retry later
- Verify route is correct (use `search_routes` tool)
- Consider using self-deployed RSSHub instance

#### 3. 404 Not Found Error

**Causes:**
- Route doesn't exist or path is incorrect

**Solutions:**
- Use `search_routes` tool to search for correct route
- Check [RSSHub Official Documentation](https://docs.rsshub.app/)

### Debug Logs

MCP server outputs detailed logs to standard error (stderr), including:
- Complete request URL
- Request duration
- Error details

You can view this information in Claude Desktop logs (usually in `~/Library/Logs/Claude/` directory).

### Configuration Recommendations

**Timeout Settings:**
- Default timeout: 60 seconds
- Max response size: 50MB
- If frequent timeouts occur, consider self-deploying RSSHub instance

**Instance Selection (by priority):**

1. **Self-deployed Instance** (Highly Recommended)
   - Configuration: `RSSHUB_INSTANCE=http://localhost:1200`
   - Advantages: Most stable, fastest, no rate limits
   - Deployment: 5-minute Docker one-click deployment

2. **Other Public Instances**
   - Find instances at [RSSHub Instance List](https://docs.rsshub.app/guide/instances)
   - Configuration: `RSSHUB_INSTANCE=https://your-instance.com`

3. **Default Public Instance** `https://rsshub.app`
   - Quick start, but may have high load
   - Switch instances when encountering 502/503 errors

**Configuration Method:**
- Set `RSSHUB_INSTANCE` environment variable in Claude Desktop configuration

## Self-Deploy RSSHub (Recommended)

For best performance and stability, it's recommended to deploy your own RSSHub instance. Takes only 5 minutes with Docker:

### Use Docker Compose (Recommended)

1. Create `docker-compose.yml`:

```yaml
version: '3'
services:
  rsshub:
    image: diygod/rsshub
    restart: always
    ports:
      - '1200:1200'
    environment:
      NODE_ENV: production
      CACHE_TYPE: redis
      REDIS_URL: 'redis://redis:6379/'
      PUPPETEER_WS_ENDPOINT: 'ws://browserless:3000'
    depends_on:
      - redis
      - browserless

  redis:
    image: redis:alpine
    restart: always
    volumes:
      - redis-data:/data

  browserless:
    image: browserless/chrome
    restart: always

volumes:
  redis-data:
```

2. Start services:

```bash
docker-compose up -d
```

3. Visit http://localhost:1200 to confirm it's running

4. Set environment variable in Claude Desktop configuration:

```json
"env": {
  "RSSHUB_INSTANCE": "http://localhost:1200"
}
```

### Use Docker (Simple Mode)

If you don't need caching and browser support:

```bash
docker run -d --name rsshub -p 1200:1200 diygod/rsshub
```

For more deployment options, see [RSSHub Deployment Documentation](https://docs.rsshub.app/deploy/).

## Development

```bash
# Development mode (watch file changes)
npm run dev

# Build
npm run build
```

## Supported Platforms

Including but not limited to:
- 📱 Social Media: Twitter/X, Telegram, Weibo, Zhihu, Reddit
- 🎬 Video Platforms: Bilibili, YouTube
- 💻 Development Platforms: GitHub, GitLab
- 📰 News Sites: Various news websites
- 🎮 Gaming Communities: Steam, Epic Games
- More platforms at [RSSHub Route Documentation](https://docs.rsshub.app/)

## Related Links

- [RSSHub Official Site](https://docs.rsshub.app/)
- [RSSHub GitHub](https://github.com/DIYgod/RSSHub)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/download)

## License

MIT

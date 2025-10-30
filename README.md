# RSSHub MCP Server

中文文档 | [English](./README_EN.md)

一个用于 [RSSHub](https://docs.rsshub.app/) 的 Model Context Protocol (MCP) 服务器，让 AI 助手能够通过 MCP 协议访问和查询各种 RSS 订阅源。

## 功能特性

- 🔍 **RSS 订阅获取**：通过路由获取各种网站的 RSS feed
- ⭐ **订阅管理**（新功能）：
  - 添加/删除订阅源
  - 一键获取所有订阅内容
  - 本地持久化存储订阅列表
  - 为每个订阅设置默认参数和自定义名称
- 🔎 **智能路由搜索**：从 RSSHub API 自动获取所有可用路由并支持模糊搜索
- 💾 **路由缓存**：自动缓存路由数据（24小时），提升响应速度
- ⚙️ **灵活实例配置**：
  - 支持环境变量 `RSSHUB_INSTANCE` 配置自定义实例
  - 支持参数方式临时指定实例
  - 默认使用公共实例 `https://rsshub.app`
- 🎯 **通用参数支持**：过滤、限制条目数、全文输出等
- 🌐 **完整平台覆盖**：覆盖所有 RSSHub 支持的平台和路由
- ⏱️ **智能超时处理**：60 秒超时，支持处理复杂路由
- 🔧 **详细错误诊断**：针对不同错误类型提供具体的解决建议
- 📊 **请求日志**：记录请求 URL、耗时和详细错误信息
- 🚀 **轻量级**：仅 40 个依赖包，快速安装和启动

## 安装

### 方式 1：通过 npx（推荐）

无需手动安装，直接在 Claude Desktop 配置中使用 npx 即可：

编辑配置文件：
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

如需使用自定义 RSSHub 实例：

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

### 方式 2：从源码构建

```bash
# 克隆仓库
git clone https://github.com/panxiande/RSSHub-MCP.git
cd RSSHub-MCP

# 安装依赖
npm install

# 构建项目
npm run build
```

然后在 Claude Desktop 配置文件中添加：

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

### 使用自定义实例（推荐）

通过环境变量 `RSSHUB_INSTANCE` 指定自定义实例，获得更好的稳定性：

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

配置完成后，重启 Claude Desktop 即可使用。

### 自定义数据存储位置

订阅数据默认保存在 `~/.rsshub-mcp/subscriptions.json`。如需自定义位置，可设置环境变量：

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

## 可用工具

### 1. get_feed

获取 RSSHub 订阅源内容。支持两种模式：

**模式 1：获取所有订阅（无参数）**
- 不传任何参数，自动获取所有已订阅源的内容
- 返回聚合的订阅列表及其数据

**模式 2：获取特定路由（传入 route 参数）**
- 获取指定路由的 RSS feed

**参数：**
- `route` (可选): RSSHub 路由路径，例如 `/bilibili/bangumi/media/9192`。不提供时获取所有订阅
- `params` (可选): 通用参数对象，如 `{ "limit": "10", "filter": "关键词" }`

**示例：**
```
# 获取所有订阅的内容
获取我的所有订阅更新

# 获取特定路由
获取 Telegram 频道 awesomeRSSHub 的订阅内容
获取 B站番剧 9192 的更新
订阅 GitHub 仓库 anthropics/anthropic-sdk-python 的 releases
```

### 2. subscribe

将 RSS 源添加到订阅列表。

**参数：**
- `route` (必需): 要订阅的 RSSHub 路由路径
- `name` (可选): 订阅的自定义名称，便于识别
- `params` (可选): 该订阅的默认参数，每次获取时自动应用

**特性：**
- 自动检测重复订阅
- 支持为订阅设置友好名称
- 可预设默认参数（如过滤规则、条目限制）
- 数据持久化保存在本地

**示例：**
```
订阅 B站番剧 /bilibili/bangumi/media/9192，命名为"我的追番"
添加 GitHub 仓库 /github/issue/vuejs/core 到订阅列表
订阅 /telegram/channel/awesomeRSSHub，限制10条
```

### 3. unsubscribe

从订阅列表中删除 RSS 源。

**参数：**
- `id` (可选): 订阅的唯一 ID
- `route` (可选): 要取消订阅的路由路径

**说明：** `id` 和 `route` 至少提供一个

**示例：**
```
取消订阅 /bilibili/bangumi/media/9192
删除订阅 ID 为 sub_xxx 的订阅
```

### 4. list_subscriptions

列出所有已保存的订阅。

**参数：** 无

**返回信息：**
- 订阅 ID
- 路由路径
- 自定义名称
- 默认参数
- 创建时间
- 完整 URL

**示例：**
```
显示我的所有订阅
列出订阅列表
```

### 5. search_routes

搜索 RSSHub 路由。自动从 RSSHub API 获取最新路由并支持模糊搜索。

**参数：**
- `query` (必需): 搜索关键词，支持平台名称、路由名称、分类等

**特性：**
- 从 RSSHub API 实时获取所有可用路由
- 24小时本地缓存，提升响应速度
- 支持按平台名称搜索（如 'bilibili'、'github'）
- 支持按分类搜索（如 'social-media'、'programming'）
- 支持按路由名称、描述模糊搜索
- 最多返回 50 个匹配结果

**示例：**
```
搜索 bilibili 相关的路由
查找 github 的订阅方式
搜索 telegram 路由
查找 social-media 分类下的路由
```

## 使用示例

配置完成后，你可以在 Claude Desktop 中直接询问：

1. **管理订阅：**
   - "订阅 B站番剧 /bilibili/bangumi/media/9192，命名为'我的追番'"
   - "添加 GitHub 仓库 vuejs/core 的 issues 到订阅列表"
   - "显示我的所有订阅"
   - "取消订阅 /telegram/channel/awesomeRSSHub"

2. **获取订阅内容：**
   - "获取我的所有订阅更新" （一键获取所有订阅）
   - "帮我获取 Telegram 频道 awesomeRSSHub 的最新内容"
   - "查看 B站番剧 9192 的最新一集"
   - "查看 GitHub 仓库 vuejs/core 的最新 issues"

3. **搜索路由：**
   - "搜索 bilibili 相关的路由"
   - "查找 github 的订阅方式"
   - "有哪些 telegram 相关的路由？"
   - "搜索 social-media 分类的路由"
   - "如何订阅 Twitter 用户？"
   - "微博怎么订阅？"

## RSSHub 路由说明

RSSHub 路由遵循以下格式：
```
/<平台>/<内容类型>/<参数>
```

例如：
- `/telegram/channel/awesomeRSSHub` - Telegram 频道
- `/bilibili/user/dynamic/2267573` - B站用户动态
- `/github/issue/vuejs/core` - GitHub Issues
- `/twitter/user/elonmusk` - Twitter 用户推文

更多路由请访问 [RSSHub 官方文档](https://docs.rsshub.app/)。

## 通用参数

RSSHub 支持以下通用参数：

- `limit`: 限制返回条目数量，如 `{ "limit": "10" }`
- `filter`: 过滤标题和描述，如 `{ "filter": "关键词" }`
- `filterout`: 排除包含特定内容的条目
- `mode`: 输出模式，如 `fulltext` 全文输出

**使用示例：**
```
获取 Telegram 频道的最新 10 条内容，路由是 /telegram/channel/awesomeRSSHub，限制 10 条
```

## 故障排除

### 常见问题

#### 1. 502 Bad Gateway 错误

**原因：**
- RSSHub 服务器负载过高
- 上游网站（如 arxiv.org）暂时无法访问或响应超时
- 网络连接问题

**解决方案：**
- 稍后重试（这通常是临时性问题）
- 使用其他 RSSHub 实例（自部署或其他公共实例）
- 检查上游网站是否正常工作

#### 2. 请求超时

**原因：**
- 某些路由需要较长时间处理（超过 60 秒）
- 网络连接慢
- RSSHub 服务器响应慢

**解决方案：**
- 稍后重试
- 确认路由是否正确（使用 `search_routes` 工具）
- 考虑使用自部署的 RSSHub 实例

#### 3. 404 Not Found 错误

**原因：**
- 路由不存在或路径错误

**解决方案：**
- 使用 `search_routes` 工具搜索正确的路由
- 查看 [RSSHub 官方文档](https://docs.rsshub.app/)

### 调试日志

MCP 服务器会输出详细的日志到标准错误输出（stderr），包括：
- 请求的完整 URL
- 请求耗时
- 错误详情

可以通过 Claude Desktop 的日志查看这些信息（通常在 `~/Library/Logs/Claude/` 目录）。

### 配置建议

**超时设置：**
- 默认超时：60 秒
- 最大响应大小：50MB
- 如果经常超时，建议自部署 RSSHub 实例

**实例选择（按优先级排序）：**

1. **自部署实例**（强烈推荐）
   - 配置：`RSSHUB_INSTANCE=http://localhost:1200`
   - 优点：最稳定、最快、无速率限制
   - 部署：5 分钟 Docker 一键部署

2. **其他公共实例**
   - 可以在 [RSSHub 实例列表](https://docs.rsshub.app/guide/instances) 找到
   - 配置：`RSSHUB_INSTANCE=https://your-instance.com`

3. **默认公共实例** `https://rsshub.app`
   - 快速开始，但可能负载较高
   - 出现 502/503 错误时建议切换实例

**配置方式：**
- 在 Claude Desktop 配置中设置 `RSSHUB_INSTANCE` 环境变量

## 支持的平台

包括但不限于：
- 📱 社交媒体：Twitter/X、Telegram、微博、知乎、Reddit
- 🎬 视频平台：Bilibili、YouTube
- 💻 开发平台：GitHub、GitLab
- 📰 新闻资讯：各类新闻网站
- 🎮 游戏社区：Steam、Epic Games
- 更多平台见 [RSSHub 路由文档](https://docs.rsshub.app/)

## 相关链接

- [RSSHub 官网](https://docs.rsshub.app/)
- [RSSHub GitHub](https://github.com/DIYgod/RSSHub)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/download)

## 许可证

MIT

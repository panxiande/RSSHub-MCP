#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// RSSHub 实例配置（支持环境变量）
const DEFAULT_RSSHUB_INSTANCE =
  process.env.RSSHUB_INSTANCE || "https://rsshub.app";

console.error(
  `[RSSHub MCP] 使用 RSSHub 实例: ${DEFAULT_RSSHUB_INSTANCE}`
);

// 路由缓存
interface RouteInfo {
  path: string;
  name: string;
  url: string;
  maintainers: string[];
  example: string;
  parameters?: Record<string, string>;
  description?: string;
  categories: string[];
  namespace: string;
  namespaceName: string;
}

interface NamespaceData {
  routes: Record<string, any>;
  name: string;
  url: string;
  categories: string[];
  description: string;
  lang?: string;
}

interface NamespaceResponse {
  [key: string]: NamespaceData;
}

let routesCache: RouteInfo[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

// 获取所有路由
async function fetchAllRoutes(): Promise<RouteInfo[]> {
  // 检查缓存
  if (
    routesCache &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_DURATION
  ) {
    return routesCache;
  }

  try {
    const response = await axios.get<NamespaceResponse>(
      `${DEFAULT_RSSHUB_INSTANCE}/api/namespace`,
      {
        timeout: 30000,
      }
    );

    const allRoutes: RouteInfo[] = [];

    // 解析所有命名空间和路由
    for (const [namespace, data] of Object.entries(response.data)) {
      for (const [routePath, routeData] of Object.entries(data.routes)) {
        allRoutes.push({
          path: routePath,
          name: routeData.name || "",
          url: routeData.url || data.url || "",
          maintainers: routeData.maintainers || [],
          example: routeData.example || "",
          parameters: routeData.parameters || {},
          description: routeData.description || "",
          categories: routeData.categories || data.categories || [],
          namespace: namespace,
          namespaceName: data.name || "",
        });
      }
    }

    // 更新缓存
    routesCache = allRoutes;
    cacheTimestamp = Date.now();

    return allRoutes;
  } catch (error) {
    // 如果获取失败但有旧缓存，使用旧缓存
    if (routesCache) {
      console.error("获取路由失败，使用缓存数据", error);
      return routesCache;
    }
    throw error;
  }
}

// 模糊搜索路由
function searchRoutes(routes: RouteInfo[], query: string): RouteInfo[] {
  const lowerQuery = query.toLowerCase();

  return routes
    .filter((route) => {
      // 搜索命名空间、名称、路径、描述、URL
      return (
        route.namespace.toLowerCase().includes(lowerQuery) ||
        route.namespaceName.toLowerCase().includes(lowerQuery) ||
        route.name.toLowerCase().includes(lowerQuery) ||
        route.path.toLowerCase().includes(lowerQuery) ||
        route.description?.toLowerCase().includes(lowerQuery) ||
        route.url.toLowerCase().includes(lowerQuery) ||
        route.categories.some((cat) => cat.toLowerCase().includes(lowerQuery))
      );
    })
    .slice(0, 50); // 限制返回结果数量
}

// 创建服务器实例
const server = new Server(
  {
    name: "rsshub-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_rsshub_feed",
        description:
          "获取 RSSHub 订阅源内容。通过 HTTP 请求获取各种网站的 RSS feed，如 Bilibili、Twitter、GitHub 等。使用环境变量 RSSHUB_INSTANCE 配置自定义实例。",
        inputSchema: {
          type: "object",
          properties: {
            route: {
              type: "string",
              description:
                "RSSHub 路由路径，例如 '/bilibili/bangumi/media/9192' 或 '/telegram/channel/awesomeRSSHub'。路由格式参考 RSSHub 文档。",
            },
            params: {
              type: "object",
              description:
                "可选的通用参数，如 limit(条目数量)、filter(过滤规则)、filterout(排除规则) 等。",
              additionalProperties: true,
            },
          },
          required: ["route"],
        },
      },
      {
        name: "search_rsshub_routes",
        description:
          "搜索 RSSHub 路由。支持按关键词模糊搜索，可以搜索平台名称、路由名称、分类等。会自动从 RSSHub API 获取最新路由并缓存。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "搜索关键词，支持平台名称（如 'bilibili'、'github'）、分类（如 'social-media'）、路由名称等",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_rsshub_feed") {
      if (!args) {
        throw new Error("缺少必需的参数");
      }
      const route = args.route as string;
      const params = (args.params as Record<string, string>) || {};

      // 确保路由以 / 开头
      const normalizedRoute = route.startsWith("/") ? route : `/${route}`;

      // 构建完整 URL
      const baseUrl = DEFAULT_RSSHUB_INSTANCE.endsWith("/")
        ? DEFAULT_RSSHUB_INSTANCE.slice(0, -1)
        : DEFAULT_RSSHUB_INSTANCE;
      const url = new URL(`${baseUrl}${normalizedRoute}`);

      // 添加查询参数
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.error(`[RSSHub MCP] 正在请求: ${url.toString()}`);
      const startTime = Date.now();

      // 获取 RSS feed - 60 秒超时
      const response = await axios.get(url.toString(), {
        headers: {
          "User-Agent": "RSSHub-MCP/1.0",
        },
        timeout: 60000, // 60 秒超时
        maxContentLength: 50 * 1024 * 1024, // 50MB 最大响应大小
        validateStatus: (status) => status < 600, // 接受所有 < 600 的状态码
      });

      const duration = Date.now() - startTime;
      console.error(
        `[RSSHub MCP] 请求完成: ${response.status} (${duration}ms)`
      );

      // 如果是错误状态码，提供更详细的错误信息
      if (response.status >= 400) {
        const errorInfo: any = {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          error: "RSSHub 服务器返回错误",
        };

        // 根据不同的错误状态码提供不同的建议
        if (response.status === 404) {
          errorInfo.message =
            "路由不存在。请使用 search_rsshub_routes 工具搜索正确的路由。";
          errorInfo.suggestion = `尝试搜索相关路由，例如: search_rsshub_routes(query="${route.split("/")[1]}")`;
        } else if (response.status === 502 || response.status === 503) {
          errorInfo.message =
            "RSSHub 服务器暂时不可用或上游服务出现问题。";
          errorInfo.suggestion = DEFAULT_RSSHUB_INSTANCE.includes("rsshub.app")
            ? "公共实例 rsshub.app 当前负载较高。建议：1) 稍后重试 2) 自部署 RSSHub 实例（5分钟 Docker 部署）"
            : "这通常是临时性问题，请稍后重试。如果问题持续，可能是上游网站暂时无法访问。";
          errorInfo.possibleReasons = [
            "RSSHub 服务器负载过高",
            "上游网站响应超时或出错",
            "网络连接问题",
          ];
        } else if (response.status === 500) {
          errorInfo.message = "RSSHub 服务器内部错误。";
          errorInfo.suggestion = "路由可能存在 bug，或者所需的参数不正确。";
        }

        // 尝试包含响应数据（如果是文本）
        if (
          typeof response.data === "string" &&
          response.data.length < 1000
        ) {
          errorInfo.responseData = response.data;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorInfo, null, 2),
            },
          ],
          isError: true,
        };
      }

      // 成功响应
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                url: url.toString(),
                instance: DEFAULT_RSSHUB_INSTANCE,
                status: response.status,
                contentType: response.headers["content-type"],
                requestDuration: `${duration}ms`,
                data: response.data,
              },
              null,
              2
            ),
          },
        ],
      };
    } else if (name === "search_rsshub_routes") {
      if (!args) {
        throw new Error("缺少必需的参数");
      }
      const query = args.query as string;

      // 获取所有路由
      const allRoutes = await fetchAllRoutes();

      // 搜索路由
      const matchedRoutes = searchRoutes(allRoutes, query);

      let output = `# RSSHub 路由搜索结果: "${query}"\n\n`;
      output += `找到 ${matchedRoutes.length} 个匹配的路由`;
      if (matchedRoutes.length >= 50) {
        output += `（仅显示前 50 个）`;
      }
      output += `\n\n`;

      if (matchedRoutes.length === 0) {
        output += `未找到匹配 "${query}" 的路由。\n\n`;
        output += `## 建议\n\n`;
        output += `- 尝试使用更通用的关键词\n`;
        output += `- 使用英文关键词搜索\n`;
        output += `- 访问完整路由文档：https://docs.rsshub.app/\n`;
      } else {
        // 按命名空间分组显示
        const groupedByNamespace = matchedRoutes.reduce((acc, route) => {
          const key = route.namespaceName || route.namespace;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(route);
          return acc;
        }, {} as Record<string, RouteInfo[]>);

        for (const [namespaceName, routes] of Object.entries(
          groupedByNamespace
        )) {
          output += `## ${namespaceName}\n\n`;

          for (const route of routes) {
            output += `### ${route.name || route.path}\n\n`;
            output += `- **路由**: \`${route.path}\`\n`;
            if (route.example) {
              output += `- **示例**: \`${route.example}\`\n`;
              output += `- **完整 URL**: \`${DEFAULT_RSSHUB_INSTANCE}${route.example}\`\n`;
            }
            if (route.description) {
              output += `- **描述**: ${route.description.substring(0, 200)}${route.description.length > 200 ? "..." : ""}\n`;
            }
            if (route.categories.length > 0) {
              output += `- **分类**: ${route.categories.join(", ")}\n`;
            }
            if (route.url) {
              output += `- **网站**: ${route.url}\n`;
            }
            if (route.maintainers.length > 0) {
              output += `- **维护者**: ${route.maintainers.join(", ")}\n`;
            }

            // 显示参数说明
            if (route.parameters && Object.keys(route.parameters).length > 0) {
              output += `- **参数**:\n`;
              for (const [param, desc] of Object.entries(route.parameters)) {
                output += `  - \`${param}\`: ${desc}\n`;
              }
            }

            output += `\n`;
          }
        }

        output += `\n---\n\n`;
        output += `💡 **提示**: 使用 \`get_rsshub_feed\` 工具获取具体的订阅内容\n\n`;
      }

      output += `📚 更多信息请访问 [RSSHub 文档](https://docs.rsshub.app/)\n`;

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error) {
    console.error(`[RSSHub MCP] 错误:`, error);

    // 处理 axios 错误（用于 search_rsshub_routes 的 API 调用）
    if (axios.isAxiosError(error)) {
      const errorInfo: any = {
        error: "API 请求失败",
        message: error.message,
      };

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        errorInfo.suggestion = "网络超时，请检查网络连接或稍后重试";
      } else if (error.response) {
        errorInfo.status = error.response.status;
        errorInfo.suggestion =
          "无法获取路由列表，这不影响本地 RSSHub 功能的使用";
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorInfo, null, 2),
          },
        ],
        isError: true,
      };
    }

    // 处理 RSSHub 本地错误
    const errorInfo: any = {
      error: "RSSHub 处理失败",
      message: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.constructor.name : "Unknown",
    };

    // 尝试提供有用的建议
    const errorMsg = errorInfo.message.toLowerCase();
    if (errorMsg.includes("not found") || errorMsg.includes("404")) {
      errorInfo.suggestion =
        "路由不存在。请使用 search_rsshub_routes 工具搜索正确的路由。";
    } else if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
      errorInfo.suggestion =
        "上游网站响应超时。建议稍后重试，或检查目标网站是否可访问。";
    } else if (
      errorMsg.includes("network") ||
      errorMsg.includes("enotfound")
    ) {
      errorInfo.suggestion = "网络连接问题。请检查网络连接和防火墙设置。";
    } else {
      errorInfo.suggestion =
        "路由处理出错。可能是路由参数不正确，或上游网站结构发生变化。";
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorInfo, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RSSHub MCP Server 已启动");
}

main().catch((error) => {
  console.error("服务器启动失败:", error);
  process.exit(1);
});

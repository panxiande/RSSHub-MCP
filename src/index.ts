#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import os from "os";

// RSSHub instance configuration (supports environment variable)
const DEFAULT_RSSHUB_INSTANCE =
  process.env.RSSHUB_INSTANCE || "https://rsshub.app";

console.error(
  `[RSSHub MCP] Using RSSHub instance: ${DEFAULT_RSSHUB_INSTANCE}`
);

// Route cache
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
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache

// Subscription management
interface Subscription {
  id: string;
  route: string;
  name?: string;
  params?: Record<string, string>;
  createdAt: string;
}

// Subscription data directory
const DATA_DIR = process.env.RSSHUB_MCP_DATA_DIR ||
  path.join(os.homedir(), ".rsshub-mcp");
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "subscriptions.json");

// Load subscriptions from file
async function loadSubscriptions(): Promise<Subscription[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// Save subscriptions to file
async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    SUBSCRIPTIONS_FILE,
    JSON.stringify(subscriptions, null, 2),
    "utf-8"
  );
}

// Fetch all routes
async function fetchAllRoutes(): Promise<RouteInfo[]> {
  // Check cache
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

    // Parse all namespaces and routes
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

    // Update cache
    routesCache = allRoutes;
    cacheTimestamp = Date.now();

    return allRoutes;
  } catch (error) {
    // If fetch fails but has old cache, use old cache
    if (routesCache) {
      console.error("Failed to fetch routes, using cached data", error);
      return routesCache;
    }
    throw error;
  }
}

// Fuzzy search routes
function searchRoutes(routes: RouteInfo[], query: string): RouteInfo[] {
  const lowerQuery = query.toLowerCase();

  return routes
    .filter((route) => {
      // Search namespace, name, path, description, URL
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
    .slice(0, 50); // Limit results count
}

// Create server instance
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_feed",
        description:
          "Get RSSHub feed content. If route is provided, fetch specific feed. If no route is provided, fetch all subscribed feeds. Use RSSHUB_INSTANCE environment variable to configure custom instance.",
        inputSchema: {
          type: "object",
          properties: {
            route: {
              type: "string",
              description:
                "Optional RSSHub route path, e.g., '/bilibili/bangumi/media/9192'. If omitted, returns all subscribed feeds.",
            },
            params: {
              type: "object",
              description:
                "Optional general parameters, such as limit (number of items), filter (filtering rules), filterout (exclusion rules), etc.",
              additionalProperties: true,
            },
          },
          required: [],
        },
      },
      {
        name: "search_routes",
        description:
          "Search RSSHub routes. Support fuzzy search by keywords, can search platform names, route names, categories, etc. Automatically fetches latest routes from RSSHub API and caches them.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search keyword, supports platform names (e.g., 'bilibili', 'github'), categories (e.g., 'social-media'), route names, etc.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "subscribe",
        description:
          "Subscribe to an RSSHub feed. Add a route to your subscription list for easy access later.",
        inputSchema: {
          type: "object",
          properties: {
            route: {
              type: "string",
              description:
                "RSSHub route path to subscribe to, e.g., '/bilibili/bangumi/media/9192'",
            },
            name: {
              type: "string",
              description:
                "Optional friendly name for this subscription, e.g., 'Bilibili Anime'",
            },
            params: {
              type: "object",
              description:
                "Optional default parameters for this subscription",
              additionalProperties: true,
            },
          },
          required: ["route"],
        },
      },
      {
        name: "unsubscribe",
        description:
          "Unsubscribe from an RSSHub feed. Remove a subscription by ID or route.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Subscription ID to remove",
            },
            route: {
              type: "string",
              description: "Or route path to unsubscribe from",
            },
          },
          required: [],
        },
      },
      {
        name: "list_subscriptions",
        description:
          "List all RSS feed subscriptions. Shows all subscribed routes with their details.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_feed") {
      const route = args?.route as string | undefined;
      const params = (args?.params as Record<string, string>) || {};

      // If no route provided, fetch all subscriptions
      if (!route) {
        const subscriptions = await loadSubscriptions();

        if (subscriptions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  message: "No subscriptions found",
                  suggestion: "Use the 'subscribe' tool to add feeds to your subscription list",
                  subscriptionCount: 0,
                }, null, 2),
              },
            ],
          };
        }

        // Fetch all subscription feeds
        const results = [];
        for (const sub of subscriptions) {
          try {
            const normalizedRoute = sub.route.startsWith("/")
              ? sub.route
              : `/${sub.route}`;

            const baseUrl = DEFAULT_RSSHUB_INSTANCE.endsWith("/")
              ? DEFAULT_RSSHUB_INSTANCE.slice(0, -1)
              : DEFAULT_RSSHUB_INSTANCE;
            const url = new URL(`${baseUrl}${normalizedRoute}`);

            // Add subscription params and override with call params
            const allParams = { ...sub.params, ...params };
            Object.entries(allParams).forEach(([key, value]) => {
              url.searchParams.append(key, String(value));
            });

            console.error(`[RSSHub MCP] Fetching subscription: ${sub.name || sub.route}`);
            const response = await axios.get(url.toString(), {
              headers: { "User-Agent": "RSSHub-MCP/1.0" },
              timeout: 60000,
              maxContentLength: 50 * 1024 * 1024,
              validateStatus: (status) => status < 600,
            });

            results.push({
              subscription: {
                id: sub.id,
                name: sub.name,
                route: sub.route,
              },
              url: url.toString(),
              status: response.status,
              success: response.status < 400,
              data: response.status < 400 ? response.data : null,
              error: response.status >= 400 ? response.statusText : null,
            });
          } catch (error) {
            results.push({
              subscription: {
                id: sub.id,
                name: sub.name,
                route: sub.route,
              },
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: `Fetched ${results.length} subscription(s)`,
                subscriptions: results,
              }, null, 2),
            },
          ],
        };
      }

      // Single route fetch (original behavior)
      const normalizedRoute = route.startsWith("/") ? route : `/${route}`;

      // Build complete URL
      const baseUrl = DEFAULT_RSSHUB_INSTANCE.endsWith("/")
        ? DEFAULT_RSSHUB_INSTANCE.slice(0, -1)
        : DEFAULT_RSSHUB_INSTANCE;
      const url = new URL(`${baseUrl}${normalizedRoute}`);

      // Add query parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.error(`[RSSHub MCP] Requesting: ${url.toString()}`);
      const startTime = Date.now();

      // Fetch RSS feed - 60 seconds timeout
      const response = await axios.get(url.toString(), {
        headers: {
          "User-Agent": "RSSHub-MCP/1.0",
        },
        timeout: 60000, // 60 seconds timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB max response size
        validateStatus: (status) => status < 600, // Accept all status codes < 600
      });

      const duration = Date.now() - startTime;
      console.error(
        `[RSSHub MCP] Request completed: ${response.status} (${duration}ms)`
      );

      // If error status code, provide more detailed error information
      if (response.status >= 400) {
        const errorInfo: any = {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          error: "RSSHub server returned error",
        };

        // Provide different suggestions based on status code
        if (response.status === 404) {
          errorInfo.message =
            "Route not found. Please use the search_routes tool to search for the correct route.";
          errorInfo.suggestion = `Try searching for related routes, e.g.: search_routes(query="${route.split("/")[1]}")`;
        } else if (response.status === 502 || response.status === 503) {
          errorInfo.message =
            "RSSHub server is temporarily unavailable or upstream service has issues.";
          errorInfo.suggestion = DEFAULT_RSSHUB_INSTANCE.includes("rsshub.app")
            ? "Public instance rsshub.app is currently under high load. Suggestions: 1) Retry later 2) Self-deploy RSSHub instance (5-minute Docker deployment)"
            : "This is usually a temporary issue. Please retry later. If the problem persists, the upstream website may be temporarily inaccessible.";
          errorInfo.possibleReasons = [
            "RSSHub server overloaded",
            "Upstream website timeout or error",
            "Network connection issues",
          ];
        } else if (response.status === 500) {
          errorInfo.message = "RSSHub server internal error.";
          errorInfo.suggestion =
            "The route may have a bug, or the required parameters are incorrect.";
        }

        // Try to include response data (if it's text)
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

      // Success response
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
    } else if (name === "search_routes") {
      if (!args) {
        throw new Error("Missing required parameters");
      }
      const query = args.query as string;

      // Fetch all routes
      const allRoutes = await fetchAllRoutes();

      // Search routes
      const matchedRoutes = searchRoutes(allRoutes, query);

      let output = `# RSSHub Route Search Results: "${query}"\n\n`;
      output += `Found ${matchedRoutes.length} matching route(s)`;
      if (matchedRoutes.length >= 50) {
        output += ` (showing first 50 only)`;
      }
      output += `\n\n`;

      if (matchedRoutes.length === 0) {
        output += `No routes matching "${query}" found.\n\n`;
        output += `## Suggestions\n\n`;
        output += `- Try using more generic keywords\n`;
        output += `- Use English keywords for search\n`;
        output += `- Visit complete route documentation: https://docs.rsshub.app/\n`;
      } else {
        // Group by namespace
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
            output += `- **Route**: \`${route.path}\`\n`;
            if (route.example) {
              output += `- **Example**: \`${route.example}\`\n`;
              output += `- **Full URL**: \`${DEFAULT_RSSHUB_INSTANCE}${route.example}\`\n`;
            }
            if (route.description) {
              output += `- **Description**: ${route.description.substring(0, 200)}${route.description.length > 200 ? "..." : ""}\n`;
            }
            if (route.categories.length > 0) {
              output += `- **Categories**: ${route.categories.join(", ")}\n`;
            }
            if (route.url) {
              output += `- **Website**: ${route.url}\n`;
            }
            if (route.maintainers.length > 0) {
              output += `- **Maintainers**: ${route.maintainers.join(", ")}\n`;
            }

            // Show parameter descriptions
            if (route.parameters && Object.keys(route.parameters).length > 0) {
              output += `- **Parameters**:\n`;
              for (const [param, desc] of Object.entries(route.parameters)) {
                output += `  - \`${param}\`: ${desc}\n`;
              }
            }

            output += `\n`;
          }
        }

        output += `\n---\n\n`;
        output += `💡 **Tip**: Use the \`get_feed\` tool to fetch specific feed content\n\n`;
      }

      output += `📚 For more information, visit [RSSHub Documentation](https://docs.rsshub.app/)\n`;

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } else if (name === "subscribe") {
      if (!args || !args.route) {
        throw new Error("Missing required parameter: route");
      }

      const route = args.route as string;
      const name_param = args.name as string | undefined;
      const params = (args.params as Record<string, string>) || undefined;

      const subscriptions = await loadSubscriptions();

      // Check if already subscribed
      const existing = subscriptions.find((s) => s.route === route);
      if (existing) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Already subscribed to this route",
                subscription: existing,
              }, null, 2),
            },
          ],
        };
      }

      // Create new subscription
      const newSubscription: Subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        route: route,
        name: name_param,
        params: params,
        createdAt: new Date().toISOString(),
      };

      subscriptions.push(newSubscription);
      await saveSubscriptions(subscriptions);

      console.error(`[RSSHub MCP] Added subscription: ${route}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Successfully subscribed",
              subscription: newSubscription,
              totalSubscriptions: subscriptions.length,
            }, null, 2),
          },
        ],
      };
    } else if (name === "unsubscribe") {
      const id = args?.id as string | undefined;
      const route = args?.route as string | undefined;

      if (!id && !route) {
        throw new Error("Must provide either 'id' or 'route' parameter");
      }

      const subscriptions = await loadSubscriptions();
      const initialLength = subscriptions.length;

      // Filter out the subscription
      const filtered = subscriptions.filter((s) => {
        if (id) {
          return s.id !== id;
        }
        if (route) {
          return s.route !== route;
        }
        return true;
      });

      if (filtered.length === initialLength) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Subscription not found",
                searched: id ? { id } : { route },
              }, null, 2),
            },
          ],
        };
      }

      await saveSubscriptions(filtered);

      const removed = initialLength - filtered.length;
      console.error(`[RSSHub MCP] Removed ${removed} subscription(s)`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: `Successfully unsubscribed`,
              removedCount: removed,
              remainingSubscriptions: filtered.length,
            }, null, 2),
          },
        ],
      };
    } else if (name === "list_subscriptions") {
      const subscriptions = await loadSubscriptions();

      if (subscriptions.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "No subscriptions found",
                suggestion: "Use the 'subscribe' tool to add feeds to your subscription list",
                subscriptionCount: 0,
              }, null, 2),
            },
          ],
        };
      }

      let output = `# RSS Feed Subscriptions\n\n`;
      output += `Total subscriptions: ${subscriptions.length}\n\n`;

      for (const sub of subscriptions) {
        output += `## ${sub.name || sub.route}\n\n`;
        output += `- **ID**: \`${sub.id}\`\n`;
        output += `- **Route**: \`${sub.route}\`\n`;
        output += `- **Full URL**: \`${DEFAULT_RSSHUB_INSTANCE}${sub.route}\`\n`;
        if (sub.name) {
          output += `- **Name**: ${sub.name}\n`;
        }
        if (sub.params && Object.keys(sub.params).length > 0) {
          output += `- **Default Parameters**:\n`;
          for (const [key, value] of Object.entries(sub.params)) {
            output += `  - \`${key}\`: ${value}\n`;
          }
        }
        output += `- **Created**: ${new Date(sub.createdAt).toLocaleString()}\n`;
        output += `\n`;
      }

      output += `\n---\n\n`;
      output += `💡 **Tip**: Use \`get_feed()\` without parameters to fetch all subscribed feeds\n`;

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`[RSSHub MCP] Error:`, error);

    // Handle axios errors (for search_routes API calls)
    if (axios.isAxiosError(error)) {
      const errorInfo: any = {
        error: "API request failed",
        message: error.message,
      };

      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        errorInfo.suggestion =
          "Network timeout, please check network connection or try again later";
      } else if (error.response) {
        errorInfo.status = error.response.status;
        errorInfo.suggestion =
          "Failed to fetch route list, this does not affect RSSHub functionality";
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

    // Handle RSSHub errors
    const errorInfo: any = {
      error: "RSSHub processing failed",
      message: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.constructor.name : "Unknown",
    };

    // Try to provide helpful suggestions
    const errorMsg = errorInfo.message.toLowerCase();
    if (errorMsg.includes("not found") || errorMsg.includes("404")) {
      errorInfo.suggestion =
        "Route not found. Please use the search_routes tool to search for the correct route.";
    } else if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
      errorInfo.suggestion =
        "Upstream website timeout. Please retry later or check if the target website is accessible.";
    } else if (
      errorMsg.includes("network") ||
      errorMsg.includes("enotfound")
    ) {
      errorInfo.suggestion =
        "Network connection issue. Please check network connection and firewall settings.";
    } else {
      errorInfo.suggestion =
        "Route processing error. The route parameters may be incorrect, or the upstream website structure has changed.";
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RSSHub MCP Server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

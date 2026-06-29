#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS_MANIFEST, callTool } from './mcpServer.js';
import { MCP_RESOURCES, readMcpResource } from './resources.js';

export const MCP_SERVER_INFO = Object.freeze({
  name: 'agentbl-mcp-server',
  version: '2.0.0'
});

export function createAgentBlMcpServer() {
  const server = new Server(MCP_SERVER_INFO, {
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false }
    },
    instructions: [
      'Use get_trade_case before pricing or document verification.',
      'Chain writes default to dry-run and require explicit human approval.',
      'Paid-report provenance may be added to evidence, but payment never changes risk or price.'
    ].join(' ')
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOLS_MANIFEST.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
      annotations: {
        readOnlyHint: !['push_pricing_to_oracle', 'purchase_premium_analysis'].includes(name),
        destructiveHint: false,
        idempotentHint: name !== 'purchase_premium_analysis',
        openWorldHint: name === 'purchase_premium_analysis'
      }
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await callTool(request.params.name, request.params.arguments ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: false,
            tool: request.params.name,
            code: error.code ?? 'tool_error',
            error: error.message
          })
        }],
        isError: true
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: MCP_RESOURCES }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => readMcpResource(request.params.uri));
  return server;
}

export async function startAgentBlStdioServer() {
  const server = createAgentBlMcpServer();
  const transport = new StdioServerTransport();
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  await server.connect(transport);
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntryPoint) {
  startAgentBlStdioServer().catch((error) => {
    process.stderr.write(`AgentBL MCP startup failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

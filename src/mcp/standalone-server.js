#!/usr/bin/env node

/**
 * AgentBL MCP Standalone Server — stdio transport
 *
 * A real MCP (Model Context Protocol) server that exposes AgentBL's
 * AI pricing engine tools to any MCP-compatible client (Claude Code,
 * Cursor, Continue, etc.).
 *
 * Protocol: MCP 2024-11-05 (JSON-RPC 2.0 over stdio)
 * Inspired by: hermes-pay (AgentVault) MCP Server architecture
 *
 * Usage:
 *   node src/mcp/standalone-server.js                    # direct
 *   npx @modelcontextprotocol/inspector node src/mcp/standalone-server.js  # debug
 *
 * Or add to Claude Code via mcp-config.json.
 */

import readline from 'node:readline';
import {
  MCP_TOOLS_MANIFEST,
  MCP_TOOL_HANDLERS
} from './mcpServer.js';

// ──────────────────────────────────────────────
// Server identity
// ──────────────────────────────────────────────
const SERVER_INFO = {
  name: 'agentbl-mcp-server',
  version: '1.0.0',
  protocolVersion: '2024-11-05'
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
  resources: { subscribe: false, listChanged: false }
};

// ──────────────────────────────────────────────
// Resources (like hermes-pay's wallet://status etc.)
// ──────────────────────────────────────────────
const RESOURCES = [
  {
    uri: 'agentbl://cases',
    name: 'Trade Case Catalog',
    description: 'List of all available trade financing cases with labels and risk hints',
    mimeType: 'application/json'
  },
  {
    uri: 'agentbl://pricing/{case_id}',
    name: 'Latest Pricing Quote',
    description: 'The most recent AI pricing quote for a given trade case',
    mimeType: 'application/json'
  },
  {
    uri: 'agentbl://risk-intel/{query}',
    name: 'Risk Intelligence Search',
    description: 'Search the risk intelligence knowledge base for macro and cargo risk events',
    mimeType: 'application/json'
  }
];

// ──────────────────────────────────────────────
// JSON-RPC handlers
// ──────────────────────────────────────────────
async function handleInitialize(params) {
  return {
    protocolVersion: SERVER_INFO.protocolVersion,
    capabilities: SERVER_CAPABILITIES,
    serverInfo: SERVER_INFO
  };
}

async function handleToolsList() {
  return {
    tools: MCP_TOOLS_MANIFEST.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
}

async function handleToolCall(params) {
  const { name, arguments: args } = params;
  if (!name) throw { code: -32602, message: 'Missing tool name' };

  const handler = MCP_TOOL_HANDLERS[name];
  if (!handler) {
    return {
      content: [{
        type: 'text',
        text: `Error: Unknown tool "${name}". Available: ${Object.keys(MCP_TOOL_HANDLERS).join(', ')}`
      }],
      isError: true
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Tool "${name}" error: ${error.message}`
      }],
      isError: true
    };
  }
}

async function handleResourcesList() {
  return { resources: RESOURCES };
}

async function handleResourceRead(params) {
  const { uri } = params;
  if (!uri) throw { code: -32602, message: 'Missing uri' };

  // Route URI to data source
  if (uri === 'agentbl://cases') {
    // Dynamic import for case catalog
    const { listHarnessCaseFiles } = await import('../core/scenarioRunner.js');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const files = await listHarnessCaseFiles({ includeDemo: true });
    const cases = [];
    for (const file of files) {
      try {
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        cases.push({ case_id: data.case_id, cargo: data.bill_of_lading?.cargo, route: `${data.bill_of_lading?.port_of_loading} → ${data.bill_of_lading?.port_of_discharge}` });
      } catch { /* skip */ }
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ cases, count: cases.length }, null, 2)
      }]
    };
  }

  if (uri.startsWith('agentbl://pricing/')) {
    const caseId = uri.replace('agentbl://pricing/', '');
    if (!caseId) throw { code: -32602, message: 'Missing case_id in URI' };

    try {
      const result = await MCP_TOOL_HANDLERS.generate_pricing_quote({ case_id: caseId });
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (e) {
      throw { code: -32000, message: `Pricing failed for ${caseId}: ${e.message}` };
    }
  }

  if (uri.startsWith('agentbl://risk-intel/')) {
    const query = decodeURIComponent(uri.replace('agentbl://risk-intel/', ''));
    const result = await MCP_TOOL_HANDLERS.search_knowledge_base({ query, limit: 5 });
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  throw { code: -32000, message: `Unknown resource: ${uri}` };
}

// ──────────────────────────────────────────────
// JSON-RPC dispatcher
// ──────────────────────────────────────────────
async function dispatch(request) {
  const { id, method, params } = request;

  // Notification (no id) — don't respond
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') return null;
    return null;
  }

  const respond = (result) => ({ jsonrpc: '2.0', id, result });
  const error = (code, message, data) => ({
    jsonrpc: '2.0',
    id,
    error: { code, message, data }
  });

  try {
    switch (method) {
      case 'initialize':
        return respond(await handleInitialize(params));
      case 'tools/list':
        return respond(await handleToolsList());
      case 'tools/call':
        return respond(await handleToolCall(params));
      case 'resources/list':
        return respond(await handleResourcesList());
      case 'resources/read':
        return respond(await handleResourceRead(params));
      case 'ping':
        return respond({});
      default:
        return error(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return error(e.code || -32000, e.message || 'Internal error');
  }
}

// ──────────────────────────────────────────────
// stdio transport
// ──────────────────────────────────────────────
function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Buffer for partial reads
  let buffer = '';

  rl.on('line', async (line) => {
    buffer += line;

    // Try to parse complete JSON-RPC messages
    while (buffer.length > 0) {
      // Look for a complete JSON object
      const trimmed = buffer.trim();
      if (!trimmed.startsWith('{')) {
        buffer = '';
        break;
      }

      let depth = 0;
      let end = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++;
        else if (trimmed[i] === '}') depth--;
        if (depth === 0) { end = i + 1; break; }
      }

      if (end === -1) break; // Incomplete — wait for more

      const jsonStr = trimmed.slice(0, end);
      buffer = trimmed.slice(end);

      try {
        const request = JSON.parse(jsonStr);
        const response = await dispatch(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (parseError) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error: ' + parseError.message }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Log startup to stderr (stdio channel is for JSON-RPC only)
  process.stderr.write(`AgentBL MCP Server v${SERVER_INFO.version} ready (stdio)\n`);
  process.stderr.write(`  Tools: ${MCP_TOOLS_MANIFEST.length}  Resources: ${RESOURCES.length}\n`);
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
startStdioServer();

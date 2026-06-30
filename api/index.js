// Vercel Serverless Function — 适配 AgentBL server 到 Vercel 环境
// Vercel 运行时：@vercel/node (ESM)
// 处理所有请求

import { handleRequest } from '../src/app/server.js';

export default async function handler(req, res) {
  try {
    // 适配 Vercel 的请求/响应对象到 Node.js http 格式
    // Vercel 使用的是兼容 Node.js http 的对象，所以可以直接传递
    await handleRequest(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

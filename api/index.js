// Vercel Serverless Function — 导入 TradeShield server 的请求处理器
// Vercel 运行时：@vercel/node (ESM)
// 处理所有 /api/* 请求

import { handleRequest } from '../src/app/server.js';

export default handleRequest;

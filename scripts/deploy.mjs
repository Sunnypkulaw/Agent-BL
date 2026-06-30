#!/usr/bin/env node

/**
 * AgentBL 快速部署脚本
 * 用途：一键部署到 Vercel
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 AgentBL 部署向导\n');

// 检查是否安装了 Vercel CLI
function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 检查是否在 Git 仓库中
function checkGit() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore', cwd: rootDir });
    return true;
  } catch {
    return false;
  }
}

// 检查环境变量
function checkEnvVars() {
  const envPath = join(rootDir, '.env');
  if (!existsSync(envPath)) {
    console.log('⚠️  警告: 未找到 .env 文件');
    return [];
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const vars = envContent
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=')[0].trim())
    .filter(Boolean);

  return vars;
}

console.log('📋 检查部署环境...\n');

// 1. 检查 Vercel CLI
const hasVercel = checkVercelCLI();
if (!hasVercel) {
  console.log('❌ 未安装 Vercel CLI');
  console.log('   安装命令: npm install -g vercel\n');
  process.exit(1);
}
console.log('✅ Vercel CLI 已安装');

// 2. 检查 Git
const hasGit = checkGit();
if (!hasGit) {
  console.log('⚠️  警告: 不在 Git 仓库中');
  console.log('   建议先初始化 Git 仓库\n');
} else {
  console.log('✅ Git 仓库已初始化');
}

// 3. 检查环境变量
const envVars = checkEnvVars();
if (envVars.length > 0) {
  console.log(`✅ 找到 ${envVars.length} 个环境变量`);
  console.log('   需要在 Vercel 中配置的变量:');
  envVars.slice(0, 5).forEach(v => console.log(`   - ${v}`));
  if (envVars.length > 5) {
    console.log(`   ... 还有 ${envVars.length - 5} 个`);
  }
} else {
  console.log('⚠️  警告: 未找到环境变量');
}

console.log('\n📦 准备部署...\n');

// 询问用户部署类型
console.log('请选择部署方式:');
console.log('1. 预览部署 (测试环境)');
console.log('2. 生产部署 (正式上线)');
console.log('');

const readline = await import('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('请输入选项 (1 或 2): ', (answer) => {
  rl.close();

  const isProd = answer.trim() === '2';
  const deployCommand = isProd ? 'vercel --prod' : 'vercel';

  console.log(`\n🚀 开始${isProd ? '生产' : '预览'}部署...\n`);

  try {
    execSync(deployCommand, {
      stdio: 'inherit',
      cwd: rootDir
    });

    console.log('\n✅ 部署成功!\n');

    if (envVars.length > 0) {
      console.log('⚠️  重要提醒:');
      console.log('   请在 Vercel 面板中配置环境变量:');
      console.log('   1. 访问 https://vercel.com');
      console.log('   2. 进入你的项目');
      console.log('   3. Settings → Environment Variables');
      console.log('   4. 添加以下变量:');
      envVars.forEach(v => console.log(`      - ${v}`));
      console.log('   5. 重新部署: vercel --prod\n');
    }

  } catch (error) {
    console.error('\n❌ 部署失败');
    console.error('   错误信息:', error.message);
    console.error('\n   请检查:');
    console.error('   1. 是否已登录 Vercel (vercel login)');
    console.error('   2. 网络连接是否正常');
    console.error('   3. 项目配置是否正确\n');
    process.exit(1);
  }
});

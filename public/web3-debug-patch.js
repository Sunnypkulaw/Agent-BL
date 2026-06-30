/**
 * Web3 调试补丁
 * 在 web3.js 中添加详细的调试日志
 *
 * 使用方法:
 * 1. 在 index.html 中，在 <script type="module" src="app.js"></script> 之前添加:
 *    <script type="module" src="web3-debug-patch.js"></script>
 * 2. 或者直接在浏览器控制台运行此脚本的内容
 */

// 拦截并增强 mintOnChain 函数
(function() {
  console.log('🔧 Web3 调试补丁已加载');

  // 保存原始的 console 方法
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  // 创建带时间戳的日志
  function logWithTime(level, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${level}]`;

    if (level === 'ERROR') {
      originalError.call(console, prefix, ...args);
    } else if (level === 'WARN') {
      originalWarn.call(console, prefix, ...args);
    } else {
      originalLog.call(console, prefix, ...args);
    }
  }

  // 暴露到 window 以便其他模块使用
  window.debugLog = (...args) => logWithTime('DEBUG', ...args);
  window.debugError = (...args) => logWithTime('ERROR', ...args);
  window.debugWarn = (...args) => logWithTime('WARN', ...args);

  // 监控 MetaMask 请求
  if (window.ethereum) {
    const originalRequest = window.ethereum.request;
    window.ethereum.request = async function(args) {
      if (args.method === 'eth_sendTransaction' || args.method === 'eth_estimateGas') {
        console.log('🦊 MetaMask 请求:', args.method);
        console.log('   参数:', JSON.stringify(args.params, null, 2));
      }

      try {
        const result = await originalRequest.call(this, args);
        if (args.method === 'eth_sendTransaction') {
          console.log('✅ 交易已发送:', result);
        }
        return result;
      } catch (error) {
        console.error('❌ MetaMask 请求失败:', args.method);
        console.error('   错误:', error);
        console.error('   错误代码:', error.code);
        console.error('   错误消息:', error.message);
        if (error.data) {
          console.error('   错误数据:', error.data);
        }
        throw error;
      }
    };

    console.log('✅ MetaMask 请求拦截器已安装');
  }

  // 添加全局错误处理
  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ 未捕获的 Promise 拒绝:');
    console.error('   原因:', event.reason);
    if (event.reason?.stack) {
      console.error('   堆栈:', event.reason.stack);
    }
  });

  // 导出诊断函数
  window.diagnoseRWAMint = function() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 RWA 铸造诊断报告');
    console.log('='.repeat(60));

    // 检查 state
    if (typeof state !== 'undefined') {
      console.log('\n📊 当前状态:');
      console.log('  - Case ID:', state.caseId);
      console.log('  - Financing USD:', state.financingUsd);
      console.log('  - Speed:', state.speed);

      // 检查 quote
      const quote = state.comparison?.quotes?.find(q => q.payout_speed === state.speed);
      if (quote) {
        console.log('\n💰 定价信息:');
        console.log('  - final_issue_price_usd:', quote.final_issue_price_usd);
        console.log('  - recommended_token_supply:', quote.recommended_token_supply);
        console.log('  - bl_id:', quote.bl_id);
        console.log('  - case_id:', quote.case_id);
        console.log('  - quote_hash:', quote.quote_hash);
        console.log('  - evidence_hash:', quote.evidence_hash);
        console.log('  - ai_verified_collateral_value_usd:', quote.ai_verified_collateral_value_usd);
        console.log('  - risk_score_bps:', quote.risk_score_bps);
        console.log('  - risk_level:', quote.risk_level);

        // 模拟参数转换
        console.log('\n🔧 转换后的链上参数:');
        const issuePriceE6 = Math.round(quote.final_issue_price_usd * 1e6);
        const tokenSupply = Math.max(1, Math.round(quote.recommended_token_supply || 0));
        const financingUsd = Math.max(0, Math.round(state.financingUsd || 0));
        const collateralValueUsd = Math.max(0, Math.round(quote.ai_verified_collateral_value_usd || 0));

        console.log('  - issuePriceE6:', issuePriceE6, issuePriceE6 === 0 ? '❌ 错误!' : '✅');
        console.log('  - tokenSupply:', tokenSupply, tokenSupply === 0 ? '❌ 错误!' : '✅');
        console.log('  - financingUsd:', financingUsd);
        console.log('  - collateralValueUsd:', collateralValueUsd);

        // 计算预期铸造量
        if (issuePriceE6 > 0) {
          const expectedMint = Math.floor((financingUsd * 1e6) / issuePriceE6);
          console.log('  - 预期铸造量:', expectedMint, 'RWA');
        }

        // 检查潜在问题
        console.log('\n⚠️  潜在问题检查:');
        const issues = [];

        if (issuePriceE6 === 0) {
          issues.push('❌ issuePriceE6 为 0 - 合约会拒绝交易!');
        }
        if (tokenSupply === 0) {
          issues.push('❌ tokenSupply 为 0 - 合约会拒绝交易!');
        }
        if (!quote.quote_hash || quote.quote_hash.length !== 66) {
          issues.push('⚠️  quote_hash 格式可能不正确');
        }
        if (!quote.evidence_hash || quote.evidence_hash.length !== 66) {
          issues.push('⚠️  evidence_hash 格式可能不正确');
        }
        if (financingUsd === 0) {
          issues.push('⚠️  融资金额为 0');
        }

        if (issues.length === 0) {
          console.log('  ✅ 未发现明显问题');
        } else {
          issues.forEach(issue => console.log('  ' + issue));
        }
      } else {
        console.log('\n❌ 未找到当前速度的 quote');
      }
    } else {
      console.log('\n❌ state 对象不可用');
    }

    // 检查钱包连接
    console.log('\n👛 钱包状态:');
    if (window.ethereum) {
      console.log('  - MetaMask 已安装: ✅');
      console.log('  - 已连接账户:', window.ethereum.selectedAddress || '未连接');
      console.log('  - Chain ID:', window.ethereum.chainId);

      if (window.ethereum.chainId !== '0x59f') {
        console.log('  ⚠️  警告: Chain ID 不是 0x59f (Injective Testnet 1439)');
      }
    } else {
      console.log('  - MetaMask: ❌ 未安装');
    }

    // 检查合约配置
    console.log('\n📜 合约配置:');
    fetch('/chain-config.json')
      .then(r => r.json())
      .then(config => {
        const network = config.networks?.['injective-testnet'];
        if (network) {
          console.log('  - 合约地址:', network.contracts?.AgentBLRWA || '未配置');
          console.log('  - RPC URL:', network.rpcUrls?.[0] || '未配置');
          console.log('  - Chain ID:', network.chainIdDecimal);
        }
      })
      .catch(e => console.error('  ❌ 无法加载配置:', e.message));

    console.log('\n' + '='.repeat(60));
    console.log('💡 提示: 如果发现问题，请截图此报告');
    console.log('='.repeat(60) + '\n');
  };

  // 导出测试函数
  window.testMintArgs = function() {
    if (typeof state === 'undefined') {
      console.error('❌ state 对象不可用');
      return;
    }

    const quote = state.comparison?.quotes?.find(q => q.payout_speed === state.speed);
    if (!quote) {
      console.error('❌ 未找到 quote');
      return;
    }

    console.log('🧪 测试铸造参数生成...');

    // 模拟 mintArgsFromQuote
    const args = {
      blId: quote.bl_id ?? quote.case_id ?? 'EBL-DEMO',
      issuePriceE6: BigInt(Math.round(quote.final_issue_price_usd * 1e6)),
      tokenSupply: BigInt(Math.max(1, Math.round(quote.recommended_token_supply || 0))),
      financingUsd: BigInt(Math.max(0, Math.round(state.financingUsd || 0))),
      collateralValueUsd: BigInt(Math.max(0, Math.round(quote.ai_verified_collateral_value_usd || 0))),
      riskScoreBps: Math.max(0, Math.round(quote.risk_score_bps || 0)),
      riskLevel: ['LOW', 'MEDIUM', 'WARNING', 'CRITICAL'].indexOf(quote.risk_level),
      quoteHash: quote.quote_hash,
      evidenceHash: quote.evidence_hash
    };

    console.log('生成的参数:', {
      blId: args.blId,
      issuePriceE6: args.issuePriceE6.toString(),
      tokenSupply: args.tokenSupply.toString(),
      financingUsd: args.financingUsd.toString(),
      collateralValueUsd: args.collateralValueUsd.toString(),
      riskScoreBps: args.riskScoreBps,
      riskLevel: args.riskLevel,
      quoteHash: args.quoteHash,
      evidenceHash: args.evidenceHash
    });

    // 验证
    console.log('\n✅ 参数验证:');
    console.log('  - issuePriceE6 > 0:', args.issuePriceE6 > 0n ? '✅' : '❌');
    console.log('  - tokenSupply > 0:', args.tokenSupply > 0n ? '✅' : '❌');
    console.log('  - quoteHash 格式:', args.quoteHash?.startsWith('0x') && args.quoteHash.length === 66 ? '✅' : '❌');
    console.log('  - evidenceHash 格式:', args.evidenceHash?.startsWith('0x') && args.evidenceHash.length === 66 ? '✅' : '❌');

    return args;
  };

  console.log('\n✅ 调试工具已就绪!');
  console.log('💡 可用命令:');
  console.log('   - diagnoseRWAMint()  // 运行完整诊断');
  console.log('   - testMintArgs()     // 测试参数生成');
  console.log('');
})();

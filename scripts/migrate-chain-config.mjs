import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chainConfig from './lib/chain-config.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'chain-config.json');
const registry = chainConfig.readRegistry(target);
chainConfig.atomicWriteRegistry(target, registry);
console.log(`Migrated ${target} to ${chainConfig.SCHEMA} (${Object.keys(registry.networks).join(', ')})`);

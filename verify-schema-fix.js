#!/usr/bin/env node
/**
 * 验证脚本：检查 BotListClient 是否正确支持多适配器
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('BotListClient Schema 支持验证');
console.log('========================================\n');

// 1. 检查 BotListClient 是否接受 botConfigSchema props
console.log('1️⃣  检查 BotListClient Props 接口...');
const botListPath = path.join(process.cwd(), 'src/components/bot/bot-list-client.tsx');
const botListContent = fs.readFileSync(botListPath, 'utf-8');

if (botListContent.includes('botConfigSchema?: FormUISchema')) {
  console.log('   ✅ botConfigSchema prop 已添加');
} else {
  console.log('   ❌ botConfigSchema prop 未找到');
}

// 2. 检查是否使用了动态初始化
console.log('\n2️⃣  检查动态配置初始化...');
if (botListContent.includes('getInitialConfig')) {
  console.log('   ✅ getInitialConfig 函数已实现');
} else {
  console.log('   ❌ getInitialConfig 函数未找到');
}

// 3. 检查是否移除了硬编码的 accessToken/secret
console.log('\n3️⃣  检查硬编码字段移除...');
const accessTokenMatches = botListContent.match(/config\.accessToken/g) || [];
const secretMatches = botListContent.match(/config\.secret/g) || [];

console.log(`   硬编码 accessToken 引用数: ${accessTokenMatches.length}`);
console.log(`   硬编码 secret 引用数: ${secretMatches.length}`);

if (accessTokenMatches.length === 0 && secretMatches.length === 0) {
  console.log('   ✅ 硬编码字段已完全移除');
} else {
  console.log('   ⚠️  仍存在硬编码字段引用');
}

// 4. 检查是否使用了 schema 映射进行动态渲染
console.log('\n4️⃣  检查动态表单渲染...');
if (botListContent.includes('botConfigSchema?.fields?.map')) {
  console.log('   ✅ 动态表单渲染已实现');
} else {
  console.log('   ❌ 动态表单渲染未找到');
}

// 5. 验证 Discord 和 Telegram schemas
console.log('\n5️⃣  验证适配器 Schemas...');

const discordPath = path.join(process.cwd(), 'src/adapters/discord/adapter.ts');
const discordContent = fs.readFileSync(discordPath, 'utf-8');
const discordHasToken = discordContent.includes("name: 'token'");
const discordHasPublicKey = discordContent.includes("name: 'publicKey'");

console.log(`   Discord:`);
console.log(`     - token: ${discordHasToken ? '✅' : '❌'}`);
console.log(`     - publicKey: ${discordHasPublicKey ? '✅' : '❌'}`);

const telegramPath = path.join(process.cwd(), 'src/adapters/telegram/adapter.ts');
const telegramContent = fs.readFileSync(telegramPath, 'utf-8');
const telegramHasAccessToken = telegramContent.includes("name: 'accessToken'");
const telegramHasSecret = telegramContent.includes("name: 'secret'");

console.log(`   Telegram:`);
console.log(`     - accessToken: ${telegramHasAccessToken ? '✅' : '❌'}`);
console.log(`     - secret: ${telegramHasSecret ? '✅' : '❌'}`);

// 6. 检查 page.tsx 是否正确传递 schema
console.log('\n6️⃣  检查 page.tsx Schema 传递...');
const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/adapter/[platform]/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf-8');

if (pageContent.includes('botConfigUISchema = adapter.getBotConfigUISchema()')) {
  console.log('   ✅ Schema 提取已实现');
} else {
  console.log('   ⚠️  Schema 提取可能不完整');
}

if (pageContent.includes('botConfigSchema={botConfigUISchema}')) {
  console.log('   ✅ Schema 传递已实现');
} else {
  console.log('   ⚠️  Schema 传递可能不完整');
}

// 最终总结
console.log('\n========================================');
console.log('验证结果总结');
console.log('========================================');

const allChecks = [
  botListContent.includes('botConfigSchema?: FormUISchema'),
  botListContent.includes('getInitialConfig'),
  accessTokenMatches.length === 0 && secretMatches.length === 0,
  botListContent.includes('botConfigSchema?.fields?.map'),
  discordHasToken && discordHasPublicKey,
  telegramHasAccessToken && telegramHasSecret,
  pageContent.includes('botConfigUISchema = adapter.getBotConfigUISchema()'),
  pageContent.includes('botConfigSchema={botConfigUISchema}'),
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

console.log(`\n✅ 通过: ${passedChecks}/${totalChecks} 项检查`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 所有检查都通过了！BotListClient 已正确支持多适配器 Schema！');
} else {
  console.log(`\n⚠️  还有 ${totalChecks - passedChecks} 项检查未通过，请检查代码。`);
}

console.log('\n========================================\n');

#!/usr/bin/env node

/**
 * Telegram Webhook 配置脚本
 * 
 * 使用方法:
 * node scripts/setup-telegram-webhook.js <bot_token> <webhook_url> [secret]
 * 
 * 示例:
 * node scripts/setup-telegram-webhook.js 123456:ABC-DEF https://yourdomain.com/api/webhook/telegram/bot_xxx my_secret
 */

const BOT_TOKEN = process.argv[2];
const WEBHOOK_URL = process.argv[3];
const SECRET = process.argv[4] || '';

if (!BOT_TOKEN || !WEBHOOK_URL) {
  console.error('用法: node setup-telegram-webhook.js <bot_token> <webhook_url> [secret]');
  console.error('\n示例:');
  console.error('  node scripts/setup-telegram-webhook.js \\');
  console.error('    8013136106:AAGEVm_4P2us6SaNHKmrew-zz1g8Og0PTi0 \\');
  console.error('    https://yourdomain.com/api/webhook/telegram/bot_xxx \\');
  console.error('    my_secret_token');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setWebhook() {
  try {
    console.log('正在设置 Telegram Webhook...');
    console.log('Bot Token:', BOT_TOKEN.substring(0, 20) + '...');
    console.log('Webhook URL:', WEBHOOK_URL);
    if (SECRET) console.log('Secret Token:', SECRET);

    const params = {
      url: WEBHOOK_URL,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    };

    if (SECRET) {
      params.secret_token = SECRET;
    }

    const response = await fetch(`${API_BASE}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Webhook 设置成功!');
      console.log('响应:', data);
    } else {
      console.error('❌ Webhook 设置失败:', data.description);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

async function getWebhookInfo() {
  try {
    console.log('\n正在获取当前 Webhook 信息...');
    const response = await fetch(`${API_BASE}/getWebhookInfo`);
    const data = await response.json();

    if (data.ok) {
      console.log('当前 Webhook 信息:');
      console.log(JSON.stringify(data.result, null, 2));
    }
  } catch (error) {
    console.error('获取信息失败:', error.message);
  }
}

async function deleteWebhook() {
  try {
    console.log('\n正在删除旧的 Webhook...');
    const response = await fetch(`${API_BASE}/deleteWebhook?drop_pending_updates=true`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ 旧 Webhook 已删除');
    }
  } catch (error) {
    console.warn('删除旧 Webhook 失败 (可能不存在):', error.message);
  }
}

async function main() {
  await deleteWebhook();
  await setWebhook();
  await getWebhookInfo();
}

main();

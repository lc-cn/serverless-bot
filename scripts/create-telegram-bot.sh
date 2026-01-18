#!/bin/bash

# 创建 Telegram Bot 配置
# 用法: ./create-telegram-bot.sh <BOT_TOKEN> <BOT_ID> <API_URL>

BOT_TOKEN="${1}"
BOT_ID="${2:-zhin}"
API_URL="${3:-https://next.liucl.cn}"

if [ -z "$BOT_TOKEN" ]; then
    echo "❌ 错误: 缺少 BOT_TOKEN"
    echo "用法: $0 <BOT_TOKEN> [BOT_ID] [API_URL]"
    exit 1
fi

echo "📱 创建 Telegram Bot 配置"
echo "========================"
echo "Bot ID: $BOT_ID"
echo "API URL: $API_URL"
echo ""

# 1. 先确保适配器已启用
echo "1️⃣  启用 Telegram 适配器..."
curl -s -X POST "${API_URL}/api/adapters" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "telegram",
    "name": "Telegram",
    "description": "Telegram Bot API 适配器",
    "enabled": true,
    "config": {}
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo ""

# 2. 创建 Bot 配置
echo "2️⃣  创建 Bot 配置..."
RESPONSE=$(curl -s -X POST "${API_URL}/api/adapters/telegram/bots" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"${BOT_ID}\",
    \"platform\": \"telegram\",
    \"name\": \"Telegram Bot\",
    \"enabled\": true,
    \"config\": {
      \"accessToken\": \"${BOT_TOKEN}\"
    }
  }")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo ""
echo ""

# 3. 更新 Webhook URL
NEW_WEBHOOK_URL="${API_URL}/api/webhook/telegram/${BOT_ID}"
echo "3️⃣  更新 Webhook URL 为: $NEW_WEBHOOK_URL"
echo ""

SET_WEBHOOK=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${NEW_WEBHOOK_URL}\"}")

if echo "$SET_WEBHOOK" | grep -q '"ok":true'; then
    echo "✅ Webhook 更新成功！"
else
    echo "❌ Webhook 更新失败"
    echo "$SET_WEBHOOK"
fi

echo ""
echo "✅ 配置完成！"
echo ""
echo "📋 Webhook URL: $NEW_WEBHOOK_URL"

#!/bin/bash

# Telegram Webhook 设置脚本
# 用法: ./setup-telegram-webhook.sh <BOT_TOKEN> <WEBHOOK_URL>

BOT_TOKEN="${1}"
WEBHOOK_URL="${2:-https://next.liucl.cn/adapter/telegram}"

if [ -z "$BOT_TOKEN" ]; then
    echo "❌ 错误: 缺少 BOT_TOKEN"
    echo "用法: $0 <BOT_TOKEN> [WEBHOOK_URL]"
    echo ""
    echo "示例:"
    echo "  $0 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    echo "  $0 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11 https://your-domain.com/adapter/telegram"
    exit 1
fi

echo "📱 Telegram Webhook 配置"
echo "========================"
echo "Bot Token: ${BOT_TOKEN:0:20}..."
echo "Webhook URL: $WEBHOOK_URL"
echo ""

# 1. 获取 Bot 信息
echo "1️⃣  获取 Bot 信息..."
BOT_INFO=$(curl -s -X GET "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
BOT_NAME=$(echo "$BOT_INFO" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
BOT_ID=$(echo "$BOT_INFO" | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$BOT_ID" ]; then
    echo "❌ 无法获取 Bot 信息，请检查 Token 是否正确"
    echo "响应: $BOT_INFO"
    exit 1
fi

echo "✅ Bot 名称: @$BOT_NAME (ID: $BOT_ID)"
echo ""

# 2. 删除已设置的 webhook（如有）
echo "2️⃣  清理旧的 Webhook..."
DELETE_WEBHOOK=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook")
echo "✅ 旧 Webhook 已删除"
echo ""

# 3. 设置新的 webhook
echo "3️⃣  设置新 Webhook..."
SET_WEBHOOK=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WEBHOOK_URL}\"}")

# 检查结果
if echo "$SET_WEBHOOK" | grep -q '"ok":true'; then
    echo "✅ Webhook 设置成功！"
    echo ""
    echo "📋 Webhook 配置信息:"
    echo "$SET_WEBHOOK" | python3 -m json.tool 2>/dev/null || echo "$SET_WEBHOOK"
else
    echo "❌ Webhook 设置失败"
    echo "响应: $SET_WEBHOOK"
    exit 1
fi

echo ""

# 4. 验证 webhook 状态
echo "4️⃣  验证 Webhook 状态..."
WEBHOOK_INFO=$(curl -s -X GET "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
echo "📋 Webhook 状态:"
echo "$WEBHOOK_INFO" | python3 -m json.tool 2>/dev/null || echo "$WEBHOOK_INFO"

echo ""
echo "✅ 全部完成！"
echo ""
echo "🔗 你的 Bot 链接: https://t.me/$BOT_NAME"

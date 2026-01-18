#!/bin/bash
cd /Users/liuchunlang/IdeaProjects/serverless-bot
export HTTPS_PROXY=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
exec pnpm dev

const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16+ 使用顶层 serverExternalPackages
  serverExternalPackages: [],
  // Docker / 自建 Node 单进程部署时使用 `.next/standalone`（Vercel 仍可正常构建）
  output: 'standalone',
  async redirects() {
    return [
      { source: '/:locale/login', destination: '/:locale/sign-in', permanent: true },
      { source: '/:locale/register', destination: '/:locale/sign-up', permanent: true },
    ];
  },
};

module.exports = withNextIntl(nextConfig);

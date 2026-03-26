import { Link } from '@/i18n/navigation';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { notFound } from 'next/navigation';
import { BookOpen, ArrowLeft, FileText } from 'lucide-react';
import { DocsMarkdown } from '../docs-markdown';

const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

interface Props {
  params: Promise<{ segments?: string[] }>;
}

function DocsHub() {
  const rows = [
    {
      href: '/docs/runbook/deployment',
      title: '运行手册',
      desc: '部署形态、主库/KV、安装向导、`/install`、Docker、环境变量、ChatStore 主备、Serverless 超时',
    },
    {
      href: '/docs/runbook/audit-internal',
      title: '运行手册：审计',
      desc: '`audit_log` 迁移、`audit:read`、`GET /api/audit`、记录范围与运维注意',
    },
    {
      href: '/docs/guides/chained-flows',
      title: '指南：链式 Flow',
      desc: '链式触发概念与配置',
    },
    {
      href: '/docs/guides/chained-flows-update',
      title: '指南：链式 Flow 更新说明',
      desc: '功能变更与迁移笔记',
    },
    {
      href: '/docs/reference/discord/README',
      title: '参考：Discord Webhook',
      desc: 'Discord 相关排错与速查',
    },
    {
      href: '/docs/archive',
      title: '归档',
      desc: '历史报告与一次性修复记录（非日常必读）',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">文档中心</h1>
            <p className="text-muted-foreground text-sm mt-1">
              与仓库内 <code className="text-xs bg-muted px-1 rounded">docs/</code> 目录同步的阅读入口
            </p>
          </div>
        </div>

        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="block rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="font-semibold text-primary">{row.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{row.desc}</p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            ← 返回首页
          </Link>
        </p>
      </div>
    </main>
  );
}

async function loadDoc(segments: string[]): Promise<{ content: string; slug: string } | null> {
  if (!segments.length || !segments.every((s) => SEGMENT_RE.test(s))) {
    return null;
  }
  const docsRoot = join(process.cwd(), 'docs');
  const rel = join(...segments);
  const mdPath = join(docsRoot, `${rel}.md`);
  const readmePath = join(docsRoot, rel, 'README.md');

  const tryRead = async (abs: string): Promise<string | null> => {
    try {
      return await readFile(abs, 'utf8');
    } catch {
      return null;
    }
  };

  const fromMd = await tryRead(mdPath);
  if (fromMd !== null) {
    return { content: fromMd, slug: segments.join('/') };
  }
  const fromReadme = await tryRead(readmePath);
  if (fromReadme !== null) {
    return { content: fromReadme, slug: `${segments.join('/')}/README` };
  }
  return null;
}

export default async function DocsPage({ params }: Props) {
  const { segments: raw } = await params;
  const segments = raw?.filter(Boolean) ?? [];

  if (segments.length === 0) {
    return <DocsHub />;
  }

  const doc = await loadDoc(segments);
  if (!doc) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            文档中心
          </Link>
          <span aria-hidden>/</span>
          <span className="inline-flex items-center gap-1 truncate">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">{doc.slug}</span>
          </span>
        </div>

        <article className="rounded-lg border bg-card p-6 shadow-sm max-w-none">
          <DocsMarkdown content={doc.content} />
        </article>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            返回首页
          </Link>
        </p>
      </div>
    </main>
  );
}

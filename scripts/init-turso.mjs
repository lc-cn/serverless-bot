#!/usr/bin/env node

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

console.log('🔗 Connecting to Turso database...');
const client = createClient({ url, authToken });

async function initializeDatabase() {
  try {
    // 读取迁移文件
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const migrationPath = path.join(__dirname, '../migrations/001_create_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // 更智能的 SQL 语句分割
    const lines = migrationSQL.split('\n');
    let currentStatement = '';
    const statements = [];
    
    for (let line of lines) {
      // 移除行注释
      const commentIndex = line.indexOf('--');
      if (commentIndex >= 0) {
        line = line.substring(0, commentIndex);
      }
      
      line = line.trim();
      
      if (line.length === 0) continue;
      
      currentStatement += ' ' + line;
      
      if (line.endsWith(';')) {
        // 移除末尾的分号和空白
        currentStatement = currentStatement.trim();
        if (currentStatement.endsWith(';')) {
          currentStatement = currentStatement.slice(0, -1).trim();
        }
        
        if (currentStatement.length > 0) {
          statements.push(currentStatement);
        }
        currentStatement = '';
      }
    }
    
    // 处理可能最后没有分号的语句
    if (currentStatement.trim().length > 0) {
      currentStatement = currentStatement.trim();
      if (currentStatement.endsWith(';')) {
        currentStatement = currentStatement.slice(0, -1).trim();
      }
      statements.push(currentStatement);
    }
    
    console.log(`🔄 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const displayText = statement.split('\n')[0].substring(0, 60);
      try {
        await client.execute(statement);
        console.log(`✓ [${i + 1}/${statements.length}] ${displayText}...`);
      } catch (error) {
        // 忽略 "already exists" 和其他可恢复错误
        if (error.message?.includes('already exists') || error.message?.includes('CONFLICT')) {
          console.log(`⊘ [${i + 1}/${statements.length}] ${displayText}... (已存在/冲突)`);
        } else {
          console.error(`✗ [${i + 1}/${statements.length}] ${displayText}...`);
          console.error(`  错误: ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log('\n✅ Database initialization complete!');
    console.log('✓ Created all tables (roles, users, bots, flows, triggers, messages, etc.)');
    console.log('✓ Inserted system roles (super_admin, admin, operator, viewer)');
    console.log('✓ Created default admin user: admin@localhost');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.cause?.proto?.message) {
      console.error('    Details:', error.cause.proto.message);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

initializeDatabase();

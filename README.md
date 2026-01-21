# 粮情数据管理后台

基于 Next.js 16 + HeroUI + Prisma + PostgreSQL 的粮情数据管理系统。

## 技术栈

- **前端框架**: Next.js 16 (App Router)
- **UI组件库**: HeroUI (原NextUI)
- **样式**: Tailwind CSS v4
- **认证**: NextAuth.js (Credentials Provider)
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **图表**: Recharts
- **状态管理**: Zustand

## 项目结构

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # 仪表盘布局
│   │   ├── page.tsx            # 首页
│   │   ├── depots/page.tsx     # 粮库管理
│   │   ├── granaries/
│   │   │   ├── page.tsx        # 仓房管理
│   │   │   └── [id]/page.tsx   # 仓房详情
│   │   └── users/
│   │       ├── list/page.tsx   # 用户列表管理
│   │       └── approvals/page.tsx # 用户审批
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/   # NextAuth API
│   │   │   └── register/        # 注册接口
│   │   ├── depots/              # 粮库API
│   │   ├── granaries/           # 仓房API
│   │   ├── users/               # 用户API
│   │   └── data/                # 粮情数据API
│   ├── login/page.tsx           # 登录页
│   └── register/page.tsx        # 注册页
├── components/                  # 公共组件
├── lib/
│   ├── auth.ts              # NextAuth配置
│   ├── prisma.ts            # Prisma客户端
│   ├── store.ts             # Zustand状态管理
│   └── utils.ts             # 工具函数
├── providers/
│   └── nextui-provider.tsx  # HeroUI Provider
└── types/
    └── next-auth.d.ts       # 类型扩展
```

## 项目规则

### 1. 代码规范
- **框架**: 严格遵循 Next.js 16 App Router 规范。
- **样式**: 全局使用 Tailwind CSS v4，避免使用 CSS Modules 或 styled-components。
- **UI 组件**: 优先使用 HeroUI (NextUI) 组件库，保持设计风格统一。
- **图标**: 使用 `lucide-react` 图标库。
- **语言**: 全程使用 TypeScript，禁止使用 `any` 类型，必须定义清晰的接口。

### 2. 数据库与API
- **Prisma**: 数据库变更必须更新 `schema.prisma` 并执行迁移。
- **API 路由**: 所有 API 路由必须包含权限验证（`session.user.role` 检查）。
- **错误处理**: API 必须返回标准 JSON 格式错误信息，如 `{ error: "message" }`。

### 3. 权限管理
- **角色定义**: 
  - `0`: 普通用户（仅查看分配的粮库/仓房）
  - `1`: 管理员（全权限）
- **注册流程**: 新用户注册默认为 `isApproved: false`，需管理员审批后方可登录。
- **数据隔离**: 普通用户只能访问与其关联的粮库数据。

### 4. Git 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档变更
- style: 代码格式（不影响代码运行的变动）
- refactor: 重构（即不是新增功能，也不是修改bug的代码变动）
- chore: 构建过程或辅助工具的变动

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件:

```env
DATABASE_URL="postgresql://lqserver:KhH8BWXpNXB4PpXK@1Panel-postgresql-a2dP:5432/lqserver?schema=public"
NEXTAUTH_SECRET="your-secret-key-min-32-characters-min"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. 初始化数据库

```bash
# 生成Prisma客户端
npx prisma generate

# 同步数据库schema
npx prisma db push

# 预置测试数据
npm run db:seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 测试账户

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| testuser | user123 | 普通用户 |

## 功能特性

### 管理员功能
- 用户审批（待审核用户列表，审核通过/拒绝）
- 粮库管理（增删改查）
- 粮库分配（为用户分配粮库权限）
- 用户管理

### 普通用户功能
- 查看已分配的粮库和仓房
- 查看粮情数据趋势图
- 查看历史数据列表

## API 接口

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/[...nextauth]` - NextAuth登录

### 粮库
- `GET /api/depots` - 获取粮库列表
- `POST /api/depots` - 创建粮库（管理员）
- `PUT /api/depots/[id]` - 更新粮库
- `DELETE /api/depots/[id]` - 删除粮库

### 仓房
- `GET /api/granaries` - 获取仓房列表
- `POST /api/granaries` - 创建仓房
- `PUT /api/granaries/[id]` - 更新仓房
- `DELETE /api/granaries/[id]` - 删除仓房

### 用户关联
- `GET /api/users/associations` - 获取用户粮库关联
- `POST /api/users/associations` - 分配粮库
- `DELETE /api/users/associations` - 取消关联

### 粮情数据
- `GET /api/data` - 获取粮情数据
- `POST /api/data` - 创建粮情数据

## 数据库模型

- **Depot** - 粮库
- **Granary** - 仓房
- **GranaryConfig** - 仓房配置
- **GranaryInfo** - 仓房信息
- **GranaryData** - 粮情数据
- **User** - 用户
- **UserDepotAssociation** - 用户粮库关联

## 许可证

MIT

## 项目规则

### 1. 代码规范
- **框架**: 严格遵循 Next.js 16 App Router 规范。
- **样式**: 全局使用 Tailwind CSS v4，避免使用 CSS Modules 或 styled-components。
- **UI 组件**: 优先使用 HeroUI (NextUI) 组件库，保持设计风格统一。
- **图标**: 使用 `lucide-react` 图标库。
- **语言**: 全程使用 TypeScript，禁止使用 `any` 类型，必须定义清晰的接口。
- **注意**: 代码注释默认使用中文。

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
- **注意**: 提交信息默认使用中文。例如：`feat: 添加粮库详情页`
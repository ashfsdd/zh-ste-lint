# 分发与发布（炉子 + WorkBuddy 市场）

## 一、结论先说：能自动到哪一步

| 环节 | 能否全自动 | 实测依据 |
|---|---|---|
| 校验技能（元数据完整性） | ✅ 全自动 | `scripts/publish.js --dry-run` |
| 打包成标准 zip | ✅ 全自动 | `scripts/publish.js`，5 文件 / 14.6 KB 实测通过 |
| 生成平台元数据（名称/简介/版本/分类/tags） | ✅ 全自动 | 输出 `dist/manifest.json` |
| 导入「炉子」 | ❌ 只能界面点击 | 见第二节：无本地技能目录、无命令行 |
| 发布 WorkBuddy 市场 | ❌ 只能界面点击 | 见第三节：无公开上传接口 |

**一条命令能到"包已打好、字段已备齐、告诉你点哪里"，最后两次点击必须人工。**
合计约 30 秒，不需要记参数。

## 二、炉子（本机实测 2026-10-27）

| 项 | 实测结果 |
|---|---|
| 显示名称 | 炉子（窗口标题） |
| 进程 | `luzi-desktop.exe`（PID 46436） |
| 安装路径 | `D:\软件\Luzi\luzi-desktop.exe`（单文件 exe，61.7 MB，旁边只有 uninstall.exe） |
| 数据目录 | `C:\Users\Administrator\AppData\Local\com.luzi.desktop` |
| 本地技能目录 | **不存在**。数据目录里只有 `EBWebView\`（Edge WebView2 缓存） |
| 导入入口 | 主界面右上「**+ 新建**」→「**上传 Skill**」；另有「**批量导入**」 |
| 账号 | 需要先登录（界面左下角账号 + 火力值） |

**判断**：炉子是"云端账号 + WebView 壳"，技能内容存在它的服务端，本地没有可投放的文件夹。
所以无法通过"复制到某目录"的方式导入，只能走界面上传。

## 三、WorkBuddy 市场

| 项 | 实测结果 |
|---|---|
| 本机技能根目录 | `C:\Users\Administrator\.workbuddy\skills\`（本地生效，但不是市场发布口） |
| 发布入口 | 技能页右上「**添加技能**」→「**上传技能**」 |
| 公开上传 API | **无**。官方文档只有产品功能介绍，没有投稿/发布接口说明（2026-10 复核） |
| 前置条件 | WorkBuddy 账号已登录；技能名建议同时准备 ASCII slug |

## 四、分步操作（每步可单独执行）

```bash
cd ~/.workbuddy/skills/航空手册五条/scripts

# 步 1｜只校验，不产生文件
node publish.js --slug ste-five-rules --dry-run

# 步 2｜打包（产物在 ../dist/）
node publish.js --slug ste-five-rules

# 步 3｜换版本号再打一次
node publish.js --slug ste-five-rules --version 1.1.0

# 步 4｜指定输出目录
node publish.js --slug ste-five-rules --out D:/drop
```

打完包后：

1. **炉子**：打开炉子 → 右上「+ 新建」→「上传 Skill」→ 选 `dist/ste-five-rules-1.0.0.zip`
2. **市场**：WorkBuddy 技能页 → 右上「添加技能」→「上传技能」→ 选同一个 zip
3. **填元数据**：名称、简介、版本、分类、标签直接照抄 `dist/manifest.json`
4. **验证**：两边列表里出现该技能，点进去能看到 SKILL.md 正文

## 五、参数与规范

| 参数 | 说明 |
|---|---|
| `--slug` | ASCII 标识，小写字母/数字/连字符。中文名**必须**指定，否则报错 |
| `--version` | `x.y.z`，默认取 frontmatter 的 version，没有则 1.0.0 |
| `--out` | 输出目录，默认技能目录下 `dist/` |
| `--dry-run` | 只校验 |

发布时建议的元数据：

- 名称：航空手册五条
- slug：`ste-five-rules`
- 简介：取 SKILL.md frontmatter 的 description（已满足 ≥20 字要求）
- 分类：内容创作 / 效率工具
- 标签：写作、审稿、信息密度、提示词

## 六、错误处理

| 现象 | 原因 | 处理 |
|---|---|---|
| `没有找到 SKILL.md` | 在错误目录运行 | 确认 `scripts/` 在技能根目录下 |
| `frontmatter 缺少 name / description` | SKILL.md 头部元数据不全 | 补 `---` 包裹的 name/description |
| `description 太短（N 字）` | 少于 20 字 | 补一句用途说明 |
| `中文技能名无法自动生成 slug` | 中文转不出 ASCII | 加 `--slug 英文标识` |
| `slug 不合规` | 含大写/空格/下划线 | 改为小写 + 连字符 |
| `版本号不合规` | 不是 x.y.z | 改为 `1.0.0` 形式 |
| `tar: Cannot connect to C: resolve failed` | Git Bash 的 GNU tar 把 `C:` 当远程主机 | 脚本已自动改用系统 `System32\tar.exe`，无需处理 |
| 退出码 2 | 打包阶段失败 | 看 stderr 里 tar 的原始报错 |

## 七、为什么没做"全自动上传"

要做全自动只有两条路，都不推荐：

1. **逆向私有接口 + 复用客户端登录态**：属于绕过正常授权，存在封号、接口变更即失效、条款风险
2. **UI 自动化模拟点击**：屏幕分辨率/主题一变就挂，客户端升级即失效，维护成本高于收益

**值守建议**：保持"打包自动 + 上传手点"。真要提高频率，就把 `--version` 写进日常流程，
每次发版固定跑一条命令。

## 八、后续可扩展（按需再做）

- 版本自增：读上一次 manifest 自动 +1（现在需手传 `--version`）
- 变更日志：把 git log 摘要写进 manifest 的 `changelog`
- 双平台分叉：炉子版与市场版内容不同时，用 `--out` 分别打包

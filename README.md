# token-stat

DeepSeek Harness（DSH）插件，两个界面共享一份数据故事：

1. **输入框下方药丸**：显示全部会话的**累计 Token 用量**。官方自带的 UsagePill 只统计当前会话，本插件补充跨会话累计口径。
2. **设置里的「Token 用量」页**：单屏宽度完整展示（无横向滚动，仅纵向滚动），包含累计卡片、**每日用量曲线图**、**模型用量柱状图**、按模型/按会话统计表——不同模型使用不同颜色，只有实际产生用量的模型才会出现。

## 设置页「Token 用量」

- 挂载到 `settings.section` 槽位（设置面板左侧导航，排在「模型」之后）。
- **累计卡片**：总消耗、未缓存输入 / 缓存读 / 缓存写 / 输出四个分桶、会话数、整体缓存命中率。
- **每日用量曲线图**（SVG，悬停显示当天各模型明细与合计）：数据来自本插件 Host 半身注册的
  `tokenUsageDaily` 会话投影——镜像官方 token-meter 的折叠规则（同一 `(turn, step)` 的用量样本
  后到替换先到；`llm/retry-started` 解除替换槽使重试尝试照常累加），按每次请求的实际路由
  （`request/header` 的 `config.provider/model`）和事件本地日期归组，wire view 以
  `{ 'YYYY-MM-DD': { 'provider\0model': [输入, 输出, 缓存读, 缓存写] } }` 随会话列表下发。
- **模型用量柱状图**：每个用到的模型一根彩色柱 + 图例（名称 + 紧凑总量）。
- **按模型统计表 / 会话明细表**：三列布局（模型/会话、数量、合计），四桶明细做副行，不在窄面板里横向溢出。
- 颜色：8 色调色板按用量降序分配，全程一致（图表、图例、表格色点）；无法归到路由的用量为灰色「未知模型」。
- **历史明细补算**：列表行自带的投影来自缓存；在本插件安装前已结束且未再打开的会话缺逐日明细，
  页面会用 `session/projections`（受支持的冷读取）两路并发逐个补算，并在标题旁显示进度
  「正在补充历史按日明细 n/m」。
- 表格数据与累计卡片来自 `session/list` 行的 `tokenUsage`（provider 上报，按会话最近一次使用的
  模型归类）；图表用每次请求的实际模型，口径更精确，页面内有说明。
- 刷新：`api-session/added|removed|status|activity` 推送去抖后自动刷新（仅当页面处于打开状态），
  重新打开页面时自动刷新一次，另有手动「刷新」按钮；断线 `connection/reset` 后回到待加载状态。

## 输入框药丸

- 挂载到 `conversation.composer.dock` 槽位，与官方 ActivityPill / UsagePill / ContextMeter 并排。
- 聚合 sessions 快照中每个会话的 `tokenUsage` 投影值，显示累计总量与有统计数字的会话数，例如
  `累计 1.2M · 8 会话`；悬停提示展示分桶明细、缓存命中率与当前会话合计。

## 通用

- 中英文界面（客户端 locale 服务）；结构样式只引用 `--dsw-alias-*` 主题 token，图表系列色为固定
  调色板（作品色），自动适配明暗主题。
- 不 require 任何 Harness Client 包；React 来自浏览器模块表，服务经 fiber `inject` 注入。
- Host 半身只注册 `tokenUsageDaily` 投影（可选挂载：无投影注册表的部署上插件其余功能不受影响）。

## 目录结构

```
token-stat/
├── package.json       # bundle 清单：dsh.bundle.patch + dsh.client(web)
├── cordis.patch.yml   # 激活层：向 loader 插入 id=token-stat 的插件行
├── index.js           # Host 半身：tokenUsageDaily 会话投影（日期 × 模型 × 四桶）
├── client.js          # Client 半身：dock 药丸 + 设置页（卡片/曲线图/柱状图/表格）
├── locale/en.json     # Plugin Manager 展示元数据（英文）
├── locale/zh.json     # Plugin Manager 展示元数据（中文）
├── icon.svg           # 插件图标（原创三柱图形）
└── README.md
```

## 安装

在 DSH 会话中让 agent 调用 `plugin_manager` 的 `install_bundle` 动作，`target`
传本目录的绝对路径（Electron 托管的 profile——如 desktop——不接受
`dsh plugin` 命令行，这是唯一途径；自建 profile 也可用
`dsh plugin --profile <profile> add <本目录>`）。安装以本地链接方式指向本目录，
改代码后刷新 Web 页面即生效；调整 `exports`/`files` 等清单字段后需重新安装。

安装后刷新 Web 页面：输入框下方可见药丸（尚未产生任何对话用量时药丸不显示）；设置里
出现「Token 用量」项，点击即见统计。首次打开时页面会在后台补算历史会话的逐日明细。

## 覆盖配置

本插件当前无配置项。如后续新增，在 profile 的 `cordis.patch.yml` 中按 id 覆盖：

```yaml
- update:
    - id: token-stat
      config: {}
```

## 卸载

在 DSH 会话中让 agent 调用 `plugin_manager` 的 `remove_bundle` 动作；
自建 profile 也可用 `dsh plugin --profile <profile> remove @local/token-stat`。

## 许可

本地插件，随仓库分发；图标与代码均为原创，可自由修改。

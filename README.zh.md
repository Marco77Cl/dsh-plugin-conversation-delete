# dsh-plugin-conversation-delete

[English](README.md)

在 DeepSeek Harness 的每个对话行上加一个 **删除对话** 操作。

DSH 官方只有“归档”没有“删除”：归档后的对话仍永久留在磁盘上。本插件在明确确认后，真正删除一条对话。

## 功能

- 在每条对话的 `⋯` 菜单（以及共享同一贡献的右键菜单）中加入 **删除对话**。
- 弹出确认框，显示对话标题并提示不可撤销。
- 删除内容：
  1. `$DSH_HOME/sessions/…` 下该对话的日志目录（所有格式版本与写入锁）；
  2. 标准布局下 `$DSH_HOME/storages/session_projcache/sessions/…` 的投影缓存；
  3. 侧栏中的位置——先通过 workspace registry 归档，从而释放已打开的视图、清除置顶；若仍有回合、子代理、后台任务或定时提醒在运行，则拒绝删除并说明是什么在运行。
- 删除后自动刷新页面，侧栏立即更新。

## 安全行为

- **绝不在任务运行中删除。** 对话仍在运行时，插件会拒绝并列出正在运行的内容；请先停止。
- 只有本机所有者浏览器能调用该接口。接口注册在 Host Connection 的 exact-Fetch 注册表上，与其他 `/api` 调用一样受浏览器 Cookie、Host/Origin 校验和 owner Peer 限制。
- 待删除路径来自会话持久化后端而不是浏览器，并校验必须位于会话存储根目录内、目录名与会话 id 一致。
- 删除不可恢复；需要可逆请继续使用“归档”。

## 安装

```sh
dsh plugin --profile <profile> add dsh-plugin-conversation-delete
```

然后在 **插件** 页面启用该 bundle（若宿主未自动启用），刷新页面。

DSH Desktop 请通过应用内的插件管理器或插件市场安装，不要用另一个 `dsh` CLI（Desktop 使用自己的 profile）。

## 要求

- DSH `>= 0.2.2-rc.1`，带 Web UI（Desktop 或 `dsh web`）。
- 已启用 `workspace`、`session-persistence-jsonl`、`session-projection-cache`、`client-connection`、`ui-workspace`。`dsh-base` + `dsh-web-app` 组合默认都有。

## 实现

| 部分 | 文件 | 作用 |
| --- | --- | --- |
| Host | `lib/index.js` | 在 exact-Fetch 注册表注册 `POST /api/session-delete/delete`：归档会话、校验后端返回的日志路径、删除日志目录与缓存。 |
| Client | `lib/client.js` | 通过 `ctx.contextMenus` 贡献 `session.delete` 菜单项，在 `shell.overlay` 挂载确认框，调用接口并刷新。 |
| Bundle | `cordis.patch.yml` | 把插件行插入 profile。 |

两部分都是纯 JavaScript；客户端入口是手写的 `__ModuleLoader__` factory，无需构建步骤。

## 许可证

MIT

# 当前分集返回 ANONYMOUS_LIMITED 的排查

- 症状：`/watch/7673830890253847577?ep=7673835355031735358&source=live` 提示“当前匿名设备没有获取到内容，请稍后再试”。
- 复现：本地播放 API 返回 `ANONYMOUS_LIMITED`；随后以同一个已保存设备档案直接调用 SDK，并在自定义传输层检查响应结构。
- 已确认的失败点：剧集详情接口 HTTP 200、业务码 0、117 集，目标分集 `playable=true`；`/novel/player/video_model/v1/` 返回 HTTP 200、响应体 0 字节。
- SDK 错误原文：`openhongguo: anonymous response was empty`，`retryable=false`。对应上游 `sdk/client.go` 的 `readAnonymous` 空响应分支。不是本次调用的 `guest ticket missing` 分支，匿名档案的设备标识和游客凭证字段均存在（没有记录字段值）。
- 能确定的原因：没有取得播放模型，因此没有进入媒体下载、FFmpeg 或浏览器解码阶段。尚不能确定上游为什么返回空内容；错误名本身不能证明设备被封、需要会员或只需等待即可恢复。
- 外部证据：[上游 issue #2](https://github.com/beilunyang/openhongguo/issues/2) 报告未修改的 CLI 也存在“搜索和分集正常，播放模型间歇为空”的问题，具体原因未确认。
- 修改：仅保存诊断记录；没有修改业务代码、切换设备、重置设备或导入账号信息。
- 验证范围：只做本次错误的复现和传输层定位，没有运行与此只读调查无关的测试。
- 状态：BLOCKED（上游未返回拒绝原因；需要维护者进一步确认播放接口行为）。

## 与用户提供的静态逆向报告对照

- 报告位于 `/Users/vector/Documents/Codex/2026-10-30/zai/outputs/hongguo-identity/report.md`。12 个反编译 Java 文件的 SHA-256 均与该目录的 `source-map-and-hashes.json` 一致。
- 报告对应 APK 7.4.3.32；SDK 常量对应 7.3.9.32。版本差异存在，但没有证据将其确定为空响应根因；未改版本、渠道、标识或签名。
- 当前网页档案所需字段均存在，权限为 0600；读取前后文件内容一致。SDK 每次调用读取已保存档案，身份完整时直接复用。未发现本轮检查范围内的档案丢失或反复注册问题。
- 用户描述的可用方案包含 `ttToken`，与 SDK 的 `ttreq` 不同。`sdk/device.go` 的 DeviceProfile 无 `ttToken` 字段；`sdk/auth.go` 默认不附加账号凭据；`sdk/client.go:260` 拒绝账号凭据头，其中包括 `X-Tt-Token`（`internal/protocol/app.go:80`）。注册分支还会将 `DeviceToken` 设为空字符串（`sdk/client.go:347`）。
- 因此，将另一种配置对象直接写入 anonymous.json，不会让此 SDK 自动成为支持账号会话的客户端。尚未获得对方接入代码或脱敏请求结构，不能确定其成功是否依赖账号会话，更不能据字段清单认定缺少某个令牌就是根因。
- 报告中普通机型采集读取 Android Build 字段；并未证实用户所述独立 device 配置一定属于官方的“伪装机型”机制。
- 本轮为静态/本地只读对照；未提取、导入或重放手机会话，未轮换设备，也未改变网页业务代码。真实播放问题仍未修复。

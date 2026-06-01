# LAN Drop v0.1.9-beta

这是 LAN Drop / 闪传本子的早期测试版本。

## 下载

请前往 GitHub Releases：

[https://github.com/t01094738688-commits/lan-drop/releases](https://github.com/t01094738688-commits/lan-drop/releases)

当前提供：

- Windows x64：`.exe`
- macOS Apple Silicon：`.dmg` / `.zip`
- Linux 实验版：`.AppImage` / `.deb`

## 本版本能力

- 新增软件内“检查更新”：电脑端首页可直接检查 GitHub Releases 最新版，并下载 Windows / Mac 安装包。
- 手机无需安装 App，扫码或打开地址即可访问电脑端。
- 手机和电脑在同一 Wi-Fi 下互传文件、图片、文字。
- 电脑端显示二维码、访问码和局域网访问地址。
- 收到内容以列表形式展示，可打开、复制、删除。
- 新增剪贴板快传：读取电脑剪贴板文字/链接，一键发送到手机；截图可直接 Ctrl + V 发送。
- 新增设备管理：显示通过访问码连接过的设备，并支持踢出。
- 优化手机端访问码弹窗和扫码后的页面布局。
- 修复访问码脚本缓存版本，减少手机继续加载旧脚本的问题。
- 修复部分手机/微信内置浏览器上传文件时提示 `Access code required` 的问题。
- 访问码改为 4 位数字，并在手机端弹出数字键盘，降低输入成本。
- 随记支持按日期、分类保存文字和图片。
- 钥记支持本地加密保存账号、邮箱、密钥、密码、Token 等信息。
- 支持 GitHub Actions 自动构建 Windows / macOS / Linux 发布包。

## 已知限制

- 这是早期测试版，Mac / Linux 仍需要更多真机测试。
- macOS 版本尚未做 Apple 签名/公证，首次打开可能需要右键选择“打开”。
- 当前 macOS 包为 Apple Silicon 版本，主要适合 M1 / M2 / M3 / M4。
- Linux 包目前是实验版，仍需要 Ubuntu / Debian 等真机测试。
- 已支持软件内检查更新并打开/下载最新安装包，暂未做静默自动替换。
- 当前剪贴板模式是手动读取/发送，还不是后台实时同步。
- 钥记主密码无法找回，请提前备份重要内容。

## 使用提醒

- 手机和电脑需要连接同一个 Wi-Fi 或同一个热点。
- 建议在可信网络中使用，不建议在公共 Wi-Fi 传输敏感文件。
- 手机端不需要安装 App，使用 Safari、Chrome 等浏览器即可。

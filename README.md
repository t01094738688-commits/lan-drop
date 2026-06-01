# LAN Drop / 闪传本子

LAN Drop 是一个面向个人用户的局域网工具箱。电脑端打开后，手机和电脑连接同一个 Wi-Fi，手机扫码或打开访问地址，就可以快速互传文件、图片和文字。

核心特点：**手机无需安装 App，扫码即用。**

> 当前版本：`v0.1.5-beta.1` 早期测试版。适合朋友间测试和小范围使用。

## 下载

前往 Releases 下载最新版：

[https://github.com/t01094738688-commits/lan-drop/releases](https://github.com/t01094738688-commits/lan-drop/releases)

按系统选择：

| 系统 | 下载文件 |
| --- | --- |
| Windows | `闪传本子-0.1.5-win-x64.exe` |
| macOS Apple Silicon | `闪传本子-0.1.5-mac-arm64.dmg` |

说明：

- macOS 版本目前未做 Apple 签名/公证，首次打开可能需要右键 App 选择“打开”。
- 当前 Mac 包是 Apple Silicon 版本，适合 M1 / M2 / M3 / M4 芯片。
- Linux 版本还在准备中。

## 怎么用

1. 在电脑上打开 LAN Drop。
2. 确认手机和电脑连接同一个 Wi-Fi。
3. 手机用相机扫码，或手动打开电脑端显示的访问地址。
4. 输入电脑端显示的 4 位数字访问码。
5. 在手机或电脑上选择文件、图片、文字发送。

手机端不需要安装任何 App，使用 Safari、Chrome 等系统浏览器即可。

## 功能

- **互传**：手机和电脑互传文件、图片、文字。
- **随记**：按日期记录文字和图片，适合临时想法、截图、链接、备忘。
- **钥记**：本地加密保存账号、邮箱、密钥、密码、Token 等信息。
- **剪贴板快传**：读取电脑剪贴板文字/链接，一键发送到手机；截图可直接 Ctrl + V 发送。
- **二维码和访问码**：手机扫码后输入 4 位数字访问码，减少同一局域网内的误访问。
- **本地保存**：文件和数据默认保存在本机，不上传云端。

## 安全说明

- LAN Drop 主要用于可信局域网，例如家里、办公室、个人热点。
- 不建议在公共 Wi-Fi 上传输敏感文件。
- 访问码只保护局域网入口，不等于专业安全网关。
- 钥记主密码无法找回，请自行备份重要内容。
- 钥记目前适合轻量记录，不建议作为唯一的专业密码管理器。

## 文件保存位置

默认保存到用户文档目录下的 `闪传本子` 文件夹。

Windows 常见路径：

```text
C:\Users\你的用户名\Documents\闪传本子
```

## 开发运行

安装依赖：

```powershell
npm install
```

启动桌面端：

```powershell
npm run desktop
```

只启动网页服务：

```powershell
npm start
```

默认端口是 `47321`。

## 打包

Windows 免安装包：

```powershell
npm run pack:win
```

Windows 安装包：

```powershell
npm run dist:win
```

macOS 包需要在 macOS 环境构建：

```bash
npm run dist:mac
```

Linux 包：

```bash
npm run dist:linux
```

## 发布

当前项目已配置 GitHub Actions。推送 `v*` 标签后，会自动构建 Windows / macOS 包并创建 GitHub Release。

示例：

```powershell
git tag -a v0.1.5-beta.1 -m "LAN Drop v0.1.5 beta 1"
git push origin v0.1.5-beta.1
```

## 当前限制

- Mac / Linux 仍需要更多真机测试。
- Mac 版本未签名，首次打开体验不够顺滑。
- 暂无自动更新。
- 当前剪贴板模式是手动读取/发送，还不是后台实时同步。
- 设备管理功能还不完整，例如信任设备、踢出设备、连接历史。

## 后续计划

- GitHub Releases 下载页持续完善。
- 增强剪贴板模式：增加后台监听、图片剪贴板读取和多设备实时同步。
- 增加设备列表：显示已连接设备、浏览器、IP、最后访问时间，并支持踢出。
- 补充 Linux AppImage / deb 发布包。
- 增加更多自动化测试和跨平台真机测试清单。

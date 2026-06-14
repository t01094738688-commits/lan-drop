# LAN Drop / 闪传本子

LAN Drop 是一个面向个人用户的局域网快传工具。电脑端打开后，手机和电脑连接同一个 Wi-Fi 或热点，手机扫码或打开访问地址，就可以互传文件、图片和文字。

核心特点：**手机无需安装 App，扫码即用。**

> 当前版本：`v0.1.39-beta` 多系统测试版。适合小红书、微信和朋友间小范围试用。

## 下载

前往 GitHub Releases 下载最新版：

[https://github.com/t01094738688-commits/lan-drop/releases](https://github.com/t01094738688-commits/lan-drop/releases)

按系统选择：

| 系统 | 下载文件 |
| --- | --- |
| Windows | `LAN-Drop-*-win-x64.exe` |
| macOS 苹果芯片 M1/M2/M3/M4 | `LAN-Drop-*-mac-arm64.dmg` |
| macOS Intel 芯片 | `LAN-Drop-*-mac-x64.dmg` |
| Linux | `LAN-Drop-*-linux-x64.AppImage` 或 `.deb` |

说明：

- Windows 版本是当前主推测试版。
- macOS 版本还没有苹果签名/公证，首次打开可能需要右键点击应用并选择“打开”。
- Linux 版本属于实验测试版，不同发行版表现可能不同。
- 手机端不需要下载安装包，只需要扫码或打开电脑端显示的地址。

## 怎么用

1. 在电脑上打开 LAN Drop。
2. 确认手机和电脑连接同一个 Wi-Fi 或同一个热点。
3. 手机用相机扫码，或手动打开电脑端显示的访问地址。
4. 输入电脑端显示的 4 位数字访问码。
5. 选择文件、图片或文字发送。

访问码是为了防止同一个 Wi-Fi 下的陌生人直接打开你的电脑，不是登录账号。

## 功能

- **互传**：手机和电脑互传文件、图片、文字。
- **复制即发送**：电脑复制文件或图片后，在互传页按 `Ctrl + V` 可以直接加入发送队列。
- **剪贴板快传**：电脑端可读取/同步电脑剪贴板；手机端受浏览器限制，需要主动点击读取或手动粘贴。
- **随记**：按日期记录文字和图片，适合临时想法、截图、链接、备忘。
- **二维码和访问码**：手机扫码后输入 4 位数字访问码，减少误访问。
- **本地保存**：文件和数据默认保存在本机，不上传云端。

## 安全说明

- LAN Drop 主要用于可信局域网，例如家里、办公室、个人热点。
- 不建议在公共 Wi-Fi 上传输敏感文件。
- 访问码只保护局域网入口，不等于专业安全网关。
- macOS/Linux 版本仍需更多真机测试。

## 文件保存位置

默认保存到用户文档目录下的 `闪传本子` 文件夹。Windows 会优先使用已经存在的数据目录，例如：

```text
D:\UserData\Administrator\Documents\闪传本子
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

## 本地打包

Windows 安装包：

```powershell
npm run build:win
```

Windows 绿色版：

```powershell
npm run build:win:portable
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

项目已配置 GitHub Actions。推送 `v*` 标签后，会自动构建并发布：

- Windows x64
- macOS Apple Silicon
- macOS Intel
- Linux AppImage/deb

示例：

```powershell
git tag -a v0.1.39-beta.1 -m "LAN Drop v0.1.39 beta 1"
git push origin v0.1.39-beta.1
```

## 当前限制

- Mac/Linux 仍需要更多真机测试。
- macOS 版本未签名，首次打开体验不够顺滑。
- Windows 软件内更新会自动下载更新包，并尽量用静默安装方式覆盖旧版；仍可能受系统权限或安全软件影响。
- 手机浏览器不能后台自动读取手机剪贴板，所以手机端剪贴板同步必须由用户主动触发。

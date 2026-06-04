# 妖火 APP

妖火 APP 是一个基于 Vue2、uni-app 和 DCloud App-Plus 的妖火论坛第三方客户端。项目主要面向 Android App 使用，数据直接请求 `https://yaohuo.me`，不经过自建中转服务。

## 项目来源

- 原作者：[Redcker/yaohuo](https://github.com/Redcker/yaohuo)
- 二改作者：[mmuni/yaohuo](https://gitee.com/mmuni/yaohuo)
- 当前仓库：[JIUSIS/yaohuo](https://github.com/JIUSIS/yaohuo)

当前版本在二改版基础上继续适配 `yaohuo.me`，重点修复登录态同步、帖子详情、评论楼层解析、评论回复、私信和 Android 离线打包相关问题。

## 功能

- 妖火论坛首页、分区列表、搜索和帖子详情浏览
- 登录、退出登录和本地 Cookie 同步
- 评论列表、多页评论、楼层回复和评论删除
- 私信列表、私信会话和发送私信
- 帖子附件、图片、表情和 HTML 内容渲染
- 支持 HBuilderX 云打包
- 支持 Android Studio + DCloud Android 离线 SDK 本地打包

## 技术栈

- Vue 2.6
- uni-app / App-Plus
- DCloud HBuilderX CLI 依赖
- mp-html
- cheerio 0.22
- Android Studio
- DCloud Android 离线 SDK

## 目录说明

```text
.
├── App.vue
├── main.js
├── manifest.json
├── pages.json
├── components/                 # 页面组件
├── pages/                      # uni-app 页面
├── static/                     # 静态图片
├── uni_modules/                # uni-ui、mp-html 等模块
├── utils/                      # 解析、表情、认证等工具
├── local-android-build/        # Android 离线打包工程骨架
└── package.json
```

`dist/`、`unpackage/`、`node_modules/`、`tools/` 和 Android 构建缓存不提交到仓库。离线打包需要的 JDK、Android SDK、DCloud Android SDK 请按本文说明在本地准备。

## 开发环境

建议环境：

- Node.js 18 或 20
- npm
- HBuilderX 4.x
- Android Studio
- JDK 17
- Android SDK Platform 36
- Android SDK Build Tools 36.0.0
- DCloud Android 离线 SDK 5.08 或与 HBuilderX 对应的版本

DCloud 官方 Android 离线打包文档：

- [Android 原生工程配置](https://nativesupport.dcloud.net.cn/AppDocs/usesdk/android.html)
- [Android 离线 SDK 下载](https://nativesupport.dcloud.net.cn/AppDocs/download/android.html)

## 安装依赖

```bash
npm install
```

如果依赖安装失败，建议删除 `node_modules` 后重新安装：

```bash
rm -rf node_modules
npm install
```

Windows PowerShell：

```powershell
Remove-Item node_modules -Recurse -Force
npm install
```

## H5 调试

```bash
npm run dev:h5
```

H5 只适合基础页面调试。登录态、系统 Cookie、App-Plus WebView 等能力需要在 App 环境测试。

## App-Plus 资源构建

```bash
npm run build:app-plus
```

构建产物在：

```text
dist/build/app-plus
```

该目录是 App-Plus 资源包，可导入 HBuilderX 或同步到 Android 离线工程。

## HBuilderX 云打包

1. 使用 HBuilderX 打开项目根目录。
2. 检查 `manifest.json` 中的 `appid`、应用名称、包名、图标和权限。
3. 菜单选择 `发行` -> `原生App-云打包`。
4. 选择 Android，配置证书和包名。
5. 提交云打包任务。

如果云打包安装后功能失效，优先检查：

- `manifest.json` 的 `appid` 是否和 DCloud 后台一致
- Android 包名是否和 DCloud AppKey 绑定一致
- 是否使用了正确的 `yaohuo.me` 域名
- 登录后是否能拿到 `sidyaohuo` Cookie

## Android 本地离线打包

本仓库包含 `local-android-build/` 离线打包工程骨架。完整离线打包需要本地自行准备：

```text
tools/
├── android-sdk/
├── dcloud-android-sdk-5.08/
└── jdk-17/
```

推荐版本：

```text
compileSdkVersion 36
buildToolsVersion 36.0.0
Gradle 8.14.3
Android Gradle Plugin 8.12.0
JDK 17
```

### 复制 DCloud AAR

从 DCloud Android 离线 SDK 中复制基础库到：

```text
local-android-build/app/libs
```

至少需要：

```text
lib.5plus.base-release.aar
uniapp-v8-release.aar
android-gif-drawable-1.2.29.aar
oaid_sdk_1.0.25.aar
breakpad-build-release.aar
utsplugin-release.aar
```

如果使用安装 APK、推送、地图、支付、分享等原生模块，需要按 DCloud 官方文档继续补充对应 AAR 和依赖。

### 配置 Android SDK

在 `local-android-build/local.properties` 中写入本机 Android SDK 路径：

```properties
sdk.dir=D:/Android/Sdk
```

`local.properties` 是本机配置文件，不提交到仓库。

### 同步 App-Plus 资源

先构建 App-Plus：

```powershell
npm.cmd run build:app-plus
```

再把资源复制到离线工程：

```powershell
robocopy .\dist\build\app-plus .\local-android-build\app\src\main\assets\apps\__UNI__2B73CE2\www /MIR
```

如果在 macOS 或 Linux 上操作，可以用：

```bash
rm -rf local-android-build/app/src/main/assets/apps/__UNI__2B73CE2/www
mkdir -p local-android-build/app/src/main/assets/apps/__UNI__2B73CE2/www
cp -R dist/build/app-plus/. local-android-build/app/src/main/assets/apps/__UNI__2B73CE2/www/
```

### Android Studio 打包

1. 打开 Android Studio。
2. 选择 `Open`。
3. 打开：

```text
local-android-build
```

4. 等待 Gradle Sync 完成。
5. 连接手机后点击顶部运行按钮，可直接安装测试。
6. 生成 APK：`Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`。

### 命令行打包

Windows PowerShell：

```powershell
cd local-android-build
$env:JAVA_HOME="..\tools\jdk-17\jdk-17.0.19+10"
$env:ANDROID_HOME="..\tools\android-sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
.\gradlew.bat assembleRelease
```

APK 输出目录：

```text
local-android-build/app/build/outputs/apk/release/app-release.apk
```

## 签名说明

公开仓库不提供正式签名证书。发布正式版前请自行生成 keystore，并修改：

```text
local-android-build/app/build.gradle
```

开发测试可使用本地测试证书，但不要把正式证书、密码、DCloud AppKey 或第三方平台密钥提交到仓库。

`local-android-build/app/build.gradle` 会自动检测 `local-android-build/app/test.jks`。如果本地存在该文件，Release 包会使用它签名；如果不存在，Android Studio 仍可导入工程，Debug 运行使用默认调试签名，Release 需要你自行配置正式证书。

## 登录说明

妖火站点登录依赖 `sidyaohuo` Cookie。当前 App 使用 `utils/auth.js` 统一处理：

- 从登录响应提取 Cookie
- 同步 App-Plus 系统 Cookie
- 为列表、详情、评论、私信等请求附加 Cookie
- Cookie 失效时跳转登录页

如果登录失败，可以在 App 控制台查看 `pages/login/login.vue` 的请求结果和服务器返回的 `<div class="tip">` 提示。

## 评论解析说明

`yaohuo.me` 的帖子评论页存在多种 HTML 结构，当前版本做了这些兼容：

- 优先解析 `.list-reply`
- 支持从帖子页、回帖页、隐藏表单和链接中提取 `classid`
- 评论列表请求会清理 `mainuserid`、`reply`、`touserid`、`tofloor` 等过滤参数
- 回复前同步 `id`、`classid`、`siteid`、`sid` 和 `lpage`
- 服务器返回失败提示时弹窗显示，不再误报“评论成功”

## 常见问题

### Android Studio 提示 Project SDK 不一致

选择 `Use Project's SDK` 或手动把 `local.properties` 改成你本机 Android SDK 路径。

### Android Studio 提示代理认证

如果你没有配置代理，直接取消。必要时到 `Settings` -> `Appearance & Behavior` -> `System Settings` -> `HTTP Proxy` 关闭代理。

### 打包后打不开

优先检查：

- DCloud AppKey 是否正确
- `manifest.json` 的 `appid` 是否和 Android 离线工程 `dcloud_control.xml` 一致
- App-Plus 资源是否已经同步到 `assets/apps/__UNI__2B73CE2/www`
- Android 包名是否和证书、DCloud 后台配置一致
- Android 16 设备是否使用了支持 16KB page size 的 DCloud SDK 和 Gradle 配置

### 云打包可以打开但功能失效

通常是登录 Cookie、域名或请求解析问题。请确认所有请求指向 `https://yaohuo.me`，并检查登录后是否成功保存 `sidyaohuo`。

## 免责声明

本项目为学习和交流用途的第三方客户端源码。请遵守目标站点规则和相关法律法规。账号、内容、数据安全由使用者自行负责。

## 贡献

欢迎提交 Issue 或 Pull Request。提交问题时建议附带：

- 出错页面
- 操作步骤
- 控制台日志
- 帖子链接或帖子 ID
- Android 版本和设备型号

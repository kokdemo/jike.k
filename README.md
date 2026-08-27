# jike.k

基于 [WXT](https://wxt.dev/) 的 Manifest V3 浏览器扩展，为即刻网页版话题页提供可选的看图模式。

## 开发

```bash
pnpm install
pnpm dev
```

开发模式生成的扩展位于 `dist/chrome-mv3-dev/`；在 `chrome://extensions` 开启开发者模式后加载该目录。

## 构建

```bash
pnpm build
pnpm zip
```

生产构建输出在 `dist/chrome-mv3/`，压缩包由 `pnpm zip` 生成。

每次重新构建后，在 `chrome://extensions` 点击 jike.k 的“重新加载”，再刷新即刻页面；内容脚本在页面启动阶段注入，单独刷新扩展不会更新已经打开的页面。

## 功能

- 详情面板注入范围是 `https://web.okjike.com/*`，包括 `/explore`、`/following`、完整的 `/topic/<topicId>` 和 `/u/<userId>/post/<postId>` 页面。
- 默认对内置摄影话题启用看图模式。
- 在任意即刻话题页点击扩展图标，可单独开启或关闭当前话题。
- 支持即刻站内的客户端路由切换；配置变更会立即应用。
- 当前页面采用左侧信息流 + 右侧详情面板的双栏布局。
- 点击主 Feed 帖子会读取它的 `/u/.../post/...` 链接，并在右侧加载真实帖子详情页。
- 发送回复时复用详情页自身的评论输入框和发送控件，不直接伪造接口请求。

注意：`/topic/` 和 `/u/` 是不完整地址，本身没有可识别的主题或用户；需要替换为实际 ID。

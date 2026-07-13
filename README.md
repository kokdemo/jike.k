# jike.k

基于 [WXT](https://wxt.dev/) 的 Manifest V3 浏览器扩展，为即刻网页版话题页提供可选的看图模式。

## 开发

```bash
pnpm install
pnpm dev
```

开发模式生成的扩展位于 `.output/chrome-mv3-dev/`；在 `chrome://extensions` 开启开发者模式后加载该目录。

## 构建

```bash
pnpm build
pnpm zip
```

生产构建输出在 `.output/chrome-mv3/`，压缩包由 `pnpm zip` 生成。

## 功能

- 默认对内置摄影话题启用看图模式。
- 在任意即刻话题页点击扩展图标，可单独开启或关闭当前话题。
- 支持即刻站内的客户端路由切换；配置变更会立即应用。

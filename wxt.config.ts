import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'jike.k',
    description: '为即刻网页版提供可选的看图模式。',
    permissions: ['storage'],
    host_permissions: ['https://web.okjike.com/*'],
    icons: {
      '16': 'icon/16.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
  },
});

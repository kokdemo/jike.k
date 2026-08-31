import './jike.css';
import './panel.css';
import { getTopicId, getTopics } from '../../shared/topics';
import { mountDetailPanel } from './panel';

const ROOT_CLASS = 'jike-k-picture-mode';
const PHOTO_WALL_CLASS = 'jike-k-photo-wall-mode';
const PHOTO_WALL_PATH = /^\/topic\/[^/?#]+\/hybrid\/?$/;

export default defineContentScript({
  matches: ['https://web.okjike.com/*'],
  // Install the click guard before the site's React router registers handlers.
  runAt: 'document_start',
  main(ctx) {
    let currentPath = location.pathname;

    const applyMode = async () => {
      document.documentElement?.classList.toggle(PHOTO_WALL_CLASS, PHOTO_WALL_PATH.test(location.pathname));
      const topicId = getTopicId(location.href);
      const topics = await getTopics();
      document.documentElement?.classList.toggle(ROOT_CLASS, Boolean(topicId && topics[topicId]?.enabled));
    };

    const observeRoute = () => {
      if (location.pathname !== currentPath) {
        currentPath = location.pathname;
        void applyMode();
      }
    };

    void applyMode();
    ctx.addEventListener(document, 'DOMContentLoaded', () => void applyMode(), { once: true });
    mountDetailPanel(ctx);
    browser.storage.onChanged.addListener((_changes, areaName) => {
      if (areaName === 'sync') void applyMode();
    });
    const routeObserver = new MutationObserver(observeRoute);
    const observeDocument = () => {
      if (!document.documentElement) return;
      routeObserver.observe(document.documentElement, { childList: true, subtree: true });
    };
    observeDocument();
    if (!document.documentElement) {
      ctx.addEventListener(document, 'DOMContentLoaded', observeDocument, { once: true });
    }
    ctx.addEventListener(window, 'wxt:locationchange', observeRoute);
    ctx.setInterval(observeRoute, 250);
    window.addEventListener('popstate', () => void applyMode());
  },
});

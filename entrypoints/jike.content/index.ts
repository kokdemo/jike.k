import './jike.css';
import './panel.css';
import { getTopicId, getTopics } from '../../shared/topics';
import { mountDetailPanel, mountFrameChromeHider } from './panel';

const ROOT_CLASS = 'jike-k-picture-mode';

export default defineContentScript({
  matches: ['https://web.okjike.com/*'],
  // Install the click guard before the site's React router registers handlers.
  runAt: 'document_start',
  allFrames: true,
  main(ctx) {
    if (window.top !== window) {
      mountFrameChromeHider(ctx);
      return;
    }

    let currentPath = location.pathname;

    const applyMode = async () => {
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
    window.addEventListener('popstate', () => void applyMode());
  },
});

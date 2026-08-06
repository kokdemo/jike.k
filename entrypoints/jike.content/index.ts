import './jike.css';
import './panel.css';
import { getTopicId, getTopics } from '../../shared/topics';
import { mountDetailPanel } from './panel';

const ROOT_CLASS = 'jike-k-picture-mode';

export default defineContentScript({
  matches: ['https://web.okjike.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    let currentPath = location.pathname;

    const applyMode = async () => {
      const topicId = getTopicId(location.href);
      const topics = await getTopics();
      document.documentElement.classList.toggle(ROOT_CLASS, Boolean(topicId && topics[topicId]?.enabled));
    };

    const observeRoute = () => {
      if (location.pathname !== currentPath) {
        currentPath = location.pathname;
        void applyMode();
      }
    };

    void applyMode();
    mountDetailPanel(ctx);
    browser.storage.onChanged.addListener((_changes, areaName) => {
      if (areaName === 'sync') void applyMode();
    });
    new MutationObserver(observeRoute).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener('popstate', () => void applyMode());
  },
});

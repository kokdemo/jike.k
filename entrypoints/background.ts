import { ensureTopics } from '../shared/topics';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void ensureTopics();
  });
});

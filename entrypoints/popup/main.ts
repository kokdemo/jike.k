import './style.css';
import { getTopicId, getTopics, toggleTopic } from '../../shared/topics';

const statusElement = document.querySelector<HTMLParagraphElement>('#status');
const toggleElement = document.querySelector<HTMLButtonElement>('#toggle');

if (!statusElement || !toggleElement) throw new Error('Popup UI is incomplete.');

const status = statusElement;
const toggle = toggleElement;

let topicId: string | undefined;

async function refresh(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  topicId = tab?.url ? getTopicId(tab.url) : undefined;

  if (!topicId) {
    status.textContent = '请打开即刻的话题页面后再使用。';
    toggle.disabled = true;
    return;
  }

  const topics = await getTopics();
  const enabled = topics[topicId]?.enabled ?? false;
  status.textContent = `当前话题：看图模式${enabled ? '已开启' : '未开启'}。`;
  toggle.textContent = enabled ? '关闭当前话题的看图模式' : '开启当前话题的看图模式';
  toggle.disabled = false;
}

toggle.addEventListener('click', async () => {
  if (!topicId) return;
  toggle.disabled = true;
  await toggleTopic(topicId);
  await refresh();
});

void refresh();

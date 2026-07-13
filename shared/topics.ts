export type Topic = {
  name: string;
  enabled: boolean;
};

export type Topics = Record<string, Topic>;

const STORAGE_KEY = 'topics';

const DEFAULT_TOPICS: Topics = {
  '556688fae4b00c57d9dd46ee': { name: '今日份的摄影', enabled: true },
  '57b86fb59b06f01200f89410': { name: '街头摄影扫街组', enabled: true },
  '5b67fbd3a7d6a90017630366': { name: '人文纪实摄影组', enabled: true },
  '5b6a90ec69f2e00017b0bb17': { name: '一起拍建筑', enabled: true },
  '5b7d2e3aaa31960017c5a206': { name: '一起拍写真', enabled: true },
  '5b6a907bc0798a00176cf893': { name: '一起拍星空', enabled: true },
  '5740760391dbb11100594646': { name: '摄影鉴赏会', enabled: true },
  '56ac86b95761ff120077b341': { name: '随手拍张照', enabled: true },
  '5a1ccd886b3e9800116b7fe9': { name: '此刻的天空', enabled: true },
};

export function getTopicId(url: string): string | undefined {
  return new URL(url).pathname.match(/^\/topic\/([^/?#]+)/)?.[1];
}

export async function getTopics(): Promise<Topics> {
  const result = await browser.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Topics | undefined) ?? DEFAULT_TOPICS;
}

export async function ensureTopics(): Promise<void> {
  const result = await browser.storage.sync.get(STORAGE_KEY);
  if (result[STORAGE_KEY] == null) {
    await browser.storage.sync.set({ [STORAGE_KEY]: DEFAULT_TOPICS });
  }
}

export async function toggleTopic(topicId: string, name = '当前话题'): Promise<Topic> {
  const topics = await getTopics();
  const topic = topics[topicId] ?? { name, enabled: false };
  const next = { ...topic, enabled: !topic.enabled };
  await browser.storage.sync.set({
    [STORAGE_KEY]: { ...topics, [topicId]: next },
  });
  return next;
}

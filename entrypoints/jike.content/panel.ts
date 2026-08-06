import type { ContentScriptContext } from 'wxt/utils/content-script-context';

type PostSnapshot = {
  author: string;
  time: string;
  text: string;
  images: string[];
  comments: string[];
};

type DetailPanel = {
  root: HTMLElement;
  detail: HTMLElement;
  replyInput: HTMLTextAreaElement;
  replyButton: HTMLButtonElement;
  replyStatus: HTMLElement;
};

const CARD_SELECTOR = [
  '[data-post-id]',
  '.message-card-container',
  '.user-activity-container',
  '[class*="post-card"]',
].join(',');

function textFrom(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = element?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function snapshotPost(card: Element): PostSnapshot {
  const images = Array.from(card.querySelectorAll<HTMLImageElement>('img'))
    .map((image) => image.currentSrc || image.src)
    .filter(Boolean)
    .slice(0, 6);
  const comments = Array.from(card.querySelectorAll('[data-comment-id], .comment-item, .comment-content'))
    .map((comment) => comment.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)
    .filter((comment, index, all) => all.indexOf(comment) === index)
    .slice(0, 20);

  return {
    author: textFrom(card, [
      '.message-card-header-main',
      '.user-activity-header-main',
      '[class*="author"]',
      '[class*="user-name"]',
    ]) || '即刻用户',
    time: textFrom(card, ['.post-time', 'time', '[class*="time"]']),
    text: textFrom(card, [
      '.readable-content',
      '.message-card-body',
      '.user-activity-body',
    ]) || card.textContent?.replace(/\s+/g, ' ').trim() || '',
    images,
    comments,
  };
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function renderPost(detail: HTMLElement, post: PostSnapshot): void {
  detail.replaceChildren();

  const meta = createElement('div', 'jike-k-detail-meta');
  const author = createElement('strong');
  author.textContent = post.author;
  meta.append(author);
  if (post.time) {
    const time = createElement('span');
    time.textContent = post.time;
    meta.append(time);
  }

  const body = createElement('p', 'jike-k-detail-body');
  body.textContent = post.text;
  detail.append(meta, body);

  if (post.images.length > 0) {
    const gallery = createElement('div', 'jike-k-detail-gallery');
    for (const src of post.images) {
      const image = createElement('img');
      image.src = src;
      image.alt = '';
      image.loading = 'lazy';
      gallery.append(image);
    }
    detail.append(gallery);
  }

  const comments = createElement('div', 'jike-k-detail-comment-list');
  const commentsTitle = createElement('div', 'jike-k-detail-section-title');
  commentsTitle.textContent = '已加载回复';
  comments.append(commentsTitle);
  if (post.comments.length === 0) {
    const empty = createElement('p', 'jike-k-detail-empty');
    empty.textContent = '当前列表没有展开回复，发送回复时会调用即刻原生评论框。';
    comments.append(empty);
  } else {
    for (const comment of post.comments) {
      const item = createElement('p', 'jike-k-detail-comment');
      item.textContent = comment;
      comments.append(item);
    }
  }
  detail.append(comments);
}

function findNativeReplyButton(card: Element): HTMLElement | undefined {
  return Array.from(card.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
    .find((element) => /评论|回复|comment|reply/i.test(
      `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`,
    ));
}

function findNativeComposer(panel: HTMLElement): HTMLTextAreaElement | HTMLElement | undefined {
  const candidates = Array.from(document.querySelectorAll<HTMLTextAreaElement | HTMLElement>(
    'textarea, [contenteditable="true"]',
  ));
  return candidates.find((candidate) => !panel.contains(candidate));
}

function setNativeComposerValue(input: HTMLTextAreaElement | HTMLElement, value: string): void {
  if (input instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(input, value);
  } else {
    input.textContent = value;
  }
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
}

function findNativeSendButton(input: Element, panel: HTMLElement): HTMLElement | undefined {
  let scope: Element | null = input.closest('form, [class*="comment"], [class*="reply"]');
  for (let depth = 0; depth < 3 && scope; depth += 1) {
    const button = Array.from(scope.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .find((candidate) => !panel.contains(candidate) && /发送|回复|发布|send|reply/i.test(candidate.textContent ?? ''));
    if (button) return button;
    scope = scope.parentElement;
  }
  return Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
    .find((candidate) => !panel.contains(candidate) && /发送|回复|发布|send|reply/i.test(candidate.textContent ?? ''));
}

async function submitNativeReply(
  panel: DetailPanel,
  card: Element,
  value: string,
): Promise<void> {
  const nativeReplyButton = findNativeReplyButton(card);
  if (!nativeReplyButton) {
    panel.replyStatus.textContent = '没有找到这个帖子的原生评论入口，请先在页面中打开评论。';
    return;
  }

  nativeReplyButton.click();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  const nativeComposer = findNativeComposer(panel.root);
  if (!nativeComposer) {
    panel.replyStatus.textContent = '评论输入框还没有出现，请先在页面中打开评论。';
    return;
  }

  setNativeComposerValue(nativeComposer, value);
  const nativeSendButton = findNativeSendButton(nativeComposer, panel.root);
  if (!nativeSendButton) {
    panel.replyStatus.textContent = '已填入原生评论框，但没有找到发送按钮。';
    return;
  }

  nativeSendButton.click();
  panel.replyStatus.textContent = '回复已提交。';
  panel.replyInput.value = '';
}

function createPanel(): DetailPanel {
  const root = createElement('aside', 'jike-k-detail-panel');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <header class="jike-k-detail-header">
      <div>
        <span class="jike-k-detail-eyebrow">帖子详情</span>
        <h2>当前帖子</h2>
      </div>
      <button class="jike-k-detail-close" type="button" aria-label="关闭详情">×</button>
    </header>
    <div class="jike-k-detail-content">
      <section class="jike-k-detail-post" data-detail-post></section>
      <section class="jike-k-detail-replies">
        <div class="jike-k-detail-section-title">回复</div>
        <p class="jike-k-detail-hint">回复会通过即刻当前页面的原生评论控件提交。</p>
        <textarea class="jike-k-detail-reply-input" placeholder="写下你的回复…" rows="4"></textarea>
        <div class="jike-k-detail-reply-actions">
          <span class="jike-k-detail-reply-status" aria-live="polite"></span>
          <button class="jike-k-detail-reply-button" type="button">发送回复</button>
        </div>
      </section>
    </div>
  `;

  const detail = root.querySelector<HTMLElement>('[data-detail-post]');
  const replyInput = root.querySelector<HTMLTextAreaElement>('.jike-k-detail-reply-input');
  const replyButton = root.querySelector<HTMLButtonElement>('.jike-k-detail-reply-button');
  const replyStatus = root.querySelector<HTMLElement>('.jike-k-detail-reply-status');
  if (!detail || !replyInput || !replyButton || !replyStatus) {
    throw new Error('Detail panel UI is incomplete.');
  }

  return { root, detail, replyInput, replyButton, replyStatus };
}

export function mountDetailPanel(ctx: ContentScriptContext): void {
  const panel = createPanel();
  let selectedCard: Element | undefined;
  const closeButton = panel.root.querySelector<HTMLButtonElement>('.jike-k-detail-close');
  if (!closeButton) throw new Error('Detail panel close button is missing.');

  const close = () => {
    panel.root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('jike-k-has-detail-panel');
    selectedCard = undefined;
  };

  const open = (card: Element) => {
    selectedCard = card;
    renderPost(panel.detail, snapshotPost(card));
    panel.replyStatus.textContent = '';
    panel.root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('jike-k-has-detail-panel');
  };

  closeButton.addEventListener('click', close);
  panel.replyButton.addEventListener('click', () => {
    const value = panel.replyInput.value.trim();
    if (!value || !selectedCard) {
      panel.replyStatus.textContent = '请先输入回复内容。';
      return;
    }
    panel.replyButton.disabled = true;
    panel.replyStatus.textContent = '正在打开原生评论框…';
    void submitNativeReply(panel, selectedCard, value).finally(() => {
      panel.replyButton.disabled = false;
    });
  });

  ctx.addEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && panel.root.getAttribute('aria-hidden') === 'false') close();
  });
  ctx.addEventListener(document, 'click', (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || panel.root.contains(target)) return;
    const card = target.closest(CARD_SELECTOR);
    if (!card) return;
    if (target.closest('button, a, input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
    open(card);
  });

  document.body.append(panel.root);
}

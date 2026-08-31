import type { ContentScriptContext } from 'wxt/utils/content-script-context';

type PostSnapshot = {
  url?: string;
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
  detailFrame?: HTMLIFrameElement;
};

const CARD_SELECTOR = [
  '[data-post-id]',
  '.message-card-container',
  '.user-activity-container',
  '[class*="post-card"]',
].join(',');

const POST_TARGET_SELECTOR = [
  'a[href*="/post/"]',
  '[data-href*="/post/"]',
  '[data-url*="/post/"]',
  '[data-route*="/post/"]',
  '[to*="/post/"]',
  '[data-post-url*="/post/"]',
  '[data-post-href*="/post/"]',
  '[data-permalink*="/post/"]',
].join(',');
const POST_PATH_PATTERN = /\/post(?:\/|$)/;
const POST_ELEMENT_SELECTOR = `${POST_TARGET_SELECTOR},${CARD_SELECTOR}`;
const POST_URL_ATTRIBUTES = [
  'href',
  'data-href',
  'data-url',
  'data-route',
  'to',
  'data-post-url',
  'data-post-href',
  'data-permalink',
];
const QUOTE_CONTAINER_SELECTOR = [
  'blockquote',
  '[data-quoted-post]',
  '[data-quoted-post-id]',
  '[data-quote-post]',
  '[class*="quoted-post" i]',
  '[class*="quote-post" i]',
  '[class*="quoted" i]',
  '[class*="quote" i]',
].join(',');

function postUrlFromElement(element: Element): string | undefined {
  for (const attribute of POST_URL_ATTRIBUTES) {
    const raw = element.getAttribute(attribute);
    if (!raw || !raw.includes('/post/')) continue;
    try {
      const resolved = new URL(raw, location.href);
      if (resolved.origin === location.origin && resolved.pathname.includes('/post/')) {
        return resolved.href;
      }
    } catch {
      // Ignore malformed route attributes.
    }
  }
  const postId = element.getAttribute('data-post-id')?.trim();
  if (!postId) return undefined;
  const userId = [
    'data-user-id',
    'data-author-id',
    'data-user-uuid',
  ].map((attribute) => element.getAttribute(attribute)?.trim()).find(Boolean)
    ?? Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((link) => !isQuotedPostLink(link, element))
      .map((link) => {
        try {
          return new URL(link.href, location.href).pathname.match(/^\/u\/([^/?#]+)/)?.[1];
        } catch {
          return undefined;
        }
      })
      .find(Boolean);
  if (!userId) return undefined;
  return new URL(`/u/${encodeURIComponent(userId)}/post/${encodeURIComponent(postId)}`, location.origin).href;
}

function isQuotedPostLink(link: Element, card: Element): boolean {
  let ancestor = link.parentElement;
  while (ancestor && ancestor !== card) {
    if (ancestor.matches(QUOTE_CONTAINER_SELECTOR)) return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

function findPrimaryPostLink(card: Element, preferredLink?: Element): Element | undefined {
  if (preferredLink && isQuotedPostLink(preferredLink, card)) return preferredLink;
  if (preferredLink) return preferredLink;
  if (postUrlFromElement(card)) return card;
  const links = Array.from(card.querySelectorAll<HTMLElement>(POST_TARGET_SELECTOR));
  return links.find((link) => !isQuotedPostLink(link, card)) ?? links[0];
}

function textFrom(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = element?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function snapshotPost(card: Element, selectedLink?: Element): PostSnapshot {
  const postLink = findPrimaryPostLink(card, selectedLink)
    ?? (card.matches(POST_TARGET_SELECTOR) ? card : card.closest(POST_TARGET_SELECTOR));
  const url = postLink ? postUrlFromElement(postLink) : undefined;

  const images = Array.from(card.querySelectorAll<HTMLImageElement>('img'))
    .filter((image) => !/avatar|icon|logo|emoji|badge/i.test(
      `${typeof image.className === 'string' ? image.className : ''} ${image.alt}`,
    ))
    .map((image) => image.currentSrc || image.src)
    .filter(Boolean)
    .slice(0, 6);
  const comments = Array.from(card.querySelectorAll('[data-comment-id], .comment-item, .comment-content'))
    .map((comment) => comment.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)
    .filter((comment, index, all) => all.indexOf(comment) === index)
    .slice(0, 20);

  return {
    url,
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

const DETAIL_FRAME_STYLE = `
  html,
  body {
    min-height: 100% !important;
    margin: 0 !important;
  }
  html { overflow: auto !important; }
  body {
    height: auto !important;
    overflow: visible !important;
  }
  body > div {
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
  }
  header:has(button[aria-label*="关闭"]),
  header:has(button[aria-label*="close" i]) {
    display: none !important;
  }
  .jike-k-frame-hidden-header {
    display: none !important;
  }
  [role="banner"]:has(button[aria-label*="关闭"]),
  [role="banner"]:has(button[aria-label*="close" i]) {
    display: none !important;
  }
  [id^="_mobileTabBarShell"],
  [class^="_mobileTabBarShell"],
  [class*=" _mobileTabBarShell"],
  [id^="_mobileCreateButtonWrapper"],
  [class^="_mobileCreateButtonWrapper"],
  [class*=" _mobileCreateButtonWrapper"] {
    display: none !important;
  }
`;

function injectFrameStyle(frameDocument: Document | null): void {
  if (!frameDocument || frameDocument.getElementById('jike-k-frame-style')) return;
  const style = frameDocument.createElement('style');
  style.id = 'jike-k-frame-style';
  style.textContent = DETAIL_FRAME_STYLE;
  (frameDocument.head ?? frameDocument.documentElement)?.append(style);
}

function markFrameHeader(frameDocument: Document | null): void {
  if (!frameDocument?.body) return;
  const viewportWidth = frameDocument.defaultView?.innerWidth || 480;
  const headers = Array.from(frameDocument.querySelectorAll<HTMLElement>('header, [role="banner"]')).filter((header) => {
    const text = header.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const rect = header.getBoundingClientRect();
    return rect.top < 220 && rect.width >= viewportWidth * 0.6
      && !header.querySelector('img')
      && (/动态详情|关闭|close|返回|back/i.test(text) || header.querySelector('button'));
  });
  for (const header of headers) {
    let candidate: HTMLElement | null = header;
    let best: HTMLElement = header;
    for (let depth = 0; candidate && depth < 5; depth += 1) {
      const rect = candidate.getBoundingClientRect();
      if (rect.width >= viewportWidth * 0.6 && rect.height > 0 && rect.height <= 280
        && rect.height >= best.getBoundingClientRect().height) {
        best = candidate;
      }
      candidate = candidate.parentElement;
    }
    best.classList.add('jike-k-frame-hidden-header');
  }

  const titleNodes = Array.from(frameDocument.querySelectorAll<HTMLElement>(
    'h1, h2, [role="heading"], [class*="title" i], [class*="header" i]',
  )).filter((element) => /动态详情/.test(element.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
  for (const titleNode of titleNodes) {
    let candidate: HTMLElement | null = titleNode;
    let best: HTMLElement | undefined;
    for (let depth = 0; candidate && candidate !== frameDocument.body && depth < 7; depth += 1) {
      const rect = candidate.getBoundingClientRect();
      if (rect.top < 220 && rect.width >= viewportWidth * 0.6 && rect.height > 0 && rect.height <= 320
        && (!best || rect.height >= best.getBoundingClientRect().height)) {
        best = candidate;
      }
      candidate = candidate.parentElement;
    }
    best?.classList.add('jike-k-frame-hidden-header');
  }
}

function renderPost(panel: DetailPanel, post: PostSnapshot, onFrameSettled?: () => void): void {
  const detail = panel.detail;
  if (panel.detailFrame) {
    panel.detailFrame.src = 'about:blank';
  }
  panel.detailFrame = undefined;
  detail.replaceChildren();

  if (post.url) {
    const frame = createElement('iframe', 'jike-k-detail-iframe');
    frame.title = '帖子详情';
    frame.style.visibility = 'hidden';
    frame.src = post.url;
    frame.addEventListener('load', () => {
      try {
        injectFrameStyle(frame.contentDocument);
        markFrameHeader(frame.contentDocument);
        if (frame.contentDocument?.body) {
          const headerObserver = new MutationObserver(() => markFrameHeader(frame.contentDocument));
          headerObserver.observe(frame.contentDocument.body, { childList: true, subtree: true });
          window.setTimeout(() => headerObserver.disconnect(), 5000);
        }
      } catch {
        // A navigation that becomes cross-origin cannot be styled from the parent.
      }
      window.setTimeout(() => {
        try {
          markFrameHeader(frame.contentDocument);
        } catch {
          // Ignore a frame that navigated away before the composer appeared.
        }
      }, 150);
      window.setTimeout(() => {
        try {
          markFrameHeader(frame.contentDocument);
        } catch {
          // Ignore a frame that navigated away before the page settled.
        }
      }, 600);
      frame.dataset.jikeKFrameReady = 'true';
      frame.style.visibility = 'visible';
      onFrameSettled?.();
    }, { once: true });
    frame.addEventListener('error', () => {
      frame.dataset.jikeKFrameReady = 'true';
      frame.style.visibility = 'visible';
      onFrameSettled?.();
    }, { once: true });
    detail.append(frame);
    panel.detailFrame = frame;
    return;
  }

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

function renderEmpty(detail: HTMLElement): void {
  detail.replaceChildren();
  const empty = createElement('div', 'jike-k-detail-empty-state');
  const title = createElement('h3');
  title.textContent = '选择一个帖子';
  const hint = createElement('p');
  hint.textContent = '点击左侧信息流中的帖子，在这里查看详情并回复。';
  empty.append(title, hint);
  detail.append(empty);
}

function isInsideQuoteContainer(element: Element): boolean {
  let ancestor = element.parentElement;
  for (let depth = 0; ancestor && depth < 12; depth += 1) {
    if (ancestor.matches(QUOTE_CONTAINER_SELECTOR)) return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

function findNativeReplyButton(root: ParentNode): HTMLElement | undefined {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
    .filter((element) => /评论|回复|comment|reply/i.test(
      `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`,
    ));
  return candidates.find((element) => !isInsideQuoteContainer(element)) ?? candidates[0];
}

function findNativeComposer(root: ParentNode, panel: HTMLElement): HTMLTextAreaElement | HTMLElement | undefined {
  const candidates = Array.from(root.querySelectorAll<HTMLTextAreaElement | HTMLElement>(
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

function findNativeSendButton(input: Element, panel: HTMLElement, root: ParentNode): HTMLElement | undefined {
  let scope: Element | null = input.closest('form, [class*="comment"], [class*="reply"]');
  for (let depth = 0; depth < 3 && scope; depth += 1) {
    const button = Array.from(scope.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .find((candidate) => !panel.contains(candidate) && /发送|回复|发布|send|reply/i.test(candidate.textContent ?? ''));
    if (button) return button;
    scope = scope.parentElement;
  }
  return Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]'))
    .find((candidate) => !panel.contains(candidate) && /发送|回复|发布|send|reply/i.test(candidate.textContent ?? ''));
}

async function submitNativeReply(
  panel: DetailPanel,
  card: Element,
  value: string,
): Promise<void> {
  const frame = panel.detailFrame;
  if (frame?.contentDocument?.readyState === 'loading') {
    await Promise.race([
      new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true })),
      new Promise<void>((resolve) => window.setTimeout(resolve, 5000)),
    ]);
  }
  const frameDocument = frame?.contentDocument;
  const replyRoot = frameDocument ?? card;
  const nativeReplyButton = findNativeReplyButton(replyRoot);
  if (!nativeReplyButton) {
    panel.replyStatus.textContent = '没有找到这个帖子的原生评论入口，请先在页面中打开评论。';
    return;
  }

  nativeReplyButton.click();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  const nativeComposer = findNativeComposer(replyRoot, panel.root);
  if (!nativeComposer) {
    panel.replyStatus.textContent = '评论输入框还没有出现，请先在页面中打开评论。';
    return;
  }

  setNativeComposerValue(nativeComposer, value);
  const nativeSendButton = findNativeSendButton(nativeComposer, panel.root, replyRoot);
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
  root.setAttribute('aria-hidden', 'false');
  root.innerHTML = `
    <div class="jike-k-detail-resizer" role="separator" aria-orientation="vertical" aria-label="调整栏宽度"></div>
    <header class="jike-k-detail-header">
      <div>
        <span class="jike-k-detail-eyebrow">帖子详情</span>
        <h2>当前帖子</h2>
      </div>
      <button class="jike-k-detail-close" type="button" aria-label="关闭详情">×</button>
    </header>
    <div class="jike-k-detail-content">
      <section class="jike-k-detail-post" data-detail-post></section>
    </div>
    <section class="jike-k-detail-replies">
      <div class="jike-k-detail-reply-composer">
        <div class="jike-k-detail-reply-input-row">
          <span class="jike-k-detail-reply-avatar" aria-hidden="true"><img alt="" /></span>
          <textarea class="jike-k-detail-reply-input" placeholder="友善发言的人运气都不会太差" rows="1"></textarea>
        </div>
        <div class="jike-k-detail-reply-actions">
          <button class="jike-k-detail-reply-button" type="button">回复</button>
        </div>
        <span class="jike-k-detail-reply-status" aria-live="polite"></span>
      </div>
    </section>
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
  let lastActivatedCard: Element | undefined;
  let lastActivationAt = 0;
  let lastOpenedUrl: string | undefined;
  let observedUrl = location.href;
  let routeGuardEnabled = !POST_PATH_PATTERN.test(location.pathname);
  const closeButton = panel.root.querySelector<HTMLButtonElement>('.jike-k-detail-close');
  const resizer = panel.root.querySelector<HTMLElement>('.jike-k-detail-resizer');
  if (!closeButton || !resizer) throw new Error('Detail panel controls are incomplete.');
  let selectedLink: Element | undefined;
  let selectedPostUrl: string | undefined;

  const postPath = (url: string): string | undefined => {
    try {
      return new URL(url, location.href).pathname;
    } catch {
      return undefined;
    }
  };

  const restoreSelectedState = () => {
    if (!selectedPostUrl) return;
    const selectedPath = postPath(selectedPostUrl);
    if (!selectedPath) return;
    const matchingElement = Array.from(document.querySelectorAll<HTMLElement>(POST_ELEMENT_SELECTOR))
      .find((element) => postPath(postUrlFromElement(element) ?? '') === selectedPath);
    if (!matchingElement) return;
    const matchingCard = matchingElement.closest(CARD_SELECTOR) ?? matchingElement;
    const matchingLink = findPrimaryPostLink(matchingCard, matchingElement);
    matchingCard.classList.add('jike-k-selected-post');
    matchingLink?.classList.add('jike-k-selected-post');
    selectedCard = matchingCard;
    selectedLink = matchingLink;
  };

  const setPanelWidth = (width: number) => {
    const maxWidth = Math.min(720, Math.round(window.innerWidth * 0.6));
    const nextWidth = Math.max(320, Math.min(maxWidth, Math.round(width)));
    const value = `${nextWidth}px`;
    panel.root.style.setProperty('--jike-k-detail-panel-width', value);
    document.documentElement.style.setProperty('--jike-k-detail-panel-width', value);
  };
  let resizing = false;
  resizer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || window.innerWidth <= 800) return;
    resizing = true;
    resizer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  resizer.addEventListener('pointermove', (event) => {
    if (!resizing) return;
    setPanelWidth(window.innerWidth - event.clientX);
  });
  const stopResizing = (event: PointerEvent) => {
    if (!resizing) return;
    resizing = false;
    if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
  };
  resizer.addEventListener('pointerup', stopResizing);
  resizer.addEventListener('pointercancel', stopResizing);

  const close = () => {
    if (panel.detailFrame) {
      panel.detailFrame.src = 'about:blank';
      panel.detailFrame = undefined;
    }
    renderEmpty(panel.detail);
    panel.replyInput.value = '';
    panel.replyStatus.textContent = '';
    panel.root.classList.remove('jike-k-native-reply-mode');
    selectedCard?.classList.remove('jike-k-selected-post');
    selectedCard?.classList.remove('jike-k-post-loading');
    selectedLink?.classList.remove('jike-k-selected-post');
    selectedCard = undefined;
    selectedLink = undefined;
    selectedPostUrl = undefined;
  };

  const open = (card: Element, link?: Element) => {
    selectedCard?.classList.remove('jike-k-selected-post');
    selectedCard?.classList.remove('jike-k-post-loading');
    selectedLink?.classList.remove('jike-k-selected-post');
    selectedCard = card;
    selectedLink = link;
    card.classList.add('jike-k-selected-post');
    link?.classList.add('jike-k-selected-post');
    const avatar = panel.root.querySelector<HTMLImageElement>('.jike-k-detail-reply-avatar img');
    const sourceAvatar = document.querySelector<HTMLImageElement>(
      'header img, [class*="current-user"] img, [class*="user-avatar"] img',
    );
    if (avatar && sourceAvatar) avatar.src = sourceAvatar.currentSrc || sourceAvatar.src;
    const post = snapshotPost(card, link);
    card.classList.toggle('jike-k-post-loading', Boolean(post.url));
    lastOpenedUrl = post.url;
    selectedPostUrl = post.url;
    renderPost(panel, post, () => card.classList.remove('jike-k-post-loading'));
    panel.root.classList.toggle('jike-k-native-reply-mode', Boolean(post.url));
    panel.replyStatus.textContent = '';
    panel.root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('jike-k-has-detail-panel');
  };

  const openPostUrl = (url: string) => {
    const targetUrl = new URL(url, location.href);
    const matchingElement = Array.from(document.querySelectorAll<HTMLElement>(POST_ELEMENT_SELECTOR))
      .find((element) => {
        const linkUrl = postUrlFromElement(element);
        return linkUrl ? new URL(linkUrl).pathname === targetUrl.pathname : false;
      });
    if (matchingElement) {
      const card = matchingElement.closest(CARD_SELECTOR) ?? matchingElement;
      open(card, findPrimaryPostLink(card, matchingElement));
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    open(link, link);
  };

  const guardPostRoute = () => {
    const currentUrl = location.href;
    if (currentUrl === observedUrl) return;
    const currentIsPost = POST_PATH_PATTERN.test(location.pathname);
    const previousIsPost = POST_PATH_PATTERN.test(new URL(observedUrl).pathname);
    if (routeGuardEnabled && currentIsPost && !previousIsPost) {
      history.replaceState(history.state, document.title, observedUrl);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      if (currentUrl !== lastOpenedUrl) openPostUrl(currentUrl);
      return;
    }
    observedUrl = currentUrl;
    routeGuardEnabled = true;
  };

  const eventElements = (event: Event): Element[] => event.composedPath()
    .filter((item): item is Element => item instanceof Element);

  const handlePostActivation = (event: MouseEvent | PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || panel.root.contains(target)) return;
    if ('button' in event && event.button !== 0) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const path = eventElements(event);
    const pathPostLink = path.find((element) => postUrlFromElement(element))
      ?? target.closest(POST_TARGET_SELECTOR)
      ?? undefined;
    const card = path.find((element) => element.matches(CARD_SELECTOR))
      ?? target.closest(CARD_SELECTOR)
      ?? pathPostLink;
    const postLink = card ? findPrimaryPostLink(card, pathPostLink) : pathPostLink;
    if (!card) return;
    if (target.closest('button, input, textarea, [contenteditable="true"]')) return;
    if (!postLink && !target.closest(CARD_SELECTOR)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const now = Date.now();
    const activationKey = postLink ?? target;
    if (activationKey === lastActivatedCard && now - lastActivationAt < 600) return;
    lastActivatedCard = activationKey;
    lastActivationAt = now;
    open(card, postLink);
  };

  const bindPostLinks = () => {
    document.querySelectorAll<HTMLElement>(POST_TARGET_SELECTOR).forEach((link) => {
      if (link.dataset.jikeKDetailBound === 'true') return;
      link.dataset.jikeKDetailBound = 'true';
      const handleLinkEvent = (event: MouseEvent | PointerEvent) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if ('button' in event && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const card = link.closest(CARD_SELECTOR) ?? link;
        const now = Date.now();
        if (link === lastActivatedCard && now - lastActivationAt < 600) return;
        lastActivatedCard = link;
        lastActivationAt = now;
        open(card, link);
      };
      link.addEventListener('mousedown', handleLinkEvent as EventListener, true);
      link.addEventListener('mouseup', handleLinkEvent as EventListener, true);
      link.addEventListener('pointerdown', handleLinkEvent as EventListener, true);
      link.addEventListener('pointerup', handleLinkEvent as EventListener, true);
      link.addEventListener('click', handleLinkEvent as EventListener, true);
    });
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
  ctx.addEventListener(window, 'popstate', guardPostRoute);
  ctx.setInterval(guardPostRoute, 100);
  const eventOptions = { capture: true } as const;
  for (const eventName of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click'] as const) {
    ctx.addEventListener(window, eventName, handlePostActivation as EventListener, eventOptions);
    ctx.addEventListener(document, eventName, handlePostActivation as EventListener, eventOptions);
  }

  const mount = () => {
    if (!document.body || panel.root.isConnected) return;
    document.body.append(panel.root);
    renderEmpty(panel.detail);
    document.documentElement.classList.add('jike-k-has-detail-panel');
    bindPostLinks();
    restoreSelectedState();
  };
  if (document.body) {
    mount();
  } else {
    ctx.addEventListener(document, 'DOMContentLoaded', mount, { once: true });
  }

  const linkObserver = new MutationObserver(() => {
    mount();
    bindPostLinks();
    restoreSelectedState();
  });
  const observeLinks = () => {
    if (!document.documentElement) return;
    linkObserver.observe(document.documentElement, { childList: true, subtree: true });
  };
  observeLinks();
  if (!document.documentElement) {
    ctx.addEventListener(document, 'DOMContentLoaded', observeLinks, { once: true });
  }
  ctx.onInvalidated(() => linkObserver.disconnect());
}

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
].join(',');
const POST_PATH_PATTERN = /\/post(?:\/|$)/;

function postUrlFromElement(element: Element): string | undefined {
  for (const attribute of ['href', 'data-href', 'data-url', 'data-route', 'to']) {
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
  return undefined;
}

function textFrom(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = element?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function snapshotPost(card: Element): PostSnapshot {
  const postLink = card.matches(POST_TARGET_SELECTOR)
    ? card
    : card.querySelector(POST_TARGET_SELECTOR)
      ?? card.closest(POST_TARGET_SELECTOR);
  const url = postLink ? postUrlFromElement(postLink) : undefined;

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

function hidePageChrome(frameDocument: Document, viewportWidth: number, viewportHeight: number): void {
  if (!frameDocument.head) return;
  if (!frameDocument.getElementById('jike-k-hide-chrome')) {
    const style = frameDocument.createElement('style');
    style.id = 'jike-k-hide-chrome';
    style.textContent = `
    html {
      min-height: 100% !important;
      margin: 0 !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }
    body {
      min-height: 100% !important;
      height: auto !important;
      margin: 0 !important;
      padding-bottom: 96px !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
    }
    body > div {
      min-height: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    [data-jike-k-hidden-chrome="true"] { display: none !important; }
    [data-jike-k-native-composer="true"] {
      position: fixed !important;
      right: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      z-index: 2147483646 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 10px 24px 12px !important;
      background: #fff !important;
      border-top: 1px solid #e5e9ed !important;
    }
    [data-jike-k-image-group="true"] {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      gap: 12px !important;
    }
    [data-jike-k-image-item="true"] {
      display: block !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      aspect-ratio: auto !important;
      overflow: visible !important;
    }
    [data-jike-k-image-item="true"] > * {
      width: 100% !important;
      height: auto !important;
      max-height: none !important;
      aspect-ratio: auto !important;
    }
    [data-jike-k-full-image="true"] {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain !important;
    }
    `;
    frameDocument.head.append(style);
  }
  for (const element of Array.from(frameDocument.querySelectorAll<HTMLElement>('[data-jike-k-hidden-chrome]'))) {
    element.removeAttribute('data-jike-k-hidden-chrome');
  }
  for (const attribute of ['data-jike-k-image-group', 'data-jike-k-image-item', 'data-jike-k-full-image']) {
    for (const element of Array.from(frameDocument.querySelectorAll<HTMLElement>(`[${attribute}]`))) {
      element.removeAttribute(attribute);
    }
  }

  const markHidden = (element: HTMLElement) => {
    element.dataset.jikeKHiddenChrome = 'true';
  };
  const hideCompactContainer = (input: HTMLElement) => {
    let candidate: HTMLElement = input;
    for (let depth = 0; depth < 5 && candidate.parentElement; depth += 1) {
      const parent = candidate.parentElement;
      const rect = parent.getBoundingClientRect();
      if (rect.width >= viewportWidth * 0.65 && rect.height <= 260) {
        markHidden(parent);
        return;
      }
      candidate = parent;
    }
    markHidden(input);
  };
  const markNativeComposer = (input: HTMLElement) => {
    let candidate: HTMLElement = input;
    for (let depth = 0; depth < 5 && candidate.parentElement; depth += 1) {
      const parent = candidate.parentElement;
      const rect = parent.getBoundingClientRect();
      if (rect.width >= viewportWidth * 0.65 && rect.height <= 260) {
        parent.dataset.jikeKNativeComposer = 'true';
        return;
      }
      candidate = parent;
    }
    input.dataset.jikeKNativeComposer = 'true';
  };

  const normalizeImageGroups = () => {
    const isContentImage = (image: HTMLImageElement) => {
      const rect = image.getBoundingClientRect();
      const className = typeof image.className === 'string' ? image.className : '';
      return rect.width >= 120 && rect.height >= 120 && !/avatar|icon|logo|emoji|badge/i.test(className);
    };
    const groups = frameDocument.querySelectorAll<HTMLElement>(
      '.pic-group, .picture-list, [class*="image-grid"], [class*="image-gallery"], [class*="media-grid"], [class*="photo-grid"]',
    );
    for (const group of Array.from(groups)) {
      const images = Array.from(group.querySelectorAll<HTMLImageElement>('img')).filter(isContentImage);
      if (images.length < 2) continue;
      group.dataset.jikeKImageGroup = 'true';
      for (const image of images) {
        image.dataset.jikeKFullImage = 'true';
        image.parentElement?.setAttribute('data-jike-k-image-item', 'true');
      }
    }
  };

  normalizeImageGroups();

  for (const element of Array.from(frameDocument.querySelectorAll<HTMLElement>('body *'))) {
    const computed = frameDocument.defaultView?.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const placeholder = element.getAttribute('placeholder') ?? '';
    if (/动态详情/.test(text) && rect.top <= 180 && rect.height <= 180) {
      hideCompactContainer(element);
      continue;
    }
    const isComposerSignal = /友善发言/.test(placeholder)
      || (rect.height > 0 && rect.height <= 260 && rect.width >= viewportWidth * 0.65 && /友善发言/.test(text));
    if (isComposerSignal) {
      markNativeComposer(element);
      continue;
    }
    const className = typeof element.className === 'string' ? element.className : '';
    if (/comment|reply/i.test(`${element.id} ${className}`)) {
      element.removeAttribute('data-jike-k-hidden-chrome');
      continue;
    }
    if (!computed || !['fixed', 'sticky'].includes(computed.position)) continue;
    const fullWidth = rect.width >= viewportWidth * 0.75;
    const compact = rect.height > 0 && rect.height <= 140;
    const atBottom = rect.bottom >= viewportHeight - 100;
    const buttonCount = element.querySelectorAll('button, a, [role="button"]').length;
    const isBottomNavigation = atBottom && /footer|tabbar|bottom-nav|navbar/i.test(
      `${element.id} ${className}`,
    );
    const isLikelyBottomBar = fullWidth && compact && atBottom && buttonCount >= 4;
    const isFloatingAction = atBottom && rect.width <= 140 && rect.height <= 140
      && (/fab|float|add|create|plus/i.test(`${element.id} ${className}`) || text === '+');
    if (isBottomNavigation || isLikelyBottomBar || isFloatingAction) {
      markHidden(element);
    }
  }

  normalizeImageGroups();
}

function prepareDetailFrame(frame: HTMLIFrameElement): void {
  const frameDocument = frame.contentDocument;
  if (!frameDocument) return;
  hidePageChrome(frameDocument, frame.clientWidth || 480, frame.clientHeight || 800);
}

export function mountFrameChromeHider(ctx: ContentScriptContext): void {
  const hide = () => hidePageChrome(document, window.innerWidth || 480, window.innerHeight || 800);

  // Inject the base rules before the first completed paint. Follow-up scans are
  // deliberately sparse to avoid competing with the host app's rendering.
  hide();
  if (document.readyState === 'loading') {
    ctx.addEventListener(document, 'DOMContentLoaded', hide, { once: true });
  }
  ctx.setTimeout(hide, 150);
  ctx.setTimeout(hide, 500);
  ctx.setInterval(hide, 1500);
}

function renderPost(panel: DetailPanel, post: PostSnapshot): void {
  const detail = panel.detail;
  panel.detailFrame = undefined;
  detail.replaceChildren();

  if (post.url) {
    const frame = createElement('iframe', 'jike-k-detail-iframe');
    frame.title = '帖子详情';
    frame.style.visibility = 'hidden';
    frame.src = post.url;
    frame.addEventListener('load', () => {
      prepareDetailFrame(frame);
      frame.dataset.jikeKFrameReady = 'true';
      frame.style.visibility = 'visible';
    }, { once: true });
    frame.addEventListener('error', () => {
      frame.dataset.jikeKFrameReady = 'true';
      frame.style.visibility = 'visible';
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

function findNativeReplyButton(root: ParentNode): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('button, a, [role="button"]'))
    .find((element) => /评论|回复|comment|reply/i.test(
      `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`,
    ));
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
          <button class="jike-k-detail-reply-media" type="button" aria-label="添加图片"></button>
          <span class="jike-k-detail-reply-spacer"></span>
          <button class="jike-k-detail-reply-mode" type="button" aria-label="切换回复模式">↔</button>
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
  let observedUrl = location.href;
  let routeGuardEnabled = !POST_PATH_PATTERN.test(location.pathname);
  const closeButton = panel.root.querySelector<HTMLButtonElement>('.jike-k-detail-close');
  const resizer = panel.root.querySelector<HTMLElement>('.jike-k-detail-resizer');
  if (!closeButton || !resizer) throw new Error('Detail panel controls are incomplete.');

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
    renderEmpty(panel.detail);
    panel.replyInput.value = '';
    panel.replyStatus.textContent = '';
    panel.root.classList.remove('jike-k-native-reply-mode');
    selectedCard?.classList.remove('jike-k-selected-post');
    selectedCard = undefined;
  };

  const open = (card: Element) => {
    selectedCard?.classList.remove('jike-k-selected-post');
    selectedCard = card;
    card.classList.add('jike-k-selected-post');
    const avatar = panel.root.querySelector<HTMLImageElement>('.jike-k-detail-reply-avatar img');
    const sourceAvatar = document.querySelector<HTMLImageElement>(
      'header img, [class*="current-user"] img, [class*="user-avatar"] img',
    );
    if (avatar && sourceAvatar) avatar.src = sourceAvatar.currentSrc || sourceAvatar.src;
    const post = snapshotPost(card);
    renderPost(panel, post);
    panel.root.classList.toggle('jike-k-native-reply-mode', Boolean(post.url));
    panel.replyStatus.textContent = '';
    panel.root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('jike-k-has-detail-panel');
  };

  const openPostUrl = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    open(link);
  };

  const guardPostRoute = () => {
    const currentUrl = location.href;
    if (currentUrl === observedUrl) return;
    const currentIsPost = POST_PATH_PATTERN.test(location.pathname);
    const previousIsPost = POST_PATH_PATTERN.test(new URL(observedUrl).pathname);
    if (routeGuardEnabled && currentIsPost && !previousIsPost) {
      history.replaceState(history.state, document.title, observedUrl);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      openPostUrl(currentUrl);
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
    const postLink = path.find((element) => postUrlFromElement(element))
      ?? target.closest(POST_TARGET_SELECTOR);
    const card = path.find((element) => element.matches(CARD_SELECTOR))
      ?? target.closest(CARD_SELECTOR)
      ?? postLink;
    if (!card) return;
    if (target.closest('button, input, textarea, [contenteditable="true"]')) return;
    if (!postLink && !target.closest(CARD_SELECTOR)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const now = Date.now();
    if (card === lastActivatedCard && now - lastActivationAt < 600) return;
    lastActivatedCard = card;
    lastActivationAt = now;
    open(card);
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
        if (card === lastActivatedCard && now - lastActivationAt < 600) return;
        lastActivatedCard = card;
        lastActivationAt = now;
        open(card);
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
  };
  if (document.body) {
    mount();
  } else {
    ctx.addEventListener(document, 'DOMContentLoaded', mount, { once: true });
  }

  const linkObserver = new MutationObserver(() => {
    mount();
    bindPostLinks();
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

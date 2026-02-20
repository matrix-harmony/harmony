const state = require('./state');
const { mxcToUrl, escapeHtml, linkify, makeAvatar, scrollToBottom } = require('./utils');
const { showUserProfile } = require('./profile');

const container = document.getElementById('messages-container');

const ALLOWED_TAGS = new Set(['a', 'b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'del', 'u', 'blockquote', 'span', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'strong', 'u', 'em', 'del', 'code', 'br']);

function sanitiseHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  function clean(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }

      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(document.createTextNode(child.textContent));
        continue;
      }

      const keep = tag === 'a' ? ['href', 'data-mention', 'target', 'rel']
                 : tag === 'code' ? ['class']
                 : tag === 'span' ? ['data-mx-spoiler']
                 : [];
      for (const attr of [...child.attributes]) {
        if (!keep.includes(attr.name)) child.removeAttribute(attr.name);
      }

      if (tag === 'a' && child.dataset.mention) child.removeAttribute('href');

      if (tag === 'a') {
        const href = child.getAttribute('href') || '';
        if (href.startsWith('https://matrix.to/#/@')) {
          const userId = decodeURIComponent(href.replace('https://matrix.to/#/', ''));
          child.setAttribute('data-mention', userId);
          child.removeAttribute('href');
        }
      }

      tmp.querySelectorAll('span[data-mx-spoiler]').forEach(el => {
      el.classList.add('spoiler');
    });

      clean(child);
    }
  }

  clean(tmp);

  return tmp.innerHTML;
}

function renderBody(content) {
  if (content.format === 'org.matrix.custom.html' && content.formatted_body) {
    const html = sanitiseHtml(content.formatted_body);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
    });
    return tmp.innerHTML;
  }
  return linkify(content.body || '');
}

function getSenderName(userId) {
  if (!state.roomId) return userId.split(':')[0].slice(1);
  const member = state.client.getRoom(state.roomId)?.getMember(userId);
  if (!member?.name) return userId.split(':')[0].slice(1);
  const i = member.name.indexOf('(');
  return i > 0 ? member.name.slice(0, i).trim() : member.name;
}

function isGrouped(sender, ts, prevEl) {
  if (!prevEl) return false;
  return prevEl.dataset.senderId === sender &&
    ts - parseInt(prevEl.dataset.timestamp || 0) < 5 * 60 * 1000;
}

function buildMessageEl(event, prevEvent = null) {
  const sender = event.getSender();
  const content = event.getContent();
  const ts = new Date(event.getDate());
  const timeStr = ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const name = getSenderName(sender);
  const letter = name[0].toUpperCase();

  let grouped = false;
  if (prevEvent) {
    grouped = prevEvent.getSender() === sender &&
      prevEvent.getType() === 'm.room.message' &&
      ts - new Date(prevEvent.getDate()) < 5 * 60 * 1000;
  } else {
    const last = container.querySelector('.message:last-of-type');
    if (last) grouped = isGrouped(sender, ts.getTime(), last);
  }

  const myId = state.client.getUserId();
  const bodyText = content.body || '';
  const myName = (() => {
    const member = state.client.getRoom(state.roomId)?.getMember(myId);
    const raw = member?.name || myId.split(':')[0].slice(1);
    const i = raw.indexOf('(');
    return i > 0 ? raw.slice(0, i).trim() : raw;
  })();
  const isMentioned = sender !== myId && (
    bodyText.includes(myId) ||
    (myName && bodyText.toLowerCase().includes('@' + myName.toLowerCase()))
  );

  const el = document.createElement('div');
  el.className = grouped ? 'message message-grouped' : 'message';
  if (isMentioned) el.classList.add('message-mention');
  el.dataset.senderId = sender;
  el.dataset.timestamp = ts.getTime();

  let body = '';
  if (content.msgtype === 'm.image') {
    const url = mxcToUrl(content.url);
    body = url
      ? `<div class="message-image-container"><img src="${url}" alt="${escapeHtml(content.body || 'Image')}" class="message-image" loading="lazy"></div>`
      : `<div class="message-content">[Image]</div>`;
  } else {
    body = `<div class="message-content">${renderBody(content)}</div>`;
  }

  if (grouped) {
    el.innerHTML = `
      <div class="message-grouped-content">
        <span class="message-time-hover">${timeStr}</span>
        ${body}
      </div>`;
  } else {
    const room = state.client.getRoom(state.roomId);
    const avatarUrl = mxcToUrl(room?.getMember(sender)?.getMxcAvatarUrl());
    const avatarEl = makeAvatar(avatarUrl, letter, 'message-avatar');
    el.appendChild(avatarEl);
    el.innerHTML += `
      <div class="message-header">
        <span class="message-sender">${escapeHtml(name)}</span>
        <span class="message-time">${timeStr}</span>
      </div>
      ${body}`;
  }

  return el;
}


function loadMessages(roomId) {
  const room = state.client.getRoom(roomId);
  const timeline = room.timeline;
  container.innerHTML = '';

  if (state.client.isRoomEncrypted(roomId)) {
    const notice = document.createElement('div');
    notice.className = 'encryption-notice';
    notice.innerHTML = 'Encryption currently not supported. Coming Soon.';
    container.appendChild(notice);
    return;
  }

  if (!timeline.length) {
    container.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
    state.canLoadMore = false;
    return;
  }

  timeline.slice(-100).forEach((ev, i, arr) => {
    if (ev.getType() === 'm.room.message')
      container.appendChild(buildMessageEl(ev, i > 0 ? arr[i - 1] : null));
  });

  state.canLoadMore = true;
  scrollToBottom();
  setupInfiniteScroll(roomId);
}

async function loadFullHistory(roomId) {
  if (state.client.isRoomEncrypted(roomId)) return;
  const room = state.client.getRoom(roomId);
  let loads = 0;

while (loads < 3) {
  if (state.roomId !== roomId) return;
  try {
    const result = await state.client.scrollback(room, 50);
    if (state.roomId !== roomId) return;
    if (!result || result === 0) break;
    loads++;
  } catch {
    break;
  }
}

if (state.roomId !== roomId) return;
const prevScroll = container.scrollHeight - container.scrollTop;
  rebuildMessages(room.timeline);
  container.scrollTop = container.scrollHeight - prevScroll;
  state.canLoadMore = loads < 10;
  setupInfiniteScroll(roomId);
}

function rebuildMessages(timeline) {
  container.innerHTML = '';
  timeline.forEach((ev, i, arr) => {
    if (ev.getType() !== 'm.room.message') return;
    const el = buildMessageEl(ev, i > 0 ? arr[i - 1] : null);
    el.dataset.eventId = ev.getId();
    container.appendChild(el);
  });
}

function setupInfiniteScroll(roomId) {
  container.removeEventListener('scroll', container._scrollHandler);
  container._scrollHandler = () => {
    if (container.scrollTop < 800 && !state.loadingHistory && state.canLoadMore) {
      loadOlderMessages(roomId);
    }
  };
  container.addEventListener('scroll', container._scrollHandler);
}

async function loadOlderMessages(roomId) {
  if (state.loadingHistory || !state.canLoadMore) return;
  state.loadingHistory = true;

  const room = state.client.getRoom(roomId);
  const prevHeight = container.scrollHeight;

  try {
    const result = await state.client.scrollback(room, 50);
    const timeline = room.timeline;

    const oldestId = container.querySelector('.message')?.dataset?.eventId;
    let startIdx = oldestId ? timeline.findIndex(e => e.getId() === oldestId) : 0;
    if (startIdx === -1) startIdx = 0;

    const older = timeline.slice(Math.max(0, startIdx - 50), startIdx);
    [...older].reverse().forEach((ev, i, arr) => {
      if (ev.getType() !== 'm.room.message') return;
      const prevEv = i < arr.length - 1 ? arr[i + 1] : null;
      const el = buildMessageEl(ev, prevEv);
      el.dataset.eventId = ev.getId();
      container.prepend(el);
    });

    container.scrollTop = container.scrollHeight - prevHeight;
    state.canLoadMore = result !== 0;
  } catch {
    state.canLoadMore = false;
  }

  state.loadingHistory = false;
}

function handleIncoming(event, room, toStart) {
  if (toStart || room.roomId !== state.roomId) return;
  if (event.getType() !== 'm.room.message') return;

  if (event.getSender() === state.client.getUserId()) {
    container.querySelectorAll('[data-temp-id]').forEach(el => el.remove());
  }

  container.appendChild(buildMessageEl(event));
  scrollToBottom();
}

document.addEventListener('click', e => {

  if (e.target.closest('.message-avatar') || e.target.classList.contains('message-sender')) {
    const msg = e.target.closest('.message');
    if (!msg) return;
    const member = state.client.getRoom(state.roomId)?.getMember(msg.dataset.senderId);
    if (member) showUserProfile(member, e.target.closest('.message-avatar') || e.target);
    return;
  }

  if (e.target.classList.contains('message-image')) {
    e.preventDefault();
    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox';
    const img = document.createElement('img');
    img.src = e.target.src;
    overlay.appendChild(img);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
    return;
  }

  if (e.target.classList.contains('message-link')) {
    e.preventDefault();
    require('electron').shell.openExternal(e.target.href);
    return;
  }

  if (e.target.classList.contains('spoiler')) {
  e.target.classList.toggle('revealed');
  return;
  }

  if (e.target.closest('a[data-mention]')) {
    e.preventDefault();
    const userId = e.target.closest('a[data-mention]').dataset.mention;
    if (!userId || !state.roomId) return;
    const member = state.client.getRoom(state.roomId)?.getMember(userId);
    if (member) showUserProfile(member, e.target);
  }
});


module.exports = { loadMessages, loadFullHistory, handleIncoming, buildMessageEl };
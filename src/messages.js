const state = require('./state');
const { mxcToUrl, escapeHtml, linkify, makeAvatar, scrollToBottom } = require('./utils');
const { showUserProfile } = require('./profile');

const container = document.getElementById('messages-container');

// ---- rendering ----

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

  const el = document.createElement('div');
  el.className = grouped ? 'message message-grouped' : 'message';
  el.dataset.senderId = sender;
  el.dataset.timestamp = ts.getTime();

  let body = '';
  if (content.msgtype === 'm.image') {
    const url = mxcToUrl(content.url);
    body = url
      ? `<div class="message-image-container"><img src="${url}" alt="${escapeHtml(content.body || 'Image')}" class="message-image" loading="lazy"></div>`
      : `<div class="message-content">[Image]</div>`;
  } else {
    body = `<div class="message-content">${linkify(content.body || '')}</div>`;
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

// ---- loading ----

function loadMessages(roomId) {
  const room = state.client.getRoom(roomId);
  const timeline = room.timeline;
  container.innerHTML = '';

  if (!timeline.length) {
    container.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
    state.canLoadMore = false;
    return;
  }

  timeline.slice(-50).forEach((ev, i, arr) => {
    if (ev.getType() === 'm.room.message')
      container.appendChild(buildMessageEl(ev, i > 0 ? arr[i - 1] : null));
  });

  state.canLoadMore = timeline.length >= 50;
  scrollToBottom();
  setupInfiniteScroll(roomId);
}

async function loadFullHistory(roomId) {
  const room = state.client.getRoom(roomId);
  let loads = 0;

  while (loads < 10) {
    if (state.roomId !== roomId) return;
    try {
      const result = await state.client.scrollback(room, 50);
      if (!result || result === 0) break;
      loads++;
      if (state.roomId !== roomId) return;
      rebuildMessages(room.timeline);
      scrollToBottom();
    } catch {
      break;
    }
  }

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
    if (container.scrollTop < 100 && !state.loadingHistory && state.canLoadMore)
      loadOlderMessages(roomId);
  };
  container.addEventListener('scroll', container._scrollHandler);
}

async function loadOlderMessages(roomId) {
  if (state.loadingHistory || !state.canLoadMore) return;
  state.loadingHistory = true;

  const room = state.client.getRoom(roomId);
  const prevHeight = container.scrollHeight;

  const spinner = document.createElement('div');
  spinner.className = 'loading-history';
  spinner.textContent = 'Loading older messages...';
  container.prepend(spinner);

  try {
    await state.client.scrollback(room, 20);
    spinner.remove();

    const timeline = room.timeline;
    const oldestId = container.querySelector('.message')?.dataset?.eventId;
    let startIdx = oldestId ? timeline.findIndex(e => e.getId() === oldestId) : 0;
    if (startIdx === -1) startIdx = 0;

    const older = timeline.slice(Math.max(0, startIdx - 20), startIdx).reverse();
    older.forEach((ev, i, arr) => {
      if (ev.getType() !== 'm.room.message') return;
      const el = buildMessageEl(ev, i > 0 ? arr[i - 1] : null);
      el.dataset.eventId = ev.getId();
      container.prepend(el);
    });

    container.scrollTop = container.scrollHeight - prevHeight;
    state.canLoadMore = startIdx > 20;
  } catch {
    spinner.remove();
  }

  state.loadingHistory = false;
}

// ---- incoming events ----

function handleIncoming(event, room, toStart) {
  if (toStart || room.roomId !== state.roomId) return;
  if (event.getType() !== 'm.room.message') return;

  if (event.getSender() === state.client.getUserId()) {
    container.querySelectorAll('[data-temp-id]').forEach(el => el.remove());
  }

  container.appendChild(buildMessageEl(event));
  scrollToBottom();
}

// ---- click delegation for avatars/senders and image lightbox ----

document.addEventListener('click', e => {
  // open profile from message
  if (e.target.closest('.message-avatar') || e.target.classList.contains('message-sender')) {
    const msg = e.target.closest('.message');
    if (!msg) return;
    const member = state.client.getRoom(state.roomId)?.getMember(msg.dataset.senderId);
    if (member) showUserProfile(member, e.target.closest('.message-avatar') || e.target);
    return;
  }

  // lightbox
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

  // external links
  if (e.target.classList.contains('message-link')) {
    e.preventDefault();
    require('electron').shell.openExternal(e.target.href);
  }
});

module.exports = { loadMessages, loadFullHistory, handleIncoming, buildMessageEl };

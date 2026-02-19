const state = require('./src/state');
const { mxcToUrl, scrollToBottom } = require('./src/utils');
const { login, getSavedSession, normalizeHomeserver, showStatus } = require('./src/auth');
const { startClient } = require('./src/client');
const { buildMessageEl } = require('./src/messages');

// ---- boot ----

window.addEventListener('DOMContentLoaded', () => {
  const session = getSavedSession();
  if (session) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('loading-screen').classList.add('active');
    startClient(session).catch(() => {
      require('./src/auth').clearSession();
      document.getElementById('loading-screen').classList.remove('active');
      document.getElementById('login-screen').classList.add('active');
    });
  } else {
    document.getElementById('login-screen').classList.add('active');
  }
});

// ---- login form ----

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();

  const homeserver = normalizeHomeserver(document.getElementById('homeserver').value);
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn = e.target.querySelector('button[type="submit"]');

  showStatus('Connecting...', 'success');
  btn.disabled = true;

  try {
    const creds = await login(homeserver, username, password);
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('loading-screen').classList.add('active');
    await startClient(creds);
  } catch (err) {
    showStatus(`Login failed: ${err.message}`, 'error');
    btn.disabled = false;
  }
});

// ---- message form ----

const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');

messageForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !state.roomId) return;

  messageInput.value = '';

  const tempId = `temp-${Date.now()}`;
  const fakeEvent = {
    getSender: () => state.client.getUserId(),
    getContent: () => ({ msgtype: 'm.text', body: text }),
    getDate: () => new Date(),
    getType: () => 'm.room.message',
    getId: () => tempId,
  };

  const tempEl = buildMessageEl(fakeEvent);
  tempEl.dataset.tempId = tempId;
  tempEl.style.opacity = '0.6';
  messagesContainer.appendChild(tempEl);
  scrollToBottom();

  try {
    await state.client.sendMessage(state.roomId, { msgtype: 'm.text', body: text });
    messagesContainer.querySelector(`[data-temp-id="${tempId}"]`)?.remove();
  } catch {
    const el = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
    if (!el) return;
    el.style.opacity = '1';
    el.style.background = 'rgba(237,66,69,0.1)';
    const retry = document.createElement('button');
    retry.textContent = 'Retry';
    retry.className = 'retry-btn';
    retry.onclick = () => {
      el.remove();
      messageInput.value = text;
      messageForm.dispatchEvent(new Event('submit'));
    };
    el.appendChild(retry);
  }
});

// ---- image upload ----

const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || !state.roomId) return;

  if (!file.type.startsWith('image/')) { alert('Images only please'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('Max image size is 10MB'); return; }

  const status = document.createElement('div');
  status.className = 'upload-status';
  status.textContent = `Uploading ${file.name}...`;
  messagesContainer.appendChild(status);
  scrollToBottom();

  try {
    const res = await state.client.uploadContent(file, {
      name: file.name,
      type: file.type,
      onlyContentUri: false,
    });
    await state.client.sendMessage(state.roomId, {
      msgtype: 'm.image',
      body: file.name,
      url: res.content_uri,
      info: { mimetype: file.type, size: file.size },
    });
  } catch (err) {
    alert('Upload failed: ' + err.message);
  } finally {
    status.remove();
    fileInput.value = '';
  }
});

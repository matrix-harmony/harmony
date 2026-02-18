const sdk = require('matrix-js-sdk');
let matrixClient = null;
let currentRoomId = null;
let currentSpaceId = null;
let currentHomeView = 'dms';
let currentProfileMember = null;
let isLoadingHistory = false;
let canLoadMore = true;
let allMembers = [];
let renderedMemberRange = { start: 0, end: 40 };

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loadingScreen = document.getElementById('loading-screen');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const roomsList = document.getElementById('rooms-list');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const currentRoomName = document.getElementById('current-room-name');
const messageInputContainer = document.getElementById('message-input-container');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const membersList = document.getElementById('members-list');
const membersSidebar = document.getElementById('members-sidebar');
const memberCount = document.getElementById('member-count');
const toggleMembersBtn = document.getElementById('toggle-members');
const MEMBER_HEIGHT = 42;
const RENDER_BUFFER = 10;

function mxcToUrl(mxcUrl) {
  if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return null;
  try {
    const [, serverAndMedia] = mxcUrl.split('mxc://');
    const [server, mediaId] = serverAndMedia.split('/');
    const homeserver = matrixClient.getHomeserverUrl();
    const accessToken = matrixClient.getAccessToken();
    return `${homeserver}/_matrix/client/v1/media/download/${server}/${mediaId}?access_token=${accessToken}`;
  } catch (e) {
    return null;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('matrix_access_token');
  const savedUserId = localStorage.getItem('matrix_user_id');
  const savedHomeserver = localStorage.getItem('matrix_homeserver');

  if (savedToken && savedUserId && savedHomeserver) {
    console.log('Found saved session, auto-logging in...');
    loginScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    autoLogin(savedHomeserver, savedToken, savedUserId);
  } else {
    console.log('No saved session found');
    loginScreen.classList.add('active');
  }
});

async function autoLogin(homeserver, accessToken, userId) {
  try {
    matrixClient = sdk.createClient({
      baseUrl: homeserver,
      accessToken: accessToken,
      userId: userId
    });
    await startMatrixClient();
    console.log('Auto-login successful!');
  } catch (error) {
    console.error('Auto-login failed:', error);
    clearSession();
    loadingScreen.classList.remove('active');
    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
}

function saveSession(homeserver, accessToken, userId) {
  localStorage.setItem('matrix_access_token', accessToken);
  localStorage.setItem('matrix_user_id', userId);
  localStorage.setItem('matrix_homeserver', homeserver);
}

function clearSession() {
  localStorage.removeItem('matrix_access_token');
  localStorage.removeItem('matrix_user_id');
  localStorage.removeItem('matrix_homeserver');
}

function normalizeHomeserver(input) {
  input = input.trim();
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  if (!input.startsWith('matrix.')) {
    input = 'matrix.' + input;
  }
  return 'https://' + input;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  
  const homeserverInput = document.getElementById('homeserver').value.trim();
  const homeserver = normalizeHomeserver(homeserverInput);
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  showStatus('connecting', 'success');
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    matrixClient = sdk.createClient({ baseUrl: homeserver });

    const response = await matrixClient.login('m.login.password', {
      user: username,
      password: password
    });

    saveSession(homeserver, response.access_token, response.user_id);

    matrixClient = sdk.createClient({
      baseUrl: homeserver,
      accessToken: response.access_token,
      userId: response.user_id
    });

    await startMatrixClient();
    loginScreen.classList.remove('active');
    loadingScreen.classList.add('active');

  } catch (error) {
    console.error('Login error:', error);
    showStatus(`Login failed: ${error.message}`, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});

function showStatus(message, type) {
  loginStatus.textContent = message;
  loginStatus.className = `status-message ${type}`;
  loginStatus.style.display = 'block';
}

async function startMatrixClient() {
  console.log('Starting Harmony...');

  const userId = matrixClient.getUserId();
  const userName = userId.split(':')[0].substring(1);

  const userNameElement = document.getElementById('user-name');
  const userTagElement = document.getElementById('user-tag');
  const userAvatarElement = document.getElementById('user-avatar');
  const userSettingsBtn = document.getElementById('user-settings-btn');

  if (userNameElement) userNameElement.textContent = userName;
  if (userTagElement) userTagElement.textContent = userId;
  if (userAvatarElement) userAvatarElement.textContent = userName.charAt(0).toUpperCase();

  roomsList.innerHTML = '<p class="loading">Syncing with server...</p>';
  messagesContainer.innerHTML = '<div class="empty-state"><p>Loading messages...</p></div>';

  matrixClient.once('sync', async (state) => {
    if (state === 'PREPARED') {
      const ownUser = matrixClient.getUser(userId);
      if (ownUser?.avatarUrl) {
        const avatarUrl = mxcToUrl(ownUser.avatarUrl);
        if (avatarUrl && userAvatarElement) {
          userAvatarElement.innerHTML = `
            <img src="${avatarUrl}" 
                 style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
                 onerror="this.parentElement.textContent='${userName.charAt(0).toUpperCase()}'">
          `;
          userAvatarElement.style.padding = '0';
        }
      }
      console.log('Sync Complete! Loading...');
      loadSpaces();
      showHomeNav(true);
      loadHomeView();
      messagesContainer.innerHTML = '<div class="empty-state"><p>Select a room to start messaging</p></div>';
      chatScreen.classList.add('active');
      requestAnimationFrame(() => {
        loadingScreen.classList.add('fade-out');
      });
      setTimeout(() => {
        loadingScreen.classList.remove('active', 'fade-out');
      }, 500);
    }
  });

  if (userSettingsBtn) {
    userSettingsBtn.addEventListener('click', async () => {
      if (confirm('Logout?')) {
        await performLogout();
      }
    });
  }

  matrixClient.on('Room.timeline', handleNewMessage);
  matrixClient.on('Room', handleNewRoom);

  await matrixClient.startClient({ initialSyncLimit: 5 });
}

async function performLogout() {
  try {
    if (matrixClient) {
      matrixClient.stopClient();
      await matrixClient.logout();
    }

    matrixClient = null;
    currentRoomId = null;
    currentSpaceId = null;
    clearSession();

    roomsList.innerHTML = '';
    messagesContainer.innerHTML = '';
    membersList.innerHTML = '';

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    loginStatus.style.display = 'none';

    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');

    requestAnimationFrame(() => {
      if (usernameInput) {
        usernameInput.focus();
        usernameInput.select();
      }
    });

    console.log('Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    matrixClient = null;
    clearSession();
    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');

    requestAnimationFrame(() => {
      const usernameInput = document.getElementById('username');
      if (usernameInput) {
        usernameInput.focus();
        usernameInput.select();
      }
    });
  }
}

function showHomeNav(visible) {
  const homeNav = document.getElementById('home-nav');
  if (homeNav) homeNav.classList.toggle('visible', visible);
}

document.getElementById('nav-dms')?.addEventListener('click', () => {
  currentHomeView = 'dms';
  document.querySelectorAll('.home-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-dms').classList.add('active');
  loadHomeView();
});

document.getElementById('nav-rooms')?.addEventListener('click', () => {
  currentHomeView = 'rooms';
  document.querySelectorAll('.home-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-rooms').classList.add('active');
  loadHomeView();
});

document.getElementById('home-server')?.addEventListener('click', () => {
  currentSpaceId = null;
  document.querySelectorAll('.server-icon').forEach(i => i.classList.remove('active'));
  document.getElementById('home-server')?.classList.add('active');
  const sidebarHeader = document.querySelector('.sidebar-header h2');
  if (sidebarHeader) sidebarHeader.textContent = 'Home';
  showHomeNav(true);
  loadHomeView();
});

function loadHomeView() {
  if (!matrixClient) return;

  const rooms = matrixClient.getRooms();

  const allHomeRooms = rooms.filter(room => {
    if (room.isSpaceRoom()) return false;
    const parentEvents = room.currentState.getStateEvents('m.space.parent');
    return !parentEvents || parentEvents.length === 0;
  });

  const dmEvent = matrixClient.getAccountData('m.direct');
  const dmData = dmEvent?.getContent() || {};
  const allDmRoomIds = Object.values(dmData).flat();

  roomsList.innerHTML = '';

  if (currentHomeView === 'dms') {
    const dmRooms = allHomeRooms.filter(room => allDmRoomIds.includes(room.roomId));

    if (dmRooms.length === 0) {
      roomsList.innerHTML = '<p class="loading">No direct messages</p>';
      return;
    }

    dmRooms.sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());
    dmRooms.forEach(room => roomsList.appendChild(createRoomElement(room, true)));

  } else {
    const nonDmRooms = allHomeRooms.filter(room => !allDmRoomIds.includes(room.roomId));

    const globalRooms = nonDmRooms.filter(room => {
      const joinRule = room.currentState.getStateEvents('m.room.join_rules', '')?.getContent()?.join_rule;
      return joinRule === 'public';
    });

    const regularRooms = nonDmRooms.filter(room => {
      const joinRule = room.currentState.getStateEvents('m.room.join_rules', '')?.getContent()?.join_rule;
      return joinRule !== 'public';
    });

    if (nonDmRooms.length === 0) {
      roomsList.innerHTML = '<p class="loading">No rooms</p>';
      return;
    }

    if (regularRooms.length > 0) {
      const header = document.createElement('div');
      header.className = 'room-category';
      header.textContent = 'Rooms';
      roomsList.appendChild(header);
      regularRooms.sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());
      regularRooms.forEach(room => roomsList.appendChild(createRoomElement(room)));
    }

    if (globalRooms.length > 0) {
      const header = document.createElement('div');
      header.className = 'room-category';
      header.textContent = 'Global Rooms';
      roomsList.appendChild(header);
      globalRooms.sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());
      globalRooms.forEach(room => roomsList.appendChild(createRoomElement(room)));
    }
  }
}

function loadSpaces() {
  const spacesList = document.getElementById('spaces-list');
  if (!spacesList) return;

  spacesList.innerHTML = '';

  const rooms = matrixClient.getRooms();
  const allSpaces = rooms.filter(room => room.isSpaceRoom());

  if (allSpaces.length === 0) return;

  const topLevelSpaces = allSpaces.filter(space => {
    const parentEvents = space.currentState.getStateEvents('m.space.parent') || [];
    return parentEvents.length === 0;
  });

  topLevelSpaces.forEach(space => spacesList.appendChild(createSpaceIcon(space)));
}

function createSpaceIcon(space) {
  const icon = document.createElement('div');
  icon.className = 'server-icon';
  icon.title = space.name || 'Unnamed Space';
  icon.dataset.spaceId = space.roomId;

  const avatarMxc = space.getMxcAvatarUrl ? space.getMxcAvatarUrl() : null;
  const avatarUrl = mxcToUrl(avatarMxc);

  if (avatarUrl) {
    icon.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(space.name || '?')}"
                          onerror="this.parentElement.textContent='${(space.name || '?').charAt(0).toUpperCase()}'">`;
  } else {
    icon.textContent = (space.name || '?').charAt(0).toUpperCase();
  }

  icon.addEventListener('click', () => switchSpace(space.roomId));
  return icon;
}

function switchSpace(spaceId) {
  currentSpaceId = spaceId;
  showHomeNav(false);

  document.querySelectorAll('.server-icon').forEach(i => i.classList.remove('active'));
  document.querySelector(`[data-space-id="${spaceId}"]`)?.classList.add('active');
  document.getElementById('home-server')?.classList.remove('active');

  const space = matrixClient.getRoom(spaceId);
  const sidebarHeader = document.querySelector('.sidebar-header h2');
  if (sidebarHeader) sidebarHeader.textContent = space?.name || 'Space';

  loadRoomsForSpace(spaceId);
}

function loadRoomsForSpace(spaceId) {
  const allRooms = matrixClient.getRooms();
  const spaceRoom = matrixClient.getRoom(spaceId);

  const childEvents = spaceRoom?.currentState.getStateEvents('m.space.child') || [];
  const spaceChildIds = new Set(childEvents.map(e => e.getStateKey()).filter(Boolean));

  const subSpaces = [];
  const directRooms = [];

  allRooms.forEach(room => {
    const roomId = room.roomId;
    const localId = roomId.split(':')[0];

    const isChild = spaceChildIds.has(roomId) || spaceChildIds.has(localId);

    if (!isChild) {
      const parentEvents = room.currentState.getStateEvents('m.space.parent') || [];
      if (!parentEvents.some(e => e.getStateKey() === spaceId)) return;
    }

    if (room.isSpaceRoom()) {
      subSpaces.push(room);
    } else {
      directRooms.push(room);
    }
  });

  roomsList.innerHTML = '';

  if (subSpaces.length === 0 && directRooms.length === 0) {
    roomsList.innerHTML = '<p class="loading">No rooms</p>';
    return;
  }

  subSpaces.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  subSpaces.forEach(subSpace => {
    renderSpaceCategory(subSpace, spaceId);
  });

  if (directRooms.length > 0) {
    directRooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    directRooms.forEach(room => roomsList.appendChild(createRoomElement(room)));
  }
}

function renderSpaceCategory(subSpace, parentSpaceId) {
  const categoryDiv = document.createElement('div');
  categoryDiv.className = 'space-category';
  categoryDiv.dataset.spaceId = subSpace.roomId;

  const isExpanded = localStorage.getItem(`space-${subSpace.roomId}-expanded`) !== 'false';

  categoryDiv.innerHTML = `
    <div class="space-category-header">
      <svg class="space-category-arrow ${isExpanded ? 'expanded' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.29 15.88L13.17 12 9.29 8.12c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0l4.59 4.59c.39.39.39 1.02 0 1.41L10.7 17.3c-.39.39-1.02.39-1.41 0-.38-.39-.39-1.03 0-1.42z"/>
      </svg>
      <span class="space-category-name">${escapeHtml(subSpace.name || 'Unnamed Space')}</span>
    </div>
    <div class="space-category-rooms ${isExpanded ? 'expanded' : ''}"></div>
  `;

  roomsList.appendChild(categoryDiv);

  const header = categoryDiv.querySelector('.space-category-header');
  const arrow = categoryDiv.querySelector('.space-category-arrow');
  const roomsContainer = categoryDiv.querySelector('.space-category-rooms');

  header.addEventListener('click', () => {
    const isNowExpanded = !arrow.classList.contains('expanded');
    arrow.classList.toggle('expanded');
    roomsContainer.classList.toggle('expanded');
    localStorage.setItem(`space-${subSpace.roomId}-expanded`, isNowExpanded);
  });

  const allRooms = matrixClient.getRooms();
  const subSpaceChildEvents = subSpace.currentState.getStateEvents('m.space.child') || [];
  const subSpaceChildIds = new Set(subSpaceChildEvents.map(e => e.getStateKey()).filter(Boolean));

  const categoryRooms = allRooms.filter(room => {
    if (room.isSpaceRoom()) return false;

    const roomId = room.roomId;
    const localId = roomId.split(':')[0];

    if (subSpaceChildIds.has(roomId) || subSpaceChildIds.has(localId)) return true;

    const parentEvents = room.currentState.getStateEvents('m.space.parent') || [];
    return parentEvents.some(e => e.getStateKey() === subSpace.roomId);
  });

  categoryRooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  categoryRooms.forEach(room => {
    roomsContainer.appendChild(createRoomElement(room));
  });
}

function createRoomElement(room, isDm = false) {
  const roomDiv = document.createElement('div');
  roomDiv.className = 'room-item';
  roomDiv.dataset.roomId = room.roomId;

  if (isDm) {
    const members = room.getJoinedMembers();
    const otherMember = members.find(m => m.userId !== matrixClient.getUserId()) || members[0];
    const displayName = otherMember?.name || room.name || '?';
    const avatarLetter = displayName.charAt(0).toUpperCase();
    const avatarMxc = otherMember?.getMxcAvatarUrl()
      || matrixClient.getUser(otherMember?.userId)?.avatarUrl;
    const avatarUrl = mxcToUrl(avatarMxc);

    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
              onerror="this.style.display='none';this.nextSibling.style.display='flex';">
         <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-weight:600;">${avatarLetter}</div>`
      : avatarLetter;

    roomDiv.innerHTML = `
      <div class="dm-avatar">${avatarHtml}</div>
      <div class="room-name">${escapeHtml(room.name || displayName)}</div>
    `;
  } else {
    roomDiv.innerHTML = `<div class="room-name">${escapeHtml(room.name || 'Unnamed Room')}</div>`;
  }

  roomDiv.addEventListener('click', () => openRoom(room.roomId));
  return roomDiv;
}

function handleNewRoom(room) {
  console.log('New Room Joined:', room.roomId);
  if (!currentSpaceId) loadHomeView();
  loadSpaces();
}

function openRoom(roomId) {
  currentRoomId = roomId;
  const room = matrixClient.getRoom(roomId);
  const roomName = room.name || 'Unnamed Room';

  const isEncrypted = matrixClient.isRoomEncrypted(roomId);

  currentRoomName.innerHTML = `
    <span class="encryption-indicator ${isEncrypted ? 'encrypted' : 'unencrypted'}"></span>
    ${escapeHtml(roomName)}
  `;

  messageInputContainer.style.display = 'flex';
  messageInput.placeholder = `Message #${roomName}`;

  document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`[data-room-id="${roomId}"]`)?.classList.add('active');

  loadMessages(roomId);
  loadMembers(roomId);
  loadFullRoomHistory(roomId);
}

function loadMessages(roomId) {
  const room = matrixClient.getRoom(roomId);
  const timeline = room.timeline;

  messagesContainer.innerHTML = '';

  if (timeline.length === 0) {
    messagesContainer.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
    canLoadMore = false;
    return;
  }

  const messagesToShow = timeline.slice(-50);
  messagesToShow.forEach((event, index) => {
    if (event.getType() === 'm.room.message') {
      const prevEvent = index > 0 ? messagesToShow[index - 1] : null;
      messagesContainer.appendChild(createMessageElement(event, prevEvent));
    }
  });

  canLoadMore = timeline.length >= 50;
  scrollToBottom();

  setupInfiniteScroll(roomId);
}

async function loadFullRoomHistory(roomId) {
  const room = matrixClient.getRoom(roomId);

  let loadCount = 0;
  const maxLoads = 10;

  while (loadCount < maxLoads) {
    if (currentRoomId !== roomId) return;

    try {
      const result = await matrixClient.scrollback(room, 50);

      if (!result || result === 0) break;

      loadCount++;

      if (currentRoomId !== roomId) return;

      const timeline = room.timeline;
      messagesContainer.innerHTML = '';

      timeline.forEach((event, index) => {
        if (event.getType() === 'm.room.message') {
          const prevEvent = index > 0 ? timeline[index - 1] : null;
          const messageEl = createMessageElement(event, prevEvent);
          messageEl.dataset.eventId = event.getId();
          messagesContainer.appendChild(messageEl);
        }
      });

      scrollToBottom();

    } catch (error) {
      console.error('Failed to load room history:', error);
      break;
    }
  }

  canLoadMore = loadCount < maxLoads;
  setupInfiniteScroll(roomId);
}

function setupInfiniteScroll(roomId) {
  messagesContainer.removeEventListener('scroll', handleScroll);

  function handleScroll() {
    if (messagesContainer.scrollTop < 100 && !isLoadingHistory && canLoadMore) {
      loadOlderMessages(roomId);
    }
  }

  messagesContainer.addEventListener('scroll', handleScroll);
}

async function loadOlderMessages(roomId) {
  if (isLoadingHistory || !canLoadMore) return;

  isLoadingHistory = true;
  const room = matrixClient.getRoom(roomId);

  const oldScrollHeight = messagesContainer.scrollHeight;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-history';
  loadingDiv.textContent = 'Loading older messages...';
  messagesContainer.insertBefore(loadingDiv, messagesContainer.firstChild);

  try {
    await matrixClient.scrollback(room, 20);

    loadingDiv.remove();

    const timeline = room.timeline;
    const oldestDisplayed = messagesContainer.querySelector('.message')?.dataset?.eventId;

    let startIndex = 0;
    if (oldestDisplayed) {
      startIndex = timeline.findIndex(e => e.getId() === oldestDisplayed);
      if (startIndex === -1) startIndex = 0;
    }

    const olderEvents = timeline.slice(Math.max(0, startIndex - 20), startIndex);
    olderEvents.reverse().forEach((event, index) => {
      if (event.getType() === 'm.room.message') {
        const prevEvent = index > 0 ? olderEvents[index - 1] : null;
        const messageEl = createMessageElement(event, prevEvent);
        messageEl.dataset.eventId = event.getId();
        messagesContainer.insertBefore(messageEl, messagesContainer.firstChild);
      }
    });

    const newScrollHeight = messagesContainer.scrollHeight;
    messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;
    canLoadMore = startIndex > 20;

  } catch (error) {
    console.error('Failed to load older messages:', error);
    loadingDiv.remove();
  }

  isLoadingHistory = false;
}

function createMessageElement(event, prevEvent = null) {
  const messageDiv = document.createElement('div');

  const sender = event.getSender();
  const content = event.getContent();
  const timestamp = new Date(event.getDate());

  messageDiv.dataset.senderId = sender;

  const timeString = timestamp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const senderName = getSenderDisplayName(sender);
  const avatarLetter = senderName.charAt(0).toUpperCase();

  const shouldGroup = prevEvent &&
    prevEvent.getSender() === sender &&
    prevEvent.getType() === 'm.room.message' &&
    (timestamp - new Date(prevEvent.getDate())) < 5 * 60 * 1000;

  if (shouldGroup) {
    messageDiv.className = 'message message-grouped';
  } else {
    messageDiv.className = 'message';

    const room = matrixClient.getRoom(currentRoomId);
    const senderMember = room?.getMember(sender);
    const senderAvatarMxc = senderMember?.getMxcAvatarUrl();
    const senderAvatarUrl = mxcToUrl(senderAvatarMxc);

    const avatarHtml = senderAvatarUrl
      ? `<img src="${senderAvatarUrl}" alt="${avatarLetter}"
              style="width:100%;height:100%;object-fit:cover;border-radius:50%;cursor:pointer;"
              onerror="this.style.display='none'; this.nextSibling.style.display='flex';">
         <div class="avatar-fallback" style="display:none;cursor:pointer;">${avatarLetter}</div>`
      : `<div class="avatar-fallback" style="cursor:pointer;">${avatarLetter}</div>`;

    messageDiv.innerHTML = `<div class="message-avatar">${avatarHtml}</div>`;
  }

  let messageContent = '';
  if (content.msgtype === 'm.image') {
    try {
      const imageUrl = mxcToUrl(content.url);
      messageContent = `
        <div class="message-image-container">
          <img src="${imageUrl}" 
               alt="${escapeHtml(content.body || 'Image')}" 
               class="message-image"
               loading="lazy" />
        </div>
      `;
    } catch (error) {
      messageContent = `<div class="message-content">[Image]</div>`;
    }
  } else {
    messageContent = `<div class="message-content">${escapeHtml(content.body || '')}</div>`;
  }

  if (shouldGroup) {
    messageDiv.innerHTML += `
      <div class="message-grouped-content">
        <span class="message-time-hover">${timeString}</span>
        ${messageContent}
      </div>
    `;
  } else {
    messageDiv.innerHTML += `
      <div class="message-header">
        <span class="message-sender" style="cursor:pointer;">${escapeHtml(senderName)}</span>
        <span class="message-time">${timeString}</span>
      </div>
      ${messageContent}
    `;
  }

  return messageDiv;
}

function getSenderDisplayName(userId) {
  if (!currentRoomId) return userId;
  const room = matrixClient.getRoom(currentRoomId);
  const member = room?.getMember(userId);
  return member?.name || userId.split(':')[0].substring(1);
}

function handleNewMessage(event, room, toStartOfTimeline) {
  if (toStartOfTimeline) return;
  if (room.roomId !== currentRoomId) return;
  if (event.getType() !== 'm.room.message') return;
  messagesContainer.appendChild(createMessageElement(event));
  scrollToBottom();
}

function getAverageColor(imgUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let r = 0, g = 0, b = 0;

      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }

      const pixelCount = data.length / 4;
      r = Math.floor(r / pixelCount);
      g = Math.floor(g / pixelCount);
      b = Math.floor(b / pixelCount);

      resolve(`rgb(${r}, ${g}, ${b})`);
    };
    img.onerror = () => resolve('#5865f2');
    img.src = imgUrl;
  });
}

function showUserProfile(member, targetElement) {
  currentProfileMember = member;

  const popup = document.getElementById('user-profile-popup');
  const popupContent = popup.querySelector('.profile-popup-content');
  const banner = document.getElementById('profile-banner');
  const avatar = document.getElementById('profile-avatar');
  const displayName = document.getElementById('profile-display-name');
  const username = document.getElementById('profile-username');

  const memberDisplayName = member.name || member.userId.split(':')[0].substring(1);
  const memberUserId = member.userId;
  const avatarLetter = memberDisplayName.charAt(0).toUpperCase();

  displayName.textContent = memberDisplayName;
  username.textContent = memberUserId;

  const memberAvatarMxc = member.getMxcAvatarUrl();
  const memberAvatarUrl = mxcToUrl(memberAvatarMxc);

  if (memberAvatarUrl) {
    avatar.innerHTML = `<img src="${memberAvatarUrl}" alt="${avatarLetter}" style="width:100%;height:100%;object-fit:cover;">`;

    getAverageColor(memberAvatarUrl).then(color => {
      banner.style.background = color;
    }).catch(() => {
      banner.style.background = '#5865f2';
    });
  } else {
    avatar.textContent = avatarLetter;
    banner.style.background = '#5865f2';
  }

  document.querySelectorAll('.member-item').forEach(m => m.classList.remove('profile-open'));
  if (targetElement.classList && targetElement.classList.contains('member-item')) {
    targetElement.classList.add('profile-open');
  }

  popup.classList.add('active');

  positionProfilePopup(popupContent, targetElement);
}

function positionProfilePopup(popupContent, targetElement) {
  const targetRect = targetElement.getBoundingClientRect();
  const popupRect = popupContent.getBoundingClientRect();

  let left = targetRect.right + 8;
  let top = targetRect.top;

  if (left + popupRect.width > window.innerWidth - 12) {
    left = targetRect.left - popupRect.width - 8;
  }

  if (top + popupRect.height > window.innerHeight - 16) {
    top = window.innerHeight - popupRect.height - 16;
  }

  if (top < 16) {
    top = 16;
  }

  popupContent.style.left = `${left}px`;
  popupContent.style.top = `${top}px`;
}

window.addEventListener('resize', () => {
  const popup = document.getElementById('user-profile-popup');
  if (popup.classList.contains('active')) {
    const highlightedMember = document.querySelector('.member-item.profile-open');
    if (highlightedMember) {
      const popupContent = popup.querySelector('.profile-popup-content');
      positionProfilePopup(popupContent, highlightedMember);
    }
  }
});

const profilePopup = document.getElementById('user-profile-popup');
const profileClose = document.getElementById('profile-close');

profileClose?.addEventListener('click', () => {
  profilePopup.classList.remove('active');
  document.querySelectorAll('.member-item').forEach(m => m.classList.remove('profile-open'));
  currentProfileMember = null;
});

document.addEventListener('click', (e) => {
  if (profilePopup.classList.contains('active')) {
    const popupContent = profilePopup.querySelector('.profile-popup-content');

    if (!popupContent.contains(e.target) &&
        !e.target.closest('.member-item') &&
        !e.target.closest('.message-avatar') &&
        !e.target.classList.contains('message-sender')) {
      profilePopup.classList.remove('active');
      document.querySelectorAll('.member-item').forEach(m => m.classList.remove('profile-open'));
      currentProfileMember = null;
    }
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('.message-avatar') || e.target.classList.contains('message-sender')) {
    const messageDiv = e.target.closest('.message');
    if (!messageDiv) return;

    const senderId = messageDiv.dataset.senderId;
    if (!senderId) return;

    const room = matrixClient.getRoom(currentRoomId);
    const member = room?.getMember(senderId);
    if (member) {
      const targetElement = e.target.closest('.message-avatar') || e.target;
      showUserProfile(member, targetElement);
    }
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('message-image')) {
    e.preventDefault();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.9); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; cursor: pointer;
    `;
    const img = document.createElement('img');
    img.src = e.target.src;
    img.style.cssText = 'max-width: 90%; max-height: 90%; object-fit: contain;';
    overlay.appendChild(img);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }
});

const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentRoomId) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Image too large. Max size is 10MB');
    return;
  }

  try {
    const statusMsg = document.createElement('div');
    statusMsg.className = 'upload-status';
    statusMsg.textContent = `Uploading ${file.name}...`;
    messagesContainer.appendChild(statusMsg);
    scrollToBottom();

    const uploadResponse = await matrixClient.uploadContent(file, {
      name: file.name,
      type: file.type,
      onlyContentUri: false
    });

    const mxcUrl = uploadResponse.content_uri;

    await matrixClient.sendMessage(currentRoomId, {
      msgtype: 'm.image',
      body: file.name,
      url: mxcUrl,
      info: { mimetype: file.type, size: file.size }
    });

    statusMsg.remove();
    fileInput.value = '';

  } catch (error) {
    console.error('Failed to send image:', error);
    alert('Failed to send image: ' + error.message);
    fileInput.value = '';
  }
});

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageText = messageInput.value.trim();
  if (!messageText || !currentRoomId) return;

  try {
    await matrixClient.sendMessage(currentRoomId, {
      msgtype: 'm.text',
      body: messageText
    });
    messageInput.value = '';
    messageInput.focus();
  } catch (error) {
    console.error('Failed to send message:', error);
    alert('Failed to send message: ' + error.message);
  }
});

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

toggleMembersBtn.addEventListener('click', () => {
  const isVisible = membersSidebar.style.display !== 'none';
  membersSidebar.style.display = isVisible ? 'none' : 'flex';
  toggleMembersBtn.textContent = isVisible ? 'Show' : 'Hide';
});

function loadMembers(roomId) {
  const room = matrixClient.getRoom(roomId);
  if (!room) return;

  allMembers = room.getJoinedMembers();

  const membersHeader = document.querySelector('.members-header p');
  if (membersHeader) membersHeader.textContent = `${allMembers.length} Members`;

  membersSidebar.style.display = 'flex';
  membersList.innerHTML = '';
  membersList.style.position = '';
  membersList.style.height = '';

  allMembers.sort((a, b) => {
    return (a.name || a.userId).toLowerCase().localeCompare((b.name || b.userId).toLowerCase());
  });

  if (allMembers.length > 100) {
    const containerHeight = allMembers.length * MEMBER_HEIGHT;
    membersList.style.position = 'relative';
    membersList.style.height = `${containerHeight}px`;

    renderVisibleMembers(0, 40);

    membersList.removeEventListener('scroll', handleMemberScroll);
    membersList.addEventListener('scroll', handleMemberScroll);
  } else {
    allMembers.forEach(member => membersList.appendChild(createMemberElement(member)));
  }
}

function handleMemberScroll() {
  const scrollTop = membersList.scrollTop;
  const viewportHeight = membersList.clientHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / MEMBER_HEIGHT) - RENDER_BUFFER);
  const endIndex = Math.min(
    allMembers.length,
    Math.ceil((scrollTop + viewportHeight) / MEMBER_HEIGHT) + RENDER_BUFFER
  );

  if (startIndex !== renderedMemberRange.start || endIndex !== renderedMemberRange.end) {
    renderVisibleMembers(startIndex, endIndex);
  }
}

function renderVisibleMembers(startIndex, endIndex) {
  renderedMemberRange = { start: startIndex, end: endIndex };

  const existingMembers = membersList.querySelectorAll('.member-item');
  existingMembers.forEach(el => el.remove());

  for (let i = startIndex; i < endIndex; i++) {
    const member = allMembers[i];
    if (!member) continue;

    const memberEl = createMemberElement(member);
    memberEl.style.position = 'absolute';
    memberEl.style.top = `${i * MEMBER_HEIGHT}px`;
    memberEl.style.width = '100%';
    memberEl.style.height = `${MEMBER_HEIGHT}px`;

    membersList.appendChild(memberEl);
  }
}

function createMemberElement(member) {
  const memberDiv = document.createElement('div');
  memberDiv.className = 'member-item';

  const displayName = member.name || member.userId.split(':')[0].substring(1);
  const userId = member.userId;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  if (userId === matrixClient.getUserId()) {
    memberDiv.classList.add('online');
  }

  const memberAvatarMxc = member.getMxcAvatarUrl();
  const memberAvatarUrl = mxcToUrl(memberAvatarMxc);

  const avatarHtml = memberAvatarUrl
    ? `<img src="${memberAvatarUrl}" alt="${avatarLetter}"
            style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
            onerror="this.style.display='none'; this.nextSibling.style.display='flex';">
       <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;border-radius:50%;background:#5865f2;color:#fff;font-weight:600;">${avatarLetter}</div>`
    : avatarLetter;

  memberDiv.innerHTML = `
    <div class="member-avatar">${avatarHtml}</div>
    <div class="member-info">
      <div class="member-name" title="${escapeHtml(userId)}">${escapeHtml(displayName)}</div>
    </div>
  `;

  memberDiv.addEventListener('click', () => showUserProfile(member, memberDiv));

  return memberDiv;
}
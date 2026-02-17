const sdk = require('matrix-js-sdk');

let matrixClient = null;
let currentRoomId = null;

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
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
  console.log('Checking for saved session...');
  const savedToken = localStorage.getItem('matrix_access_token');
  const savedUserId = localStorage.getItem('matrix_user_id');
  const savedHomeserver = localStorage.getItem('matrix_homeserver');

  if (savedToken && savedUserId && savedHomeserver) {
    console.log('Found saved session, attempting auto-login...');
    autoLogin(savedHomeserver, savedToken, savedUserId);
  } else {
    console.log('No saved session found');
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

    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');

    console.log('Auto-login successful!');
  } catch (error) {
    console.error('Auto-login failed:', error);
    clearSession();
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

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const homeserver = document.getElementById('homeserver').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  showStatus('connecting', 'success');
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'connecting to didi.party';

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
    chatScreen.classList.add('active');

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
      console.log('Sync Complete! Loading Rooms...');
      loadRooms();
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

  await matrixClient.startClient({ initialSyncLimit: 10 });
}

async function performLogout() {
  try {
    await matrixClient.logout();
    matrixClient.stopClient();
    matrixClient = null;
    clearSession();
    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');
    document.getElementById('password').value = '';
    loginStatus.style.display = 'none';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed: ' + error.message);
  }
}

function loadRooms() {
  const rooms = matrixClient.getRooms();
  
  if (rooms.length === 0) {
    roomsList.innerHTML = '<p class="loading">no rooms found</p>';
    return;
  }

  rooms.sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());

  roomsList.innerHTML = '';
  rooms.forEach(room => {
    roomsList.appendChild(createRoomElement(room));
  });
}

function createRoomElement(room) {
  const roomDiv = document.createElement('div');
  roomDiv.className = 'room-item';
  roomDiv.dataset.roomId = room.roomId;

  const roomName = room.name || 'Unnamed Room';

  roomDiv.innerHTML = `<div class="room-name">${escapeHtml(roomName)}</div>`;
  roomDiv.addEventListener('click', () => openRoom(room.roomId));

  return roomDiv;
}

function handleNewRoom(room) {
  console.log('New Room Joined:', room.roomId);
  loadRooms(); 
}

function openRoom(roomId) {
  currentRoomId = roomId;
  const room = matrixClient.getRoom(roomId);
  const roomName = room.name || 'Unnamed Room';

  currentRoomName.textContent = roomName;
  messageInputContainer.style.display = 'flex';
  messageInput.placeholder = `Message #${roomName}`;

  document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`[data-room-id="${roomId}"]`)?.classList.add('active');

  loadMessages(roomId);
  loadMembers(roomId);
}

function loadMessages(roomId) {
  const room = matrixClient.getRoom(roomId);
  const timeline = room.timeline;

  messagesContainer.innerHTML = '';

  if (timeline.length === 0) {
    messagesContainer.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
    return;
  }

  timeline.slice(-50).forEach(event => {
    if (event.getType() === 'm.room.message') {
      messagesContainer.appendChild(createMessageElement(event));
    }
  });

  scrollToBottom();
}

function createMessageElement(event) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  const sender = event.getSender();
  const content = event.getContent();
  const timestamp = new Date(event.getDate());
  
  const timeString = timestamp.toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  const senderName = getSenderDisplayName(sender);
  const avatarLetter = senderName.charAt(0).toUpperCase();

  const room = matrixClient.getRoom(currentRoomId);
  const senderMember = room?.getMember(sender);
  const senderAvatarMxc = senderMember?.getMxcAvatarUrl();
  const senderAvatarUrl = mxcToUrl(senderAvatarMxc);

  const avatarHtml = senderAvatarUrl
    ? `<img src="${senderAvatarUrl}" alt="${avatarLetter}"
            style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
            onerror="this.style.display='none'; this.nextSibling.style.display='flex';">
       <div class="avatar-fallback" style="display:none;">${avatarLetter}</div>`
    : `<div class="avatar-fallback">${avatarLetter}</div>`;

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

  messageDiv.innerHTML = `
    <div class="message-avatar">${avatarHtml}</div>
    <div class="message-header">
      <span class="message-sender">${escapeHtml(senderName)}</span>
      <span class="message-time">${timeString}</span>
    </div>
    ${messageContent}
  `;

  return messageDiv;
}

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

logoutBtn.addEventListener('click', async () => {
  if (confirm('leaving so soon?')) {
    await performLogout();
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

  const members = room.getJoinedMembers();

  const membersHeader = document.querySelector('.members-header p');
  if (membersHeader) membersHeader.textContent = `${members.length} Members`;

  membersSidebar.style.display = 'flex';
  membersList.innerHTML = '';
  
  members.sort((a, b) => {
    return (a.name || a.userId).toLowerCase().localeCompare((b.name || b.userId).toLowerCase());
  });
  
  members.forEach(member => membersList.appendChild(createMemberElement(member)));
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

  // Get member avatar
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
  
  return memberDiv;
}
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
    matrixClient = sdk.createClient({
      baseUrl: homeserver
    });

    const response = await matrixClient.login('m.login.password', {
      user: username,
      password: password
    });

    console.log('Login successful!', response);

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
  console.log('starting client...');

  const userId = matrixClient.getUserId();
  userInfo.textContent = `logged in as ${userId}`;

  matrixClient.on('Room.timeline', handleNewMessage);
  matrixClient.on('Room', handleNewRoom);

  await matrixClient.startClient({ initialSyncLimit: 10 });

  matrixClient.once('sync', (state) => {
    if (state === 'PREPARED') {
      console.log('sync complete, loading rooms...');
      loadRooms();
    }
  });
}

function loadRooms() {
  const rooms = matrixClient.getRooms();
  
  if (rooms.length === 0) {
    roomsList.innerHTML = '<p class="loading">no rooms found</p>';
    return;
  }

  rooms.sort((a, b) => {
    const aTimestamp = a.getLastActiveTimestamp();
    const bTimestamp = b.getLastActiveTimestamp();
    return bTimestamp - aTimestamp;
  });

  roomsList.innerHTML = '';

  rooms.forEach(room => {
    const roomElement = createRoomElement(room);
    roomsList.appendChild(roomElement);
  });
}

function createRoomElement(room) {
  const roomDiv = document.createElement('div');
  roomDiv.className = 'room-item';
  roomDiv.dataset.roomId = room.roomId;

  const roomName = room.name || 'unnamed room';
  
  const timeline = room.timeline;
  let lastMessage = 'no messages yet';
  
  if (timeline.length > 0) {
    const lastEvent = timeline[timeline.length - 1];
    if (lastEvent.getType() === 'm.room.message') {
      const content = lastEvent.getContent();
      lastMessage = content.body || '';
      if (lastMessage.length > 40) {
        lastMessage = lastMessage.substring(0, 40) + '...';
      }
    }
  }

  roomDiv.innerHTML = `
    <div class="room-name">${escapeHtml(roomName)}</div>
    <div class="room-last-message">${escapeHtml(lastMessage)}</div>
  `;

  roomDiv.addEventListener('click', () => {
    openRoom(room.roomId);
  });

  return roomDiv;
}

function handleNewRoom(room) {
  console.log('new room joined:', room.roomId);
  loadRooms(); 
}


function openRoom(roomId) {
  currentRoomId = roomId;
  const room = matrixClient.getRoom(roomId);
  const roomName = room.name || 'unnamed room';

  currentRoomName.textContent = roomName;
  messageInputContainer.style.display = 'flex';
  
  messageInput.placeholder = `Message #${roomName}`;

  document.querySelectorAll('.room-item').forEach(item => {
    item.classList.remove('active');
  });
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

  const recentMessages = timeline.slice(-50);
  
  recentMessages.forEach(event => {
    if (event.getType() === 'm.room.message') {
      const messageElement = createMessageElement(event);
      messagesContainer.appendChild(messageElement);
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
  messageDiv.setAttribute('data-avatar', avatarLetter);

  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-sender">${escapeHtml(senderName)}</span>
      <span class="message-time">${timeString}</span>
    </div>
    <div class="message-content">${escapeHtml(content.body)}</div>
  `;

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

  const messageElement = createMessageElement(event);
  messagesContainer.appendChild(messageElement);
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
    try {
      await matrixClient.logout();
      matrixClient.stopClient();
      matrixClient = null;
      
      chatScreen.classList.remove('active');
      loginScreen.classList.add('active');
      
      document.getElementById('password').value = '';
      loginStatus.style.display = 'none';
      
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed: ' + error.message);
    }
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
  if (membersHeader) {
    membersHeader.textContent = `${members.length} Members`;
  }  
  membersSidebar.style.display = 'flex';
  
  membersList.innerHTML = '';
  
  members.sort((a, b) => {
    const nameA = (a.name || a.userId).toLowerCase();
    const nameB = (b.name || b.userId).toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  members.forEach(member => {
    const memberElement = createMemberElement(member);
    membersList.appendChild(memberElement);
  });
}

function createMemberElement(member) {
  const memberDiv = document.createElement('div');
  memberDiv.className = 'member-item';
  
  const displayName = member.name || member.userId.split(':')[0].substring(1);
  const userId = member.userId;
  
  const avatarLetter = displayName.charAt(0).toUpperCase();
  
  const isCurrentUser = userId === matrixClient.getUserId();
  if (isCurrentUser) {
    memberDiv.classList.add('online');
  }
  
  memberDiv.innerHTML = `
    <div class="member-avatar">${avatarLetter}</div>
    <div class="member-info">
      <div class="member-name" title="${escapeHtml(userId)}">${escapeHtml(displayName)}</div>
    </div>
  `;
  
  return memberDiv;
}

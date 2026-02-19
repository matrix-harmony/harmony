import MatrixService from './services/MatrixService.js';
import UIController from './controllers/UIController.js';

const matrix = new MatrixService();
const ui = new UIController();
let state = { currentRoomId: null, view: 'dms', spaceId: null };

matrix.on('ready', () => {
  document.getElementById('loading-screen').classList.remove('active');
  document.getElementById('chat-screen').classList.add('active');
  refreshRooms();
});

matrix.on('new_message', ({ event, room }) => {
  if (room.roomId === state.currentRoomId && event.getType() === 'm.room.message') {
    const timeline = room.timeline;
    ui.renderMessage(event, room, matrix.client, timeline[timeline.length - 2]);
  }
});

function refreshRooms() {
  const rooms = matrix.getFilteredRooms(state.view, state.spaceId);
  ui.roomsList.innerHTML = '';
  rooms.forEach(r => {
    const el = ui.renderRoomItem(r, r.roomId === state.currentRoomId, (id) => selectRoom(id));
    ui.roomsList.appendChild(el);
  });
}

async function selectRoom(roomId) {
  state.currentRoomId = roomId;
  ui.messages.innerHTML = '';
  const room = matrix.client.getRoom(roomId);
  room.timeline.forEach((ev, i) => {
    if (ev.getType() === 'm.room.message') ui.renderMessage(ev, room, matrix.client, room.timeline[i-1]);
  });
}

window.openImage = (url) => {
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';
  overlay.innerHTML = `<img src="${url}">`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
};

document.getElementById('login-form').onsubmit = async (e) => {
  e.preventDefault();
  await matrix.login(document.getElementById('homeserver').value, document.getElementById('username').value, document.getElementById('password').value);
};

const savedHs = localStorage.getItem('matrix_homeserver');
const savedToken = localStorage.getItem('matrix_access_token');
if (savedHs && savedToken) matrix.start(savedHs, savedToken, localStorage.getItem('matrix_user_id'));
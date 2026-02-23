const state = require('./state');
const twemoji = require('twemoji');
const path = require('path');

const TWEMOJI_OPTS = {};

const GIPHY_API_KEY = 'jwGk6OaCOMF9HpXQ2aP6wZubCwSYRyrR';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

const EMOJI_CATEGORIES = [
  { name: 'Smileys', icon: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { name: 'People', icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🫦','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷'] },
  { name: 'Animals', icon: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🦭','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔'] },
  { name: 'Food', icon: '🍎', emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🥗','🥘','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🫖','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️'] },
  { name: 'Travel', icon: '🚀', emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🚲','🛴','🛹','⛽','🚨','🚥','🚦','🛑','🚧','⚓','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚁','🛰️','🚀','🛸','🪐','🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱','🛖','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋'] },
  { name: 'Objects', icon: '💡', emojis: ['⌚','📱','💻','🖥️','🖨️','⌨️','🖱️','💽','💾','💿','📀','🧮','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌','📍','🗺️','📁','📂','🗂️','🗒️','🗓️','📆','📅','📇','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🔫','🏹','🛡️','🔧','🪛','🔩','⚙️','🗜️','⚖️','🦯','🔗','⛓️','🪝','🧲','🪜','🧰'] },
  { name: 'Symbols', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅'] },
];

let emojiPicker = null;
let gifPicker = null;
let gifSearchTimeout = null;

function twemojiImg(emoji) {
  const tmp = document.createElement('span');
  tmp.textContent = emoji;
  twemoji.parse(tmp, TWEMOJI_OPTS);
  return tmp.innerHTML;
}

function createEmojiPicker(onPick) {
  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  picker.id = 'emoji-picker';

  let activeCat = 0;

  const tabs = document.createElement('div');
  tabs.className = 'emoji-tabs';
  picker.appendChild(tabs);

  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  picker.appendChild(grid);

  const renderGrid = () => {
    grid.innerHTML = '';
    EMOJI_CATEGORIES[activeCat].emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-btn-item';
      btn.innerHTML = twemojiImg(emoji);
      btn.title = emoji;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onPick) {
          onPick(emoji);
        } else {
          insertTextAtCursor(emoji);
          closeAllPickers();
        }
      });
      grid.appendChild(btn);
    });
  };

  EMOJI_CATEGORIES.forEach((cat, i) => {
    const tab = document.createElement('button');
    tab.className = 'emoji-tab' + (i === activeCat ? ' active' : '');
    tab.innerHTML = twemojiImg(cat.icon);
    tab.title = cat.name;
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      activeCat = i;
      tabs.querySelectorAll('.emoji-tab').forEach((t, j) => t.classList.toggle('active', j === i));
      renderGrid();
    });
    tabs.appendChild(tab);
  });

  renderGrid();
  return picker;
}

async function fetchGifs(query = '') {
  const endpoint = query
    ? `${GIPHY_BASE}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
    : `${GIPHY_BASE}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Giphy ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

function extractGifUrls(gif) {
  const full = gif.images?.original?.url || gif.images?.fixed_height?.url || null;
  const preview = gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url || full;
  return { full, preview };
}

function createGifPicker() {
  const picker = document.createElement('div');
  picker.className = 'gif-picker';
  picker.id = 'gif-picker';

  const searchBar = document.createElement('div');
  searchBar.className = 'gif-search-bar';
  const searchInput = document.createElement('input');
  searchInput.className = 'gif-search-input';
  searchInput.placeholder = 'Search GIFs...';
  searchInput.type = 'text';
  searchBar.appendChild(searchInput);
  picker.appendChild(searchBar);

  const grid = document.createElement('div');
  grid.className = 'gif-grid';
  grid.innerHTML = '<div class="gif-loading">Loading...</div>';
  picker.appendChild(grid);

  const loadGifs = async (query = '') => {
    grid.innerHTML = '<div class="gif-loading">Loading...</div>';
    try {
      const gifs = await fetchGifs(query);
      grid.innerHTML = '';
      if (!gifs.length) { grid.innerHTML = '<div class="gif-loading">No results</div>'; return; }
      gifs.forEach(gif => {
        const { full, preview } = extractGifUrls(gif);
        const title = gif.title || '';
        if (!full) { console.warn('No URL for gif:', JSON.stringify(gif).slice(0, 200)); return; }
        const img = document.createElement('img');
        img.src = preview || full;
        img.className = 'gif-item';
        img.loading = 'lazy';
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          sendGif(full, title);
          closeAllPickers();
        });
        grid.appendChild(img);
      });
    } catch (err) {
      console.error('GIF load error:', err);
      grid.innerHTML = `<div class="gif-loading">Failed: ${err.message}</div>`;
    }
  };

  searchInput.addEventListener('click', (e) => e.stopPropagation());
  searchInput.addEventListener('input', () => {
    clearTimeout(gifSearchTimeout);
    gifSearchTimeout = setTimeout(() => loadGifs(searchInput.value.trim()), 400);
  });

  loadGifs();
  return picker;
}

async function sendGif(url, title) {
  if (!state.roomId || !state.client) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const filename = (title || 'GIF').replace(/[^a-z0-9 ]/gi, '').trim() || 'GIF';
    const file = new File([blob], `${filename}.gif`, { type: 'image/gif' });
    const uploaded = await state.client.uploadContent(file, { type: 'image/gif' });
    const mxcUrl = uploaded?.content_uri || uploaded;
    await state.client.sendMessage(state.roomId, {
      msgtype: 'm.image',
      url: mxcUrl,
      body: `${filename}.gif`,
      info: { mimetype: 'image/gif' },
    });
  } catch (err) {
    console.error('GIF send error:', err);
  }
}

function insertTextAtCursor(text) {
  const input = document.getElementById('message-input');
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.setSelectionRange(start + text.length, start + text.length);
  input.focus();
  input.dispatchEvent(new Event('input'));
}

function positionPicker(picker, btn) {
  document.body.appendChild(picker);
  const rect = btn.getBoundingClientRect();
  const pw = picker.offsetWidth;
  let left = rect.right - pw;
  let bottom = window.innerHeight - rect.top + 8;
  if (left < 8) left = 8;
  picker.style.position = 'fixed';
  picker.style.left = `${left}px`;
  picker.style.bottom = `${bottom}px`;
  picker.style.top = 'auto';
}

function closeAllPickers() {
  emojiPicker?.remove();
  gifPicker?.remove();
  emojiPicker = null;
  gifPicker = null;
}

function initPickers() {
  const emojiBtn = document.getElementById('emoji-btn');
  const gifBtn = document.getElementById('gif-btn');

  emojiBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (emojiPicker) { closeAllPickers(); return; }
    gifPicker?.remove(); gifPicker = null;
    emojiPicker = createEmojiPicker();
    positionPicker(emojiPicker, emojiBtn);
  });

  gifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gifPicker) { closeAllPickers(); return; }
    emojiPicker?.remove(); emojiPicker = null;
    gifPicker = createGifPicker();
    positionPicker(gifPicker, gifBtn);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#emoji-picker') && !e.target.closest('#gif-picker') &&
        !e.target.closest('#emoji-btn') && !e.target.closest('#gif-btn')) {
      closeAllPickers();
    }
  });
}

function showReactionPicker(anchorBtn, eventId) {
  const existing = document.getElementById('reaction-emoji-picker');
  if (existing) {
    existing.remove();
    return;
  }
  closeAllPickers();

  const picker = createEmojiPicker(async (emoji) => {
    picker.remove();
    if (!state.roomId || !state.client) return;
    const room = state.client.getRoom(state.roomId);
    const myId = state.client.getUserId();
    const alreadyReacted = room?.timeline.some(ev => {
      if (ev.getType() !== 'm.reaction') return false;
      const rel = ev.getContent()['m.relates_to'];
      return rel?.rel_type === 'm.annotation' && rel.event_id === eventId && rel.key === emoji && ev.getSender() === myId;
    });
    if (alreadyReacted) return;
    try {
      const hs = state.client.getHomeserverUrl();
      const token = state.client.getAccessToken();
      const txnId = `rx${Date.now()}${Math.random().toString(36).slice(2)}`;
      await fetch(`${hs}/_matrix/client/v3/rooms/${encodeURIComponent(state.roomId)}/send/m.reaction/${txnId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key: emoji } }),
      });
    } catch (err) { console.error('Reaction error:', err); }
  });
  picker.id = 'reaction-emoji-picker';
  positionPicker(picker, anchorBtn);

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!e.target.closest('#reaction-emoji-picker')) {
        picker.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
}

module.exports = { initPickers, closeAllPickers, showReactionPicker };
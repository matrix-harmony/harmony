// shared mutable state — import this everywhere instead of using globals
const state = {
  client: null,
  roomId: null,
  spaceId: null,
  homeView: 'dms',
  profileMember: null,
  loadingHistory: false,
  canLoadMore: true,
  allMembers: [],
  memberRange: { start: 0, end: 40 },
};

module.exports = state;

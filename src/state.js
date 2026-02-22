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
  lastRoomPerSpace: {},
};

module.exports = state;

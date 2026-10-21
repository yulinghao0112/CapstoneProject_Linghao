import chatReducer from './redux/chat/reducers';
import * as constants from './redux/chat/constants';

describe('Chat Reducer', () => {
  const initialState = {
    active_user: 3,
    activeMeetingId: null,
    currentSite: {
      id: null,
      name: null,
      url: null
    },
    siteLoading: false,
    currentProject: {
      key: null,
      name: null,
      id: null
    },
    projectLoading: false,
    users: [],
    groups: [],
    contacts: []
  };

  describe('Initial State', () => {
    test('returns initial state when state is undefined', () => {
      const result = chatReducer(undefined, {});
      // Check key properties instead of entire state due to complex initial data
      expect(result).toHaveProperty('activeMeetingId', null);
      expect(result).toHaveProperty('active_user', 3);
      expect(result).toHaveProperty('currentProject.key', null);
      expect(result).toHaveProperty('currentSite.id', null);
      expect(result).toHaveProperty('projectLoading', false);
      expect(result).toHaveProperty('siteLoading', false);
      expect(Array.isArray(result.users)).toBe(true);
      expect(Array.isArray(result.groups)).toBe(true);
      expect(Array.isArray(result.contacts)).toBe(true);
    });

    test('returns current state for unknown action types', () => {
      const currentState = {
        ...initialState,
        users: [{ id: 1, name: 'Test User' }]
      };

      const result = chatReducer(currentState, { type: 'UNKNOWN_ACTION' });
      expect(result).toEqual(currentState);
    });
  });

  describe('Project Management Actions', () => {
    test('SET_CURRENT_PROJECT sets the current project', () => {
      const project = {
        key: 'TEST-PROJECT',
        name: 'Test Project',
        id: '12345',
        description: 'A test project'
      };

      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: project
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentProject: project
      });
    });

    test('SET_CURRENT_PROJECT handles null project', () => {
      const currentState = {
        ...initialState,
        currentProject: { key: 'OLD-PROJECT', name: 'Old Project' }
      };

      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: null
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        currentProject: null
      });
    });

    test('SET_CURRENT_PROJECT overwrites existing project', () => {
      const oldProject = { key: 'OLD-PROJECT', name: 'Old Project' };
      const newProject = { key: 'NEW-PROJECT', name: 'New Project' };

      const currentState = {
        ...initialState,
        currentProject: oldProject
      };

      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: newProject
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        currentProject: newProject
      });
      expect(result.currentProject).not.toEqual(oldProject);
    });

    test('CLEAR_CURRENT_PROJECT clears the current project', () => {
      const currentState = {
        ...initialState,
        currentProject: { key: 'TEST-PROJECT', name: 'Test Project' }
      };

      const action = {
        type: constants.CLEAR_CURRENT_PROJECT
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        currentProject: {
          key: null,
          name: null,
          id: null
        },
        projectLoading: false
      });
    });

    test('CLEAR_CURRENT_PROJECT when project is already null', () => {
      const action = {
        type: constants.CLEAR_CURRENT_PROJECT
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentProject: {
          key: null,
          name: null,
          id: null
        },
        projectLoading: false
      });
    });

    test('SET_PROJECT_LOADING sets project loading state', () => {
      const action = {
        type: constants.SET_PROJECT_LOADING,
        payload: true
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        projectLoading: true
      });
    });

    test('SET_PROJECT_LOADING can set loading to false', () => {
      const currentState = {
        ...initialState,
        projectLoading: true
      };

      const action = {
        type: constants.SET_PROJECT_LOADING,
        payload: false
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        projectLoading: false
      });
    });
  });

  describe('Site Management Actions', () => {
    test('SET_CURRENT_SITE sets the current site', () => {
      const site = {
        id: 'site-123',
        name: 'Test Site',
        url: 'https://test.atlassian.net',
        avatarUrl: 'https://example.com/avatar.png'
      };

      const action = {
        type: constants.SET_CURRENT_SITE,
        payload: site
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentSite: site
      });
    });

    test('SET_CURRENT_SITE handles null site', () => {
      const currentState = {
        ...initialState,
        currentSite: { id: 'old-site', name: 'Old Site' }
      };

      const action = {
        type: constants.SET_CURRENT_SITE,
        payload: null
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        currentSite: null
      });
    });

    test('SET_CURRENT_SITE overwrites existing site', () => {
      const oldSite = { id: 'old-site', name: 'Old Site' };
      const newSite = { id: 'new-site', name: 'New Site' };

      const currentState = {
        ...initialState,
        currentSite: oldSite
      };

      const action = {
        type: constants.SET_CURRENT_SITE,
        payload: newSite
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        currentSite: newSite
      });
      expect(result.currentSite).not.toEqual(oldSite);
    });

    test('CLEAR_CURRENT_SITE clears the current site', () => {
      const currentState = {
        ...initialState,
        currentSite: { id: 'test-site', name: 'Test Site' }
      };

      const action = {
        type: constants.CLEAR_CURRENT_SITE
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        currentSite: {
          id: null,
          name: null,
          url: null
        },
        siteLoading: false
      });
    });

    test('CLEAR_CURRENT_SITE when site is already null', () => {
      const action = {
        type: constants.CLEAR_CURRENT_SITE
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentSite: {
          id: null,
          name: null,
          url: null
        },
        siteLoading: false
      });
    });

    test('SET_SITE_LOADING sets site loading state', () => {
      const action = {
        type: constants.SET_SITE_LOADING,
        payload: true
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        siteLoading: true
      });
    });

    test('SET_SITE_LOADING can set loading to false', () => {
      const currentState = {
        ...initialState,
        siteLoading: true
      };

      const action = {
        type: constants.SET_SITE_LOADING,
        payload: false
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        siteLoading: false
      });
    });
  });

  describe('Meeting Management Actions', () => {
    test('SET_ACTIVE_MEETING_ID sets the active meeting ID', () => {
      const meetingId = 'meeting-123';

      const action = {
        type: constants.SET_ACTIVE_MEETING_ID,
        payload: meetingId
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        activeMeetingId: meetingId
      });
    });

    test('SET_ACTIVE_MEETING_ID handles null meeting ID', () => {
      const currentState = {
        ...initialState,
        activeMeetingId: 'old-meeting-456'
      };

      const action = {
        type: constants.SET_ACTIVE_MEETING_ID,
        payload: null
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        activeMeetingId: null
      });
    });

    test('SET_ACTIVE_MEETING_ID overwrites existing meeting ID', () => {
      const currentState = {
        ...initialState,
        activeMeetingId: 'old-meeting-123'
      };

      const action = {
        type: constants.SET_ACTIVE_MEETING_ID,
        payload: 'new-meeting-456'
      };

      const result = chatReducer(currentState, action);

      expect(result).toEqual({
        ...currentState,
        activeMeetingId: 'new-meeting-456'
      });
    });
  });

  describe('State Immutability', () => {
    test('reducer does not mutate original state', () => {
      const originalState = {
        ...initialState,
        currentProject: { key: 'TEST', name: 'Test' },
        users: [{ id: 1, name: 'User 1' }]
      };
      
      const stateClone = JSON.parse(JSON.stringify(originalState));

      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: { key: 'NEW-TEST', name: 'New Test' }
      };

      const result = chatReducer(originalState, action);

      // Original state should not be modified
      expect(originalState).toEqual(stateClone);
      // Result should be different object
      expect(result).not.toBe(originalState);
      // But should contain updated data
      expect(result.currentProject).toEqual({ key: 'NEW-TEST', name: 'New Test' });
    });

    test('reducer returns new object reference for state changes', () => {
      const currentState = { ...initialState };

      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: { key: 'TEST', name: 'Test' }
      };

      const result = chatReducer(currentState, action);

      expect(result).not.toBe(currentState);
      expect(result).toEqual({
        ...currentState,
        currentProject: { key: 'TEST', name: 'Test' }
      });
    });

    test('reducer preserves other state properties when updating one', () => {
      const complexState = {
        ...initialState,
        users: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }],
        groups: [{ id: 1, name: 'Group 1' }],
        contacts: [{ id: 1, name: 'Contact 1' }],
        active_user: 999,
        activeMeetingId: 'meeting-existing',
        currentProject: { key: 'OLD-PROJECT', name: 'Old Project', id: 'old-id' },
        currentSite: { id: 'old-site', name: 'Old Site', url: 'old-url' },
        projectLoading: true,
        siteLoading: false
      };

      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: { key: 'NEW-PROJECT', name: 'New Project', id: 'new-id' }
      };

      const result = chatReducer(complexState, action);

      expect(result).toEqual({
        ...complexState,
        currentProject: { key: 'NEW-PROJECT', name: 'New Project', id: 'new-id' },
        projectLoading: false // SET_CURRENT_PROJECT automatically sets this to false
      });

      // Verify all other properties are preserved
      expect(result.users).toEqual(complexState.users);
      expect(result.groups).toEqual(complexState.groups);
      expect(result.contacts).toEqual(complexState.contacts);
      expect(result.active_user).toEqual(complexState.active_user);
      expect(result.activeMeetingId).toEqual(complexState.activeMeetingId);
      expect(result.currentSite).toEqual(complexState.currentSite);
      expect(result.siteLoading).toEqual(complexState.siteLoading);
    });
  });

  describe('Complex State Interactions', () => {
    test('multiple actions can be applied in sequence', () => {
      let state = initialState;

      // Set current site
      state = chatReducer(state, {
        type: constants.SET_CURRENT_SITE,
        payload: { id: 'site-1', name: 'Site 1' }
      });

      // Set current project
      state = chatReducer(state, {
        type: constants.SET_CURRENT_PROJECT,
        payload: { key: 'PROJ-1', name: 'Project 1' }
      });

      // Set active meeting
      state = chatReducer(state, {
        type: constants.SET_ACTIVE_MEETING_ID,
        payload: 'meeting-1'
      });

      // Set loading states
      state = chatReducer(state, {
        type: constants.SET_PROJECT_LOADING,
        payload: true
      });

      state = chatReducer(state, {
        type: constants.SET_SITE_LOADING,
        payload: true
      });

      expect(state).toEqual({
        ...initialState,
        currentSite: { id: 'site-1', name: 'Site 1' },
        currentProject: { key: 'PROJ-1', name: 'Project 1' },
        activeMeetingId: 'meeting-1',
        projectLoading: true,
        siteLoading: true
      });
    });

    test('clearing actions work correctly after setting values', () => {
      let state = {
        ...initialState,
        currentSite: { id: 'site-1', name: 'Site 1' },
        currentProject: { key: 'PROJ-1', name: 'Project 1' },
        activeMeetingId: 'meeting-1',
        projectLoading: true,
        siteLoading: true
      };

      // Clear project
      state = chatReducer(state, {
        type: constants.CLEAR_CURRENT_PROJECT
      });

      // Clear site
      state = chatReducer(state, {
        type: constants.CLEAR_CURRENT_SITE
      });

      // Clear meeting
      state = chatReducer(state, {
        type: constants.SET_ACTIVE_MEETING_ID,
        payload: null
      });

      // Set loading states to false
      state = chatReducer(state, {
        type: constants.SET_PROJECT_LOADING,
        payload: false
      });

      state = chatReducer(state, {
        type: constants.SET_SITE_LOADING,
        payload: false
      });

      expect(state).toEqual(initialState);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles undefined payload gracefully', () => {
      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: undefined
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentProject: undefined
      });
    });

    test('handles empty object payload', () => {
      const action = {
        type: constants.SET_CURRENT_PROJECT,
        payload: {}
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentProject: {}
      });
    });

    test('handles action with no payload property', () => {
      const action = {
        type: constants.SET_CURRENT_PROJECT
        // No payload property
      };

      const result = chatReducer(initialState, action);

      expect(result).toEqual({
        ...initialState,
        currentProject: undefined
      });
    });

    test('handles invalid action type gracefully', () => {
      const invalidAction = {
        type: 'INVALID_ACTION_TYPE',
        payload: 'some data'
      };

      const result = chatReducer(initialState, invalidAction);

      expect(result).toEqual(initialState);
    });
  });
});
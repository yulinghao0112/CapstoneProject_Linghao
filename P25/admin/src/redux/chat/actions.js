import {
    CHAT_USER,ACTIVE_USER,FULL_USER, ADD_LOGGED_USER, CREATE_GROUP
} from './constants';
import { SET_ACTIVE_MEETING_ID, SET_CURRENT_SITE, CLEAR_CURRENT_SITE, SET_SITE_LOADING, 
         SET_CURRENT_PROJECT, CLEAR_CURRENT_PROJECT, SET_PROJECT_LOADING } from "./constants";

export const chatUser = () => ({
    type: CHAT_USER
});

export const activeUser = (userId) => ({
    type: ACTIVE_USER,
    payload : userId
});

export const setFullUser = (fullUser) => ({
    type: FULL_USER,
    payload : fullUser
});

export const addLoggedinUser = (userData) => ({
    type: ADD_LOGGED_USER,
    payload : userData
});

export const createGroup = (groupData) => ({
    type : CREATE_GROUP,
    payload : groupData
})

export const setActiveMeetingId = (meetingId) => ({
  type: SET_ACTIVE_MEETING_ID,
  payload: meetingId
});

// Site management actions
export const setCurrentSite = (siteInfo) => {
  return {
    type: SET_CURRENT_SITE,
    payload: siteInfo
  };
};

export const clearCurrentSite = () => {
  return {
    type: CLEAR_CURRENT_SITE
  };
};

export const setSiteLoading = (loading) => {
  return {
    type: SET_SITE_LOADING,
    payload: loading
  };
};

// Project management actions
export const setCurrentProject = (projectInfo) => {
  return {
    type: SET_CURRENT_PROJECT,
    payload: projectInfo
  };
};

export const clearCurrentProject = () => {
  return {
    type: CLEAR_CURRENT_PROJECT
  };
};

export const setProjectLoading = (loading) => {
  return {
    type: SET_PROJECT_LOADING,
    payload: loading
  };
};
/* @flow */
import StoryClient from '../helpers/StoryClient';
import {STORY_TYPE} from '../constants/story';
import actionTypes from '../constants/storyActionTypes';
import type {Action, Issue, Story, StoryNode, InvalidStory, MemberSummary} from '../flowtypes';

type State = {
  client: ?StoryClient,
  index: string,
  isConnecting: boolean,
  isInitialised: boolean,
  invalids: InvalidStory[],
  issues: Issue[],
  memberSummary: MemberSummary[]
};


/**
 * Story, Issueにchildrenツリーを付与して返す
 *
 * @param {Object} parent Story or Issue
 * @param {Object} childMap parentIdをキーとしたStoryリスト
 * @return {Object}
 */
function parseStoryChildren(parent: Story|Issue, childMap: {[key: number]: Story[]}) {
  const stories = childMap[parent.id] || [];
  const children = stories.map(child => {
    return parseStoryChildren(child, childMap);
  });
  return Object.assign({}, parent, {children});
}


/**
 * Story
 *
 * @param {Object[]} flatStories storyリスト
 * @return {Object[]}
 */
export function createStoryTree(flatStories: StoryNode[]): {
  issues: Issue[],
  invalids: InvalidStory[]
} {
  const issues: Issue[] = [];
  const invalids: InvalidStory[] = [];
  const storyMap: {[key: number]: Story[]} = {};

  flatStories.sort((a, b) => {
    return a.card.pos - b.card.pos;
  }).forEach(s => {
    if (s.type === STORY_TYPE.issue) {
      issues.push(((s: any): Issue));
    } else if (s.type === STORY_TYPE.invalid) {
      invalids.push(((s: any): InvalidStory));
    } else {
      const key = ((s: any): Story).parentId;
      if (!storyMap[key]) {
        storyMap[key] = [];
      }
      storyMap[key].push(((s: any): Story));
    }
  });
  return {
    invalids,
    issues: issues.map(issue => {
      return parseStoryChildren(issue, storyMap);
    })};
}


/**
 * Story Store
 *
 * @param {Object} state State of story
 * @param {Object} action action
 * @return {Object}
 */
export default function story(state: State = {
  client: null,
  isConnecting: false,
  isInitialised: false,
  issues: [],
  invalids: [],
  index: '0',
  memberSummary: []
}, action: Action): State {
  switch (action.type) {
  case actionTypes.CHANGE_INDEX:
    return Object.assign({}, state, action.payload);
  case actionTypes.LOGIN:
    return Object.assign({}, state, {
      client: action.payload
    });
  case actionTypes.FETCH_STORIES:
    return Object.assign({}, state, {
      isConnecting: true
    });
  case actionTypes.RECEIVE_STORIES:
    if (action.error) {
      return Object.assign({}, state, {client: null, isConnecting: false});
    }
    const ret = createStoryTree(((action.payload: any): StoryNode[]));
    return Object.assign({}, state, {
      isConnecting: false,
      isInitialised: true,
      index: ret.issues && ret.issues[0].id.toString()
    }, ret);
  default:
    break;
  }
  return state;
}

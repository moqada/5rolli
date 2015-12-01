/* @flow */
/* eslint camelcase: 0 */
// XXX: Trello APIパラメータでスネークケースを使用する必要があるためcamelcaseルールを解除
import request from 'superagent';

import {STORY_TYPE, STORY_STATUS} from '../constants/story';
import type {StoryNode, Sprint} from '../flowtypes';

const NAME_BASE_REGEX = /^(\d+):\s+(?:\((?:(\d+)\/)?(\d+)\/(\d+)\)\s+)?(.*)$/;
const API_ENDPOINT = 'https://api.trello.com';
const AVATAR_ENDPOINT = 'https://trello-avatars.s3.amazonaws.com';


/**
 * Story Client
 */
export default class StoryClient {

  apiToken: string;
  apiKey: string;
  boardId: string;

  /**
   * constructor
   *
   * @param {string} apiToken trello api token
   * @param {string} apiKey trello api key
   * @param {string} boardUrl trello board url
   */
  constructor(apiToken: string, apiKey: string, boardUrl: string) {
    const match = /https?:\/\/trello.com\/b\/([-_0-9A-Za-z]+)/.exec(boardUrl);
    if (!match) {
      throw new Error(`Invalid board url: ${boardUrl}`);
    }
    this.boardId = match[1];
    this.apiToken = apiToken;
    this.apiKey = apiKey;
  }

  /**
   * Trello CardのnameからStoryの素オブジェクトに変換
   *
   * @param {string} name card name
   * @return {Object}
   */
  parseCardName(name: string): Object {
    const match = NAME_BASE_REGEX.exec(name);
    if (!match) {
      return {
        title: name,
        type: STORY_TYPE.invalid
      };
    }
    const [id, spent, es50, es90, body] = match.slice(1);
    const parentMatch = body.match(/\s+#(\d+)/);
    const dependsMatch = body.match(/\s+&(\d+)/g);
    const parentId = parentMatch && parseInt(parentMatch[1], 10);
    const baseStory = {
      id,
      title: body.replace(/(\s+#(\d+))|(\s+&(\d+))/g, '').trim(),
      dependIds: dependsMatch ? dependsMatch.map(m => parseInt(/\d+/.exec(m)[0], 10)) : []
    };
    if (parentId) {
      return Object.assign({}, baseStory, {
        parentId,
        type: STORY_TYPE.story,
        time: {
          spent: spent ? parseInt(spent, 10) : null,
          es50: es50 ? parseInt(es50, 10) : null,
          es90: es90 ? parseInt(es90, 10) : null
        }
      });
    }
    return Object.assign({}, baseStory, {
      summary: {
        current: 0,
        past: 0,
        open: 0,
        close: 0,
        wait: 0
      },
      type: STORY_TYPE.issue
    });
  }

  /**
   * Trello ListのnameからSprintに変換
   *
   * @param {string} name trello list name
   * @return {?Sprint}
   */
  parseListName(name: string): ?Sprint {
    const sprintMatches = /^Sprint\.\s*\d+\s*\((\d{4})(\d{2})(\d{2})\)/.exec(name);
    if (!sprintMatches) {
      return null;
    }
    const [year, month, day] = sprintMatches.slice(1).map(s => parseInt(s, 10));
    return {
      name,
      due: new Date(year, month - 1, day)
    };
  }

  /**
   * Trello CardとBoardデータからStoryに変換
   *
   * @param {Object} card Trello Card
   * @param {Object} board Trello Board
   * @return {Story}
   */
  parseCard(card: Object, board: Object): StoryNode {
    const story = this.parseCardName(card.name);
    const labels = card.labels.map(label => label.name);
    const members = card.idMembers.map(mid => {
      const member = board.members.find(m => m.id === mid);
      if (!member) {
        return null;
      }
      return {
        username: member.username,
        avatarUrl: member.avatarHash && `${AVATAR_ENDPOINT}/${member.avatarHash}/30.png`
      };
    }).filter(m => m);
    const list = board.lists.find(l => l.id === card.idList);
    const override = {
      members,
      status: labels.indexOf(STORY_STATUS.open) >= 0 ? STORY_STATUS.open : STORY_STATUS.close,
      card: {
        labels,
        url: card.shortUrl,
        listName: list.name,
        pos: card.pos
      }
    };
    const sprint = this.parseListName(list.name);
    if (sprint) {
      return Object.assign({}, story, override, {sprint});
    }
    return Object.assign({}, story, override);
  }

  /**
   * Story 一覧を取得する
   *
   * @return {Promise<Story[], null>}
   */
  getStories(): Promise<StoryNode[]> {
    return new Promise((resolve, reject) => {
      request.get(`${API_ENDPOINT}/1/boards/${this.boardId}`)
        .query({
          cards: 'visible',
          card_fields: 'labels,name,shortUrl,pos,idList,idMembers',
          lists: 'open',
          members: 'all',
          member_fields: 'username,avatarHash',
          token: this.apiToken,
          key: this.apiKey
        })
        .end((err, res) => {
          if (err) {
            return reject(err);
          }
          const stories = res.body.cards.map(card => {
            return this.parseCard(card, res.body);
          });
          resolve(stories);
        });
    });
  }
}

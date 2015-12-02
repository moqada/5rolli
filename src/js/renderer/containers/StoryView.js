/* @flow */
import React, {PropTypes} from 'react';
import {connect} from 'react-redux';
import Story from '../components/Story';
import MemberSummaryView from '../components/MemberSummaryView';

const propTypes = {
  story: PropTypes.object.isRequired
};


class StoryView extends React.Component {
  /**
   * render Stories
   *
   * @param {Object[]} stories story object list
   * @return {ReactElement[]}
   */
  renderStories(stories): React.Element {
    if (stories.length !== 0) {
      return stories.map((story, key) => {
        return (
          <Story
            key={key}
            story={story}
          >
            {this.renderStories(story.children)}
          </Story>
        );
      });
    }
  }

  /**
   * render
   *
   * @return {ReactElement}
   */
  render(): React.Element {
    const {story} = this.props;
    const currentIssue = story.issues.find(i => i.id === story.index);
    return (
      <div className="StoryView">
        <MemberSummaryView memberSummary={story.memberSummary} />
        {this.renderStories(currentIssue.children)}
      </div>
    );
  }
}

/**
 * state を整形
 *
 * @param {Object} state state
 * @return {Object}
 */
function mapStateToProps(state) {
  return {story: state.story};
}

StoryView.propTypes = propTypes;
export default connect(mapStateToProps)(StoryView);

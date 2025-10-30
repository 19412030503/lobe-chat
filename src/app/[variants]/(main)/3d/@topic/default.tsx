'use client';

import Topics from './features/Topics';
import TopicUrlSync from './features/Topics/TopicUrlSync';

const page = () => {
  return (
    <>
      <TopicUrlSync />
      <Topics />
    </>
  );
};

page.displayName = 'ThreeDTopics';

export default page;

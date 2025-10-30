const activeGenerationTopicId = (s: any) => s.activeGenerationTopicId || s.activeTopicId;
const generationTopics = (s: any) => s.generationTopics || [];
const getGenerationTopicById = (id: string) => (s: any) =>
  generationTopics(s).find((topic: any) => topic.id === id);
const isLoadingGenerationTopic = (id: string) => (s: any) =>
  s.loadingGenerationTopicIds?.includes(id) || false;

export const generationTopicSelectors = {
  activeGenerationTopicId,
  generationTopics,
  getGenerationTopicById,
  isLoadingGenerationTopic,
};

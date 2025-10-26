import ChangelogModal from '@/features/ChangelogModal';
import { ChangelogService } from '@/server/services/changelog';

const Changelog = async () => {
  try {
    const service = new ChangelogService();
    const id = await service.getLatestChangelogId();

    if (!id) return null;

    return <ChangelogModal currentId={id} />;
  } catch (error) {
    console.warn('[Changelog] Failed to load latest changelog id', error);
    return null;
  }
};

export default Changelog;

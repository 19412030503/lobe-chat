import { Icon, Tooltip } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { startCase } from 'lodash-es';
import {
  AudioLines,
  BoltIcon,
  BoxesIcon,
  ImageIcon,
  LucideIcon,
  MessageSquareTextIcon,
  MicIcon,
  MusicIcon,
  PhoneIcon,
  VideoIcon,
} from 'lucide-react';
import { AiModelType } from 'model-bank';
import { memo } from 'react';

const icons: Record<AiModelType, LucideIcon> = {
  '3d': BoxesIcon,
  'chat': MessageSquareTextIcon,
  'embedding': BoltIcon,
  'image': ImageIcon,
  'realtime': PhoneIcon,
  'stt': MicIcon,
  'text2music': MusicIcon,
  'text2video': VideoIcon,
  'tts': AudioLines,
};

const labels: Partial<Record<AiModelType, string>> = {
  '3d': '3D Model',
  'text2music': 'Text to Music',
  'text2video': 'Text to Video',
};

const ModelTypeIcon = memo<{ size?: number; type: AiModelType }>(({ type, size = 20 }) => {
  const theme = useTheme();
  const tooltip = labels[type] || `${startCase(type)} Model`;
  return (
    <Tooltip title={tooltip}>
      <Icon color={theme.colorTextDescription} icon={icons?.[type]} size={size} />
    </Tooltip>
  );
});

export default ModelTypeIcon;

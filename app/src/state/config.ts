// Site-wide settings and constants

// Free plan limits (all unlocked in this build, but kept for reference)
export const FREE_MAX = 1080;
export const FREE_IMG_MAX = 1440;
export const FREE_FPS = 30;
export const FREE_EXPORTS = 5;
export const PRO_CATS = ['signature'];

// Social presets: the frame, size and frame rate each platform wants, plus its safe zone guide
export const SOCIAL_PRESETS = {
  reels: { name: 'Reels · TikTok · Shorts', aspect: '9:16', zone: 'reels', res: 1080, fps: 30 },
  story: { name: 'Story', aspect: '9:16', zone: 'story', res: 1080, fps: 30 },
  feed: { name: 'Instagram feed', aspect: '4:5', zone: 'feed', res: 1080, fps: 30 },
  square: { name: 'Square post', aspect: '1:1', zone: '', res: 1080, fps: 30 },
  linkedin: { name: 'LinkedIn · X', aspect: '16:9', zone: '', res: 1080, fps: 30 },
  youtube: { name: 'YouTube · website', aspect: '16:9', zone: '', res: 2160, fps: 30 },
  dribbble: { name: 'Dribbble · Behance', aspect: '4:3', zone: '', res: 1080, fps: 30 },
} as const;

export type SocialPresetKey = keyof typeof SOCIAL_PRESETS;

export const ASPECTS: Record<string, [number, number]> = {
  '16:9': [16, 9],
  '4:3': [4, 3],
  '4:5': [4, 5],
  '1:1': [1, 1],
  '9:16': [9, 16],
  '5:4': [5, 4],
  '3:4': [3, 4],
  '2:3': [2, 3],
};

export const RES_OPTIONS = {
  video: [320, 480, 640, 800, 1080, 1440, 2160],
  gif: [320, 480, 640, 800, 1080],
  image: [720, 1080, 1440, 2160, 3000, 4000, 5000, 6000, 7680],
} as const;

export const FPS_OPTIONS = {
  video: [12, 24, 30, 60, 120],
  gif: [12, 15, 20, 25, 30],
  sequence: [12, 24, 30, 60],
} as const;

export const QUALITY_OPTIONS = ['low', 'medium', 'high', 'max'] as const;
export const GIF_COLORS = [64, 128, 256] as const;

export const IMG_FORMATS = ['png', 'jpeg', 'webp'] as const;
export const VIDEO_FORMATS = ['mp4', 'webm'] as const;
export const EXPORT_KINDS = ['video', 'gif', 'image', 'sequence'] as const;

export const DEFAULT_ASPECT = '5:4';
export const SCHEMA_VERSION = 2;
import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['openhongguo', '@ffmpeg-installer/ffmpeg', 'heic-convert'],
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/openhongguo/dist/**/*', './node_modules/@ffmpeg-installer/**/*', './node_modules/libheif-js/**/*'],
  },
};

export default config;

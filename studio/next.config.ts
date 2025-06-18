
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // The experimental block containing allowedDevOrigins has been removed
  // as it was causing a startup error: "Unrecognized key(s) in object: 'allowedDevOrigins' at "experimental""
};

export default nextConfig;

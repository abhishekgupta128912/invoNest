/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Configure images for better performance
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all domains in production
      },
    ],
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60, // 1 minute
    unoptimized: false, // Enable optimization for Vercel
  },
  // Remove static export for Vercel deployment (use default SSR/SSG)
  // output: 'export',
  // Disable powered by header
  poweredByHeader: false,
  // Generate ETags for better caching
  generateEtags: true,
  // Optimize production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Enable React Refresh in development
  experimental: {
    optimizePackageImports: ['react-hot-toast'],
  },
  // Ensure CSS is processed correctly
  transpilePackages: [],
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Add any custom webpack configurations here
    if (!isServer) {
      // Configure client-side only settings
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // Disable source maps in production for better performance
  productionBrowserSourceMaps: false,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
  },
};

module.exports = nextConfig;

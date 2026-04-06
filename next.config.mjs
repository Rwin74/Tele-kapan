/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vercel build aşamasında ESLint hatalarını yoksay
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vercel build aşamasında TS hatalarını yoksay
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

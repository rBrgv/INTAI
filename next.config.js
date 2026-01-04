/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure API routes are not statically optimized
  experimental: {
    // This ensures API routes are always server-rendered
  },
}

module.exports = nextConfig



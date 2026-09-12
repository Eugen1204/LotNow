/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // <-- Добавлено для корректной и быстрой сборки в Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  },
};

module.exports = nextConfig;
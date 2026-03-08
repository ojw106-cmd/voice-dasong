/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ws'],
  // PWA will be handled via custom service worker in public/
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
}

module.exports = nextConfig

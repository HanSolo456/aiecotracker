/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required to run the full App Router + API routes inside the Tauri desktop shell (embedded Node server).
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
  },
  // Dev HMR: allow Tauri/WebView and LAN origins (hostname only, no port). Add your machine IP if Next warns.
  allowedDevOrigins: ['192.168.0.101', '10.105.0.56', '127.0.0.1', 'localhost'],
};

export default nextConfig;

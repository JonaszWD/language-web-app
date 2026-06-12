/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const dest = process.env.BACKEND_URL ?? "http://backend:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${dest}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

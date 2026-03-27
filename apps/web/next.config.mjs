/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@tanstack/react-query", "zod"]
  },
  async redirects() {
    return [
      {
        source: "/profile",
        destination: "/app/profile",
        permanent: false
      },
      {
        source: "/history",
        destination: "/app/history",
        permanent: false
      },
      {
        source: "/duels/private",
        destination: "/app/duels/private",
        permanent: false
      },
      {
        source: "/duels/:id",
        destination: "/app/duels/:id",
        permanent: false
      },
      {
        source: "/problems/new",
        destination: "/app/problems/new",
        permanent: false
      },
      {
        source: "/problems/:id",
        destination: "/app/problems/:id",
        permanent: false
      }
    ];
  }
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生成 standalone 自包含输出，无需 node_modules 即可在服务器运行
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.douyinpic.com",
      },
    ],
  },
};

export default nextConfig;

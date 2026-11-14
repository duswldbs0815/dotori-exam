import type { NextConfig } from "next";

// 기본 보안 헤더: 다른 사이트가 우리 화면을 몰래 감싸지 못하게(클릭재킹), 파일 형식 위장 금지,
// 다른 사이트로 넘어갈 때 주소 전체(쿼리 포함)를 넘기지 않음, 카메라·마이크·위치 사용 안 함
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

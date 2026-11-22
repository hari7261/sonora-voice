import type { NextConfig } from 'next';
const nextConfig: NextConfig = { reactStrictMode: true, serverExternalPackages: ['sherpa-onnx-node'] };
export default nextConfig;

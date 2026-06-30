/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The harness package is standalone and not part of the Next build.
  outputFileTracingExcludes: {
    "*": ["./harness/**"],
  },
};

export default nextConfig;

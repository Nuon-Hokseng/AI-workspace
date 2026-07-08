/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // ponytail: files are stored as bytea in Postgres (no object storage
    // yet), so this doubles as the de facto upload size ceiling. Move to
    // S3/R2 if documents need to exceed this.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

import path from 'path';
import { fileURLToPath } from 'url';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Cesium configuration
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        stream: false,
        url: false,
      };

      // Add Cesium aliases
      config.resolve.alias = {
        ...config.resolve.alias,
        cesium: path.resolve(__dirname, 'node_modules/cesium/Source'),
      };
    }

    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    // Handle Cesium workers and assets
    config.module.rules.push({
      test: /\.(glb|pnts|geojson|json)$/,
      type: 'asset/resource',
    });

    // Handle Cesium CSS
    config.module.rules.push({
      test: /\.css$/,
      include: path.resolve(__dirname, 'node_modules/cesium'),
      use: ['style-loader', 'css-loader'],
    });

    // Copy Cesium Assets, Widgets, and Workers to public directory
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Workers'),
              to: path.join(__dirname, 'public/cesium/Workers'),
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/ThirdParty'),
              to: path.join(__dirname, 'public/cesium/ThirdParty'),
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Assets'),
              to: path.join(__dirname, 'public/cesium/Assets'),
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Widgets'),
              to: path.join(__dirname, 'public/cesium/Widgets'),
            },
          ],
        })
      );
    }

    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;

module.exports = {
  apps: [
    {
      name: 'turnal-api',
      script: './apps/api/dist/main.mjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        API_PORT: 4000
      }
    },
    {
      name: 'turnal-edge',
      script: './apps/edge/dist/server.mjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        EDGE_PORT: 8080
      }
    },
    {
      name: 'turnal-dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './apps/dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};

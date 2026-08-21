// pm2 config for running the app permanently in the background.
// See DOCUMENTATION.md ("Running permanently") for setup steps.
module.exports = {
  apps: [
    {
      name: 'gurbani-app',
      cwd: 'server',
      script: './run-with-secrets.sh',
      args: ['node', 'src/index.js'],
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
    },
  ],
}

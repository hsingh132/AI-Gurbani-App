// pm2 config for running the app permanently in the background.
// See DOCUMENTATION.md ("Running permanently") for setup steps.
module.exports = {
  apps: [
    {
      name: 'gurbani-app',
      cwd: 'server',
      script: 'src/index.js',
      node_args: '--env-file=.env',
      autorestart: true,
      max_restarts: 10,
    },
  ],
}

//ecosystem.config.js

module.exports = {
	apps: [
		{
			name: 'united-states-school-districts',
			script: 'dist/server.js',
			exec_mode: 'cluster', // Enables zero-downtime reloads
			watch: false,
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};

//ecosystem.config.js

module.exports = {
	apps: [
		{
			name: 'candycomp-united-states-school-districts-api',
			script: 'dist/server.js',
			exec_mode: 'cluster',
			watch: false,
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};

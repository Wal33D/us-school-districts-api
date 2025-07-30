# GitHub Repository Update Instructions

To update the repository name, description, and topics, you'll need to:

1. **Create a GitHub Personal Access Token**:
   - Go to https://github.com/settings/tokens
   - Generate a new token with `repo` scope
   - Save the token securely

2. **Update Repository Name** (from `candycomp-us-school-districts-api` to `us-school-districts-api`):
   ```bash
   curl -X PATCH \
     -H "Authorization: token YOUR_GITHUB_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/repos/Wal33D/candycomp-us-school-districts-api \
     -d '{"name":"us-school-districts-api"}'
   ```

3. **Update Repository Description and Homepage**:
   ```bash
   curl -X PATCH \
     -H "Authorization: token YOUR_GITHUB_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/repos/Wal33D/us-school-districts-api \
     -d '{
       "description": "High-performance, memory-optimized API for US school district lookups using official NCES boundary data",
       "homepage": "https://github.com/Wal33D/us-school-districts-api#readme",
       "topics": ["api", "school-districts", "geospatial", "education", "nces", "gis", "nodejs", "typescript", "express"]
     }'
   ```

4. **After updating the repo name**, update your git remote:
   ```bash
   git remote set-url origin https://github.com/Wal33D/us-school-districts-api.git
   ```

## Alternative: Using GitHub Web Interface

1. Go to https://github.com/Wal33D/candycomp-us-school-districts-api/settings
2. Update:
   - Repository name: `us-school-districts-api`
   - Description: `High-performance, memory-optimized API for US school district lookups using official NCES boundary data`
   - Topics: `api`, `school-districts`, `geospatial`, `education`, `nces`, `gis`, `nodejs`, `typescript`, `express`
3. Save changes

## Topics/Tags to Add:
- `api` - It's an API service
- `school-districts` - Main functionality
- `geospatial` - Uses geographic data
- `education` - Education sector
- `nces` - Uses NCES data
- `gis` - Geographic Information System
- `nodejs` - Built with Node.js
- `typescript` - Written in TypeScript
- `express` - Uses Express framework
- `rest-api` - RESTful API
- `pm2` - Uses PM2 for production
- `open-data` - Uses open government data
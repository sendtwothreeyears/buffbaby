---
name: deploy
description: "Deploy the current project to a hosting platform"
---

# /deploy [platform]

Deploy the current project.

## Supported Platforms

- `fly` / `flyio` - Deploy to Fly.io using `flyctl deploy`
- `vercel` - Deploy to Vercel using `vercel --prod`
- `netlify` - Deploy to Netlify using `netlify deploy --prod`
- `railway` - Deploy to Railway using `railway up`
- `cloudflare` - Deploy to Cloudflare Workers using `wrangler deploy`

## Steps

1. Auto-detect platform from config files (fly.toml, vercel.json, netlify.toml, etc.)
2. If no config found, ask which platform to use
3. Run the deploy command
4. Report: deployment URL, status, any errors

## Notes

- Requires platform CLI to be authenticated (use `/install` + platform-specific auth if needed)
- Always show the deploy log output
- If deploy fails, show the error and suggest fixes

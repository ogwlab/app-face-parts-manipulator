# Face Parts Manipulator v7.0.1 Security + VPS Deployment Record

## Date

2026-05-06

## Summary

Security hardening changes were built and deployed to the current VPS-backed production environment.

## Production Target

| Item | Value |
|------|-------|
| Public URL | `https://ogwlab.org/face-parts-manipulator/` |
| SSH target | `ogwlab-vps` |
| Remote user | `root` |
| Remote path | `/var/www/html/face-parts-manipulator/` |
| Web server | nginx |
| nginx config | `/etc/nginx/sites-available/wordpress` |
| nginx config backup | `/etc/nginx/sites-available/wordpress.bak-20260506180218` |

The previous Xserver rental-server deployment record is historical only. Current production is served by the VPS nginx location for `/face-parts-manipulator/`.

## Deployment Commands

```bash
npm run build
source deploy/utils.sh
source .env.deploy
generate_htaccess "${BASE_PATH:-/face-parts-manipulator/}"
rsync -avz --delete dist/ ogwlab-vps:/var/www/html/face-parts-manipulator/
ssh ogwlab-vps 'nginx -t && systemctl reload nginx'
```

## Security Verification

- `npm audit --omit=dev`: 0 vulnerabilities
- Production CSP does not include `'unsafe-eval'`
- Production response does not set wildcard CORS for app/model files
- Production headers confirmed:
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Content-Security-Policy`

## Functional Verification

- `npm run lint`: success
- `npm run build`: success
- `https://ogwlab.org/face-parts-manipulator/`: HTTP 200
- Browser load via Playwright: page title and upload UI rendered
- Browser console: 0 warnings, 0 errors

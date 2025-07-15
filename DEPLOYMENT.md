# Deployment Guide

## Production Setup

This guide documents the production deployment of Claude Chat History Viewer at https://claude-search.dataintegrities.com/

### Infrastructure Overview

```
Internet → Cloudflare DNS → Home Router → Nginx Proxy → macOS Server (port 3101)
```

### DNS Configuration

1. **Domain**: `claude-search.dataintegrities.com`
2. **DNS Provider**: Cloudflare
3. **Record Type**: A record pointing to home IP address
4. **Proxy Status**: DNS only (no Cloudflare proxy) for local network access

### Nginx Configuration

Location: `/etc/nginx/sites-available/claude-search.dataintegrities.com`

Key configuration elements:
- SSL/TLS enabled with Let's Encrypt certificates
- HTTP to HTTPS redirect
- Proxy pass to internal machine on port 3101
- **Security**: Restricted to local network (192.x.x.x) addresses only
- WebSocket support for real-time features

### Local Server Setup

1. **Service**: Running on macOS via launchd
2. **Port**: 3101
3. **Auto-start**: Configured with `com.dataintegrities.claude-history.plist`
4. **Logs**: Located in `/Users/jeffk/Developement/provider-search/claude/logs/`

### Security Considerations

- ✅ HTTPS encryption for all traffic
- ✅ Local network access only (192.x.x.x restriction in nginx)
- ✅ No authentication required (relies on network restriction)
- ⚠️ Future: Add authentication layer for additional security

### Monitoring

Check service status:
```bash
# Local service
launchctl list | grep claude-history

# Nginx logs
tail -f /var/log/nginx/claude-search.dataintegrities.com.access.log
tail -f /var/log/nginx/claude-search.dataintegrities.com.error.log

# Application logs
tail -f ~/Developement/provider-search/claude/logs/stdout.log
tail -f ~/Developement/provider-search/claude/logs/stderr.log
```

### Troubleshooting

1. **Site not accessible externally**: Working as designed - nginx restricts to local network
2. **502 Bad Gateway**: Check if service is running on port 3101
3. **SSL certificate issues**: Run `certbot renew` on nginx server
4. **Service not starting**: Check launchd logs with `log show --predicate 'process == "launchd"' --last 1h`

### Future Enhancements

- [ ] Add authentication layer (OAuth2 or similar)
- [ ] Implement rate limiting
- [ ] Add health check endpoint for monitoring
- [ ] Set up automated backups of history-index.json
- [ ] Add Prometheus metrics for monitoring
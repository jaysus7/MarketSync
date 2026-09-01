# MarketSync social integrations

This is the production setup checklist for the `marketsync-backend` Render service. Never
put an app secret, access token, refresh token, or encryption key in Git, frontend JavaScript,
screenshots, support tickets, or chat. Enter secrets directly in Render.

## 1. Shared Render settings

Set these first in each backend environment (staging and production have separate values):

| Render variable | Value |
|---|---|
| `API_URL` | The exact public backend origin, with no trailing slash |
| `FRONTEND_URL` | `https://marketsync.link` in production |
| `PII_ENCRYPTION_KEY` | Existing stable 32-byte key; changing it makes stored tokens unreadable |
| `OAUTH_STATE_SECRET` | Existing strong generated secret |
| `RUN_SOCIAL_PUBLISH_WORKER` | `true` |
| `CRON_SECRET` | Strong random value for the manual/monitoring cron endpoint |

Every provider callback is `${API_URL}/social/callback/{provider}`. Add the exact callback
to the matching provider portal. Scheme, hostname, path, and trailing slash must match.

Recommended separation:

- Use one set of developer apps for staging and another for production.
- Put only staging callbacks in staging apps and production callbacks in production apps.
- Keep all developer apps in a company-owned account with at least two administrators.

## 2. Meta: Facebook Pages and Instagram

Render variables:

```text
META_APP_ID
META_APP_SECRET
META_GRAPH_VERSION=v23.0
```

The same Meta app can connect Facebook Pages and Instagram Professional accounts.

1. Open Meta for Developers and create a Business app owned by the MarketSync Business
   Portfolio.
2. Add Facebook Login for Business and the Instagram API product.
3. Add both valid OAuth redirect URIs:
   - `${API_URL}/social/callback/facebook`
   - `${API_URL}/social/callback/instagram`
4. Add `marketsync.link` as an app domain and configure the production privacy-policy URL,
   terms URL, and user-data-deletion instructions.
5. Request Facebook permissions `pages_show_list`, `pages_read_engagement`, and
   `pages_manage_posts`.
6. Request Instagram permissions `instagram_basic` and `instagram_content_publish`, plus
   the Page permissions above.
7. For development, add the connecting Facebook profile as an app administrator/developer
   or tester. For customer accounts, complete Business Verification and App Review/Advanced
   Access for every requested permission.
8. Instagram must be a Professional Business or Creator account linked to a Facebook Page.
   The person connecting it must have full control of the Page and business portfolio.
9. Copy the App ID and App Secret into Render, redeploy, then connect each Page/account from
   MarketSync Marketing > Social Accounts.

Implemented publishing: Facebook text/single-image posts; Instagram JPEG, Reels, and up to
10-item carousels. MarketSync automatically creates a JPEG derivative for its own Studio WebP
images. Instagram source video must be a public MP4/MOV URL.

## 3. LinkedIn

Render variables:

```text
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_API_VERSION=202604
```

1. Create a company-owned app in the LinkedIn Developer Portal and associate it with the
   MarketSync LinkedIn Page.
2. Request the “Sign In with LinkedIn using OpenID Connect” and “Share on LinkedIn” products.
3. Add `${API_URL}/social/callback/linkedin` as an authorized redirect URL.
4. Confirm the app receives `openid`, `profile`, and `w_member_social`.
5. Add the Client ID and Client Secret to Render and redeploy.
6. LinkedIn organization posting is a separate Community Management approval and requires
   `w_organization_social`; the current MarketSync connection publishes member text posts.

Implemented publishing: member text posts. Image/video asset upload remains disabled and is
reported honestly in the composer/publish result.

## 4. YouTube

Render variables:

```text
YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET
```

1. Create a company-owned Google Cloud project.
2. Enable YouTube Data API v3.
3. Configure the OAuth consent screen, authorized domains, privacy policy, and production
   app publishing status.
4. Create an OAuth Client ID of type Web application.
5. Add `${API_URL}/social/callback/youtube` as an authorized redirect URI.
6. Add test users while the consent screen is in testing. Submit verification for production
   use of the YouTube scopes.
7. Copy the OAuth Client ID and Client Secret into Render and redeploy.

Connection and refresh-token storage are implemented. Video upload remains disabled until the
resumable upload adapter and quota/error monitoring are completed; MarketSync does not claim a
YouTube video was published.

## 5. TikTok

Render variables:

```text
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
```

1. Create a company-owned app in TikTok for Developers.
2. Add Login Kit and Content Posting API.
3. Add `${API_URL}/social/callback/tiktok` as the redirect URI.
4. Request `user.info.basic` and `video.publish`.
5. Verify the MarketSync media domain/URL prefix required for URL-based posting.
6. Complete TikTok app review and enable Direct Post for production accounts.
7. Copy the Client Key and Client Secret into Render and redeploy.

Connection and token refresh are implemented. Direct Post remains disabled until creator-info,
privacy selection, media transfer, status polling, and TikTok audit requirements are completed.

## 6. X

Render variables:

```text
X_CLIENT_ID
X_CLIENT_SECRET
```

1. Create a Project and App in the X Developer Portal under the company account.
2. Enable OAuth 2.0 and choose Web App / confidential client.
3. Set app permissions to Read and Write.
4. Add `${API_URL}/social/callback/x` as the callback URL and `https://marketsync.link` as the
   website URL.
5. Ensure the X API plan attached to the project allows creating posts.
6. Copy the OAuth 2.0 Client ID and Client Secret into Render and redeploy.

Implemented publishing: text posts using OAuth 2.0 Authorization Code with state-bound S256
PKCE. Media upload remains disabled and is never presented as a successful publish.

## 7. Pinterest

Render variables:

```text
PINTEREST_APP_ID
PINTEREST_APP_SECRET
```

1. Use a company-owned Pinterest Business account and open Pinterest Developers > My apps.
2. Create the MarketSync app and request Pinterest API access. Production customer accounts
   require an approved access tier; a Sandbox or Trial token is only for controlled testing.
3. Add `${API_URL}/social/callback/pinterest` as an exact redirect URI.
4. Request `boards:read`, `boards:write`, `pins:read`, `pins:write`, and
   `user_accounts:read`.
5. Copy the App ID and App Secret into Render and redeploy.
6. In MarketSync, connect Pinterest and choose the specific board that should receive Pins.
   Connect additional boards separately when the dealership publishes to more than one.

Implemented publishing: one public HTTPS image per Pin, with the MarketSync caption mapped to
the Pin title/description. Scheduled posts use MarketSync's durable queue. Pinterest video and
multi-image formats remain disabled and are reported honestly instead of claiming success.

## 8. Final production verification

For each provider:

1. Redeploy the backend after setting credentials.
2. Connect a company-owned test account in MarketSync.
3. Confirm the account-selection screen shows the expected Page/channel/profile.
4. Publish a private/test-safe post and verify the provider ID appears in MarketSync.
5. Schedule another post at least two minutes ahead and confirm the queue worker publishes it.
6. Revoke access at the provider, retry once, and confirm MarketSync marks the account expired
   rather than reporting success.
7. Repeat in staging before enabling the production developer app for customers.

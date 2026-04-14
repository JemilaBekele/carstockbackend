# Auth Validation Scenarios

This checklist validates authentication and authorization hardening without changing business behavior.

## Test Environment

- Frontend: `D:/SELF_PROJECT/carstcokfrontend`
- Backend: `D:/SELF_PROJECT/carstockbackend`
- Browser matrix: Chrome, Edge, Firefox
- Device matrix: desktop + one lower-performance mobile device/emulator
- Network profiles: normal, fast 3G, slow 3G

## Baseline Preconditions

1. Use a valid active user account.
2. Use one account with broad permissions and one with restricted permissions.
3. Ensure `CORS_ALLOWED_ORIGINS` includes frontend origin in production-like env.
4. Ensure backend has `JWT_SECRET`, rate limiter values, and `TRUST_PROXY` configured.

## Scenario 1: Single Login Reliability

1. Open an incognito window.
2. Visit `/login`.
3. Sign in with valid credentials.
4. Verify immediate redirect to dashboard.
5. Reload dashboard and open 2-3 protected pages.

Expected:
- Login succeeds once (no second login required).
- No redirect loop back to `/login`.
- Protected API calls succeed with 2xx responses.

## Scenario 2: Slow Device / Slow Network

1. Enable slow network throttling.
2. Repeat Scenario 1 on a low-performance device/emulator.
3. Observe first 10 seconds after submit.

Expected:
- No transient state that forces another login attempt.
- Session remains valid on first dashboard navigation.

## Scenario 3: Wrong Credentials and Rate Limiter

1. Attempt 5+ invalid logins using same email.
2. Attempt invalid logins with same IP and multiple emails.
3. Attempt valid login after failures.

Expected:
- Invalid attempts are rejected consistently.
- Rate limiter counters persist across attempts (not reset every request).
- Valid login eventually works when limits allow.

## Scenario 4: CORS Origin Validation

1. Run backend in production mode.
2. Access API from allowed origin.
3. Access API from non-allowed origin.

Expected:
- Allowed origin works with auth headers.
- Non-allowed origin fails preflight or request as expected.

## Scenario 5: Session Persistence and Refresh Endpoint

1. Sign in and keep app open until access token nears expiry.
2. Call `POST /api/auth/refresh-tokens` with refresh token.
3. Retry protected API requests.

Expected:
- Refresh endpoint returns new token pair.
- Protected requests continue without full relogin when refresh is used.

## Scenario 6: Authorization Consistency

1. Login as restricted-permission user.
2. Hit endpoints listed as auth-only in `RBAC_COVERAGE_MATRIX.md`.
3. Hit endpoints with explicit `checkPermission`.

Expected:
- `checkPermission` routes enforce permission boundaries.
- Auth-only routes remain reachable to authenticated users (current behavior baseline).

## Scenario 7: Proxy-Aware IP Extraction

1. Deploy behind reverse proxy/load balancer.
2. Send requests with `x-forwarded-for`.
3. Verify login behavior and limiter consistency.

Expected:
- Backend uses stable client IP extraction path.
- No false double-login behavior caused by proxy IP mismatches.

## Pass Criteria

- Across browser/device/network matrix, first successful login grants immediate protected access.
- No increase in unauthorized access.
- No regression in protected endpoint behavior.
- Auth logs clearly identify failure reason category (auth rejection, CORS rejection, token issues).

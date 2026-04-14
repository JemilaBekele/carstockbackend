# RBAC Coverage Matrix

This matrix reflects the current middleware usage in `src/routes` and highlights auth/authz consistency gaps.

| Route file | Public endpoints present | Auth-only endpoints present | Auth + checkPermission endpoints present | Commented-out checkPermission |
| --- | ---: | ---: | ---: | --- |
| `auth.route.js` | Yes | Yes | No | Yes |
| `permission.route.js` | Yes | Yes | No | No |
| `role.route.js` | Yes | Yes | No | No |
| `rolePermission.route.js` | No | Yes | No | No |
| `Branch.route.js` | No | Yes | Yes | Yes |
| `Brand.route.js` | Yes | Yes | No | Yes |
| `Cart.route.js` | Yes | Yes | No | Yes |
| `Category.route.js` | Yes | Yes | No | Yes |
| `company.route.js` | Yes | Yes | No | Yes |
| `Customer.route.js` | No | Yes | No | Yes |
| `document.route.js` | No | Yes | No | No |
| `GeneralDashboard.route.js` | Yes | No | No | No |
| `inventorydashboard.route.js` | No | Yes | No | No |
| `MissingStockLedger.route.js` | No | Yes | No | Yes |
| `Product.route.js` | Yes | Yes | No | Yes |
| `ProductBatch.route.js` | Yes | Yes | No | Yes |
| `purchase.route.js` | No | Yes | No | Yes |
| `Report.route.js` | Yes | Yes | No | No |
| `Sell.route.js` | No | Yes | Yes | Yes |
| `SellStockCorrect.route.js` | No | Yes | No | Yes |
| `Shop.route.js` | No | Yes | No | Yes |
| `StockCorrection.route.js` | No | Yes | No | Yes |
| `Store.route.js` | No | Yes | No | Yes |
| `transfer.route.js` | No | Yes | No | Yes |
| `UnitOfMeasure.route.js` | Yes | Yes | No | Yes |
| `yearend.route.js` | No | Yes | No | No |

## High Priority Findings

1. `role.route.js` exposes public RBAC-management surface (`POST /api/roles`, `GET /api/roles/:id`).
2. `permission.route.js` exposes `GET /api/roles/:roleName/permissions` publicly.
3. `rolePermission.route.js` currently uses `auth` only for role-permission mutation operations.
4. `GeneralDashboard.route.js` has public dashboard endpoints.
5. Many business routes are auth-only because `checkPermission(...)` is commented out, which creates inconsistent RBAC enforcement for authenticated users.

/*
================================================================================
 Entitlement impact dry-run — READ ONLY. Run BEFORE deploying the billing release.
================================================================================

WHY THIS EXISTS
---------------
Until now `Tenant.ResolvedModules` returned the onboarding module picks verbatim and ignored the
plan entirely, so tenants could hold modules their tier never included. The billing release makes
the plan a hard ceiling (the selection is intersected with PlanLimits.Modules).

That is the intended behaviour, but for an existing tenant it is indistinguishable from an outage:
someone using POS every day on a Micro-equivalent plan simply loses the menu. Run this first, read
the output, and decide per tenant — upgrade them, or grant an override — BEFORE the deploy.

HOW TO RUN
----------
  sqlcmd -S <server> -U sa -P '<pw>' -C -d SoftaxisErpDb -i entitlement-impact-report.sql

  (Docker:  docker exec vrodux-sqlserver /opt/mssql-tools18/bin/sqlcmd \
              -S localhost -U sa -P '<pw>' -C -d SoftaxisErpDb -i /tmp/entitlement-impact-report.sql)

Nothing here writes. It is safe to run against production at any time.

NOTE ON ORDERING
----------------
Run this BEFORE the AddBillingAndRenameLegacyPlans migration and it reports legacy plan names
(Starter/Business); run it after and it reports the new ones (Micro/Professional). Both are useful —
before tells you what will change, after confirms it landed.
================================================================================
*/

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

-- ── 1. Plan distribution ─────────────────────────────────────────────────────
-- Before the migration expect only Starter/Business/Enterprise.
-- After it expect only Micro/Starter/Professional/Enterprise, with ZERO rows left on 'Business'.
PRINT '=== 1. Tenants per plan ===';
SELECT   [Plan], [Status], COUNT(*) AS Tenants
FROM     [identity].[tenants]
WHERE    [IsDeleted] = 0
GROUP BY [Plan], [Status]
ORDER BY [Plan], [Status];


-- ── 2. Tenants holding modules their tier will no longer include ─────────────
-- THE important one. Every row here is a tenant that loses a module at deploy.
--
-- EnabledModules is a JSON array of module codes; OPENJSON expands it. The entitlement lists below
-- mirror PlanDefinitions.cs — keep the two in step if you change the catalogue.
PRINT '';
PRINT '=== 2. Modules that would be REVOKED by plan enforcement ===';

WITH entitlement AS (
    -- Core modules: available on every tier.
    SELECT p.[Plan], m.[Module]
    FROM   (VALUES ('Micro'), ('Starter'), ('Professional'), ('Enterprise')) AS p([Plan])
    CROSS JOIN (VALUES
        ('dashboard'), ('crm'), ('sales'), ('purchase'), ('inventory'),
        ('finance'), ('hr'), ('reports'), ('settings'), ('users'),
        ('notifications'), ('file-manager'), ('project-management'), ('ai-assistant')
    ) AS m([Module])

    UNION ALL
    -- Professional adds the POS / food-service family.
    SELECT p.[Plan], m.[Module]
    FROM   (VALUES ('Professional'), ('Enterprise')) AS p([Plan])
    CROSS JOIN (VALUES ('pos'), ('restaurant'), ('recipe'), ('hospitality')) AS m([Module])

    UNION ALL
    -- Enterprise adds every industry pack.
    SELECT 'Enterprise', m.[Module]
    FROM   (VALUES ('real-estate'), ('construction'), ('healthcare'),
                   ('education'), ('insurance'), ('b2b'), ('visa')) AS m([Module])
),
held AS (
    SELECT t.[Id]   AS TenantId,
           t.[Name] AS TenantName,
           t.[Plan],
           t.[Status],
           t.[Industry],
           LOWER(LTRIM(RTRIM(j.[value]))) AS [Module]
    FROM   [identity].[tenants] t
    CROSS APPLY OPENJSON(t.[EnabledModules]) j
    WHERE  t.[IsDeleted] = 0
      AND  t.[EnabledModules] IS NOT NULL
      AND  ISJSON(t.[EnabledModules]) = 1
)
SELECT   h.TenantName,
         h.[Plan],
         h.[Status],
         h.[Module] AS ModuleLost,
         h.[Industry],
         h.TenantId
FROM     held h
WHERE    NOT EXISTS (
             SELECT 1 FROM entitlement e
             WHERE  e.[Plan] = h.[Plan] AND e.[Module] = h.[Module]
         )
         -- The tenant's own industry-pack module is force-added on EVERY tier
         -- (see Tenant.ResolvedModules), so it is never actually lost. Excluded to
         -- keep this list to genuine losses only.
         AND h.[Module] <> CASE h.[Industry]
                               WHEN 'real_estate'   THEN 'real-estate'
                               WHEN 'construction'  THEN 'construction'
                               WHEN 'healthcare'    THEN 'healthcare'
                               WHEN 'education'     THEN 'education'
                               WHEN 'insurance'     THEN 'insurance'
                               WHEN 'b2b_services'  THEN 'b2b'
                               WHEN 'visa_services' THEN 'visa'
                               ELSE '~none~'
                           END
ORDER BY h.TenantName, h.[Module];

PRINT '';
PRINT '   No rows above = enforcement changes nothing for existing tenants. Safe to deploy.';
PRINT '   Rows above    = each is a tenant that LOSES that module. Before deploying, either';
PRINT '                   move them to a tier that includes it, or accept the downgrade.';


-- ── 3. Tenants already over their new seat limit ─────────────────────────────
-- Existing users are never removed, but CreateUserCommandHandler will refuse NEW users
-- while a tenant is at or over its cap. Worth knowing about in advance.
PRINT '';
PRINT '=== 3. Tenants at or over the seat limit for their plan ===';

WITH seat_limit AS (
    SELECT * FROM (VALUES
        ('Micro', 3), ('Starter', 10), ('Professional', 50), ('Enterprise', -1),
        -- Legacy names, in case this is run before the rename migration.
        ('Business', 15)
    ) AS l([Plan], MaxUsers)
)
SELECT   t.[Name] AS TenantName,
         t.[Plan],
         l.MaxUsers,
         COUNT(u.[Id]) AS ActiveUsers
FROM     [identity].[tenants] t
JOIN     seat_limit l ON l.[Plan] = t.[Plan]
LEFT JOIN [identity].[users] u
       ON u.[TenantId] = t.[Id] AND u.[IsDeleted] = 0
WHERE    t.[IsDeleted] = 0 AND l.MaxUsers > 0
GROUP BY t.[Name], t.[Plan], l.MaxUsers
HAVING   COUNT(u.[Id]) >= l.MaxUsers
ORDER BY t.[Name];


-- ── 4. Trials that expire immediately once the lifecycle job runs ────────────
-- These tenants are ALREADY blocked at the gateway (SubscriptionEnforcementMiddleware checks
-- TrialEndsAt directly), so this changes nothing for them operationally — but they will now be
-- emailed and their status persisted as Expired. Their data is untouched either way.
PRINT '';
PRINT '=== 4. Trials already past their end date ===';
SELECT   [Name] AS TenantName, [Plan], [Status], [TrialEndsAt], [ContactEmail]
FROM     [identity].[tenants]
WHERE    [IsDeleted] = 0
  AND    [Status] = 'Trial'
  AND    [TrialEndsAt] IS NOT NULL
  AND    [TrialEndsAt] < SYSUTCDATETIME()
ORDER BY [TrialEndsAt];

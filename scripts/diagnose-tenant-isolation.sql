/* ============================================================================
   diagnose-tenant-isolation.sql   (READ-ONLY — makes no changes)
   ----------------------------------------------------------------------------
   Pinpoints why one tenant (e.g. the demo tenant) can see another tenant's
   (e.g. 4B Properties) CRM leads. Run against SoftaxisErpDb and share the output.

   It answers:
     1. Which tenants exist (id / name / slug / status).
     2. How CRM leads are distributed across TenantId (NULL vs each real tenant).
     3. Whether the leads that "leak" are NULL-tenant (legacy, created before
        isolation) or stamped to a specific tenant.
     4. Each admin user's TenantId (so we can confirm the demo admin is scoped).
   ============================================================================ */
SET NOCOUNT ON;

PRINT '=== 1. Tenants ===';
SELECT Id, Name, Slug, Status, CreatedAt
FROM [identity].[tenants]
ORDER BY CreatedAt;

PRINT '';
PRINT '=== 2. CRM leads grouped by TenantId (NULL = legacy/demo, unowned) ===';
SELECT
    l.TenantId,
    t.Name AS TenantName,
    COUNT(*) AS LeadCount
FROM [crm].[leads] l
LEFT JOIN [identity].[tenants] t ON t.Id = l.TenantId
WHERE l.IsDeleted = 0
GROUP BY l.TenantId, t.Name
ORDER BY LeadCount DESC;

PRINT '';
PRINT '=== 3. Sample of leads with their TenantId (first 30) ===';
SELECT TOP 30
    l.Id,
    l.Company,
    l.FirstName + '' '' + l.LastName AS Person,
    l.TenantId,
    t.Name AS OwnerTenant
FROM [crm].[leads] l
LEFT JOIN [identity].[tenants] t ON t.Id = l.TenantId
WHERE l.IsDeleted = 0
ORDER BY l.CreatedAt DESC;

PRINT '';
PRINT '=== 4. Admin users and their TenantId (is the demo admin scoped?) ===';
SELECT
    u.Email,
    u.Username,
    u.FirstName + '' '' + u.LastName AS FullName,
    u.TenantId,
    t.Name AS TenantName,
    u.IsSuperAdmin
FROM [identity].[users] u
LEFT JOIN [identity].[tenants] t ON t.Id = u.TenantId
ORDER BY u.IsSuperAdmin DESC, t.Name;

PRINT '';
PRINT '=== 5. Same NULL-tenant check across other business tables (quick scan) ===';
SELECT 'crm.leads'      AS TableName, COUNT(*) AS NullTenantRows FROM [crm].[leads]      WHERE TenantId IS NULL AND IsDeleted = 0
UNION ALL SELECT 'crm.deals',      COUNT(*) FROM [crm].[deals]      WHERE TenantId IS NULL AND IsDeleted = 0
UNION ALL SELECT 'crm.customers',  COUNT(*) FROM [crm].[customers]  WHERE TenantId IS NULL AND IsDeleted = 0;

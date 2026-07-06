/* ============================================================================
   cleanup-demo-data.sql
   ----------------------------------------------------------------------------
   Removes ONLY legacy demo / sample rows (the shadow column TenantId IS NULL)
   from tenant-scoped business tables. Real tenant data (TenantId = <a real GUID>,
   e.g. 4B Properties) is NEVER touched — the WHERE clause is always
   `TenantId IS NULL`.

   WHY: demo seeders historically ran at startup with no tenant context, so their
   rows landed with TenantId = NULL. The tenant query filter hides NULL rows from
   real tenants, but they can still surface via dashboards / aggregates. Module
   "fix(seeding): stop demo data…" stops NEW demo rows; this script clears the OLD ones.

   SAFETY CHECKLIST — READ BEFORE RUNNING:
     1. BACK UP SoftaxisErpDb first (full backup).
     2. Run as-is FIRST (@DryRun = 1) — it only PRINTS what would be deleted.
     3. Review the printed counts. Confirm no real-tenant table is listed with a
        surprising count (real data has a non-NULL TenantId and is not counted).
     4. Only then set @DryRun = 0 and run again to delete.

   EXCLUDED (never cleaned):
     - Every [identity] table (users / roles / tenants / permissions).
     - Global reference with no TenantId column (currencies, exchange_rates) —
       they don't have the column, so they can't match and are skipped automatically.
     - Essential tenant-scoped reference kept on purpose: account types, chart of
       accounts, tax periods (see @Exclude below).
   ============================================================================ */

SET NOCOUNT ON;

DECLARE @DryRun BIT = 1;   -- 1 = preview only (safe).  0 = actually delete.

-- Tables that HAVE a TenantId column but must NOT be cleaned (essential reference).
DECLARE @Exclude TABLE (SchemaName sysname, TableName sysname);
INSERT INTO @Exclude (SchemaName, TableName) VALUES
    ('finance', 'account_types'),
    ('finance', 'accounts'),
    ('finance', 'tax_periods');

-- Candidate tables: any user table with a nullable TenantId column, outside [identity].
IF OBJECT_ID('tempdb..#Targets') IS NOT NULL DROP TABLE #Targets;
SELECT s.name AS SchemaName, t.name AS TableName
INTO #Targets
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id AND c.name = 'TenantId'
WHERE s.name <> 'identity'
  AND NOT EXISTS (SELECT 1 FROM @Exclude e WHERE e.SchemaName = s.name AND e.TableName = t.name);

-- ── Diagnostic: how many NULL-tenant rows per table ──────────────────────────
PRINT '=== NULL-tenant (demo) row counts ===';
DECLARE @sch sysname, @tbl sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT SchemaName, TableName FROM #Targets ORDER BY SchemaName, TableName;
OPEN cur; FETCH NEXT FROM cur INTO @sch, @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'DECLARE @n int; SELECT @n = COUNT(*) FROM ' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl) +
               N' WHERE TenantId IS NULL; IF @n > 0 PRINT ''  ' + @sch + N'.' + @tbl + N' : '' + CAST(@n AS varchar(20));';
    EXEC sp_executesql @sql;
    FETCH NEXT FROM cur INTO @sch, @tbl;
END
CLOSE cur; DEALLOCATE cur;

IF @DryRun = 1
BEGIN
    PRINT '';
    PRINT '--- DRY RUN complete. No rows were deleted. ---';
    PRINT '--- Review the counts above, back up the DB, then set @DryRun = 0 and re-run. ---';
    DROP TABLE #Targets;
    RETURN;
END

-- ── Execute deletion inside a transaction ────────────────────────────────────
-- FK constraints are disabled on the target tables for the delete so table order
-- doesn't matter (the demo rows form a self-contained NULL-tenant graph), then
-- re-enabled WITH CHECK.
PRINT '';
PRINT '=== DELETING NULL-tenant rows (transactional) ===';

BEGIN TRY
    BEGIN TRAN;

    -- Disable FK enforcement on target tables
    DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT SchemaName, TableName FROM #Targets;
    OPEN cur2; FETCH NEXT FROM cur2 INTO @sch, @tbl;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl) + N' NOCHECK CONSTRAINT ALL;';
        EXEC sp_executesql @sql;
        FETCH NEXT FROM cur2 INTO @sch, @tbl;
    END
    CLOSE cur2; DEALLOCATE cur2;

    -- Delete NULL-tenant rows
    DECLARE @total bigint = 0, @rows bigint;
    DECLARE cur3 CURSOR LOCAL FAST_FORWARD FOR SELECT SchemaName, TableName FROM #Targets;
    OPEN cur3; FETCH NEXT FROM cur3 INTO @sch, @tbl;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'DELETE FROM ' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl) + N' WHERE TenantId IS NULL;';
        EXEC sp_executesql @sql;
        SET @rows = @@ROWCOUNT;
        SET @total = @total + @rows;
        IF @rows > 0 PRINT '  deleted ' + CAST(@rows AS varchar(20)) + ' from ' + @sch + '.' + @tbl;
        FETCH NEXT FROM cur3 INTO @sch, @tbl;
    END
    CLOSE cur3; DEALLOCATE cur3;

    -- Re-enable FK enforcement (validate existing data)
    DECLARE cur4 CURSOR LOCAL FAST_FORWARD FOR SELECT SchemaName, TableName FROM #Targets;
    OPEN cur4; FETCH NEXT FROM cur4 INTO @sch, @tbl;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl) + N' WITH CHECK CHECK CONSTRAINT ALL;';
        EXEC sp_executesql @sql;
        FETCH NEXT FROM cur4 INTO @sch, @tbl;
    END
    CLOSE cur4; DEALLOCATE cur4;

    PRINT '';
    PRINT '=== DONE. Total NULL-tenant rows deleted: ' + CAST(@total AS varchar(20)) + ' ===';
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT '!!! ERROR — rolled back. No changes committed. !!!';
    PRINT ERROR_MESSAGE();
END CATCH;

DROP TABLE #Targets;

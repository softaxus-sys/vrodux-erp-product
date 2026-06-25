#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — SQL Server Maintenance Script
# Runs index maintenance, statistics update, and integrity checks.
#
# Usage: ./database/maintenance.sh
# Schedule: Weekly via cron (Sunday 06:00 AM)
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vrodux}"
ENV_FILE="${APP_DIR}/shared/.env"
CONTAINER_NAME="${CONTAINER_NAME:-vrodux-sqlserver}"
DATABASE_NAME="${DATABASE_NAME:-SoftaxisErpDb}"

if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

SA_PASSWORD="${SQL_SA_PASSWORD:?SQL_SA_PASSWORD not set}"

echo "[$(date)] Starting database maintenance for $DATABASE_NAME..."

# Rebuild fragmented indexes (>30% fragmentation)
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SA_PASSWORD" -C -d "$DATABASE_NAME" \
    -Q "
    DECLARE @sql NVARCHAR(MAX) = N'';
    SELECT @sql += 'ALTER INDEX ' + QUOTENAME(i.name) + ' ON ' +
        QUOTENAME(s.name) + '.' + QUOTENAME(t.name) +
        CASE WHEN ps.avg_fragmentation_in_percent > 30
             THEN ' REBUILD WITH (ONLINE = OFF);'
             ELSE ' REORGANIZE;'
        END + CHAR(13)
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ps
    JOIN sys.indexes i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE ps.avg_fragmentation_in_percent > 10
      AND ps.index_id > 0
      AND ps.page_count > 1000;
    IF LEN(@sql) > 0 EXEC sp_executesql @sql;
    PRINT 'Index maintenance complete.';
    "

# Update statistics
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SA_PASSWORD" -C -d "$DATABASE_NAME" \
    -Q "EXEC sp_updatestats; PRINT 'Statistics updated.';"

# Check database integrity
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SA_PASSWORD" -C -d "$DATABASE_NAME" \
    -Q "DBCC CHECKDB ('$DATABASE_NAME') WITH NO_INFOMSGS; PRINT 'Integrity check passed.';"

# Shrink log file if over 1 GB
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SA_PASSWORD" -C -d "$DATABASE_NAME" \
    -Q "
    DECLARE @logName NVARCHAR(128);
    SELECT @logName = name FROM sys.database_files WHERE type_desc = 'LOG';
    IF (SELECT size * 8 / 1024 FROM sys.database_files WHERE type_desc = 'LOG') > 1024
    BEGIN
        DBCC SHRINKFILE(@logName, 256);
        PRINT 'Log file shrunk.';
    END
    ELSE PRINT 'Log file size OK.';
    "

echo "[$(date)] Database maintenance complete."

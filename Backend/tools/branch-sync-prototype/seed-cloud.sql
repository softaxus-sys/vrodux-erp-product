SET QUOTED_IDENTIFIER ON;
DECLARE @t uniqueidentifier='4BE5DD59-EEBC-459F-9A42-B19AF2749F8B';
DECLARE @u uniqueidentifier='4023E5D8-AD7B-401B-922E-4AD2750BB6B3';
DECLARE @tbl sysname, @where nvarchar(400), @cols nvarchar(max), @sql nvarchar(max);
DECLARE c CURSOR FOR SELECT * FROM (VALUES
 ('tenants','Id=@t'),('branches','TenantId=@t'),('roles','TenantId=@t'),
 ('role_permissions','RoleId IN (SELECT Id FROM SoftaxisErpDb.[identity].roles WHERE TenantId=@t)'),
 ('users','Id=@u'),('user_roles','UserId=@u')) v(a,b);
OPEN c; FETCH NEXT FROM c INTO @tbl,@where;
WHILE @@FETCH_STATUS=0 BEGIN
 SELECT @cols=STRING_AGG(QUOTENAME(d.name),',') FROM SoftaxisProtoCloud.sys.columns d
  JOIN SoftaxisProtoCloud.sys.tables dt ON dt.object_id=d.object_id AND dt.name=@tbl JOIN SoftaxisProtoCloud.sys.schemas ds ON ds.schema_id=dt.schema_id AND ds.name='identity'
  JOIN SoftaxisErpDb.sys.columns s ON s.name=d.name
  JOIN SoftaxisErpDb.sys.tables st ON st.object_id=s.object_id AND st.name=@tbl JOIN SoftaxisErpDb.sys.schemas ss ON ss.schema_id=st.schema_id AND ss.name='identity'
  WHERE d.is_computed=0;
 IF @cols IS NULL PRINT 'NO COLS '+@tbl;
 SET @sql=N'INSERT INTO SoftaxisProtoCloud.[identity].'+QUOTENAME(@tbl)+'('+@cols+') SELECT '+@cols+' FROM SoftaxisErpDb.[identity].'+QUOTENAME(@tbl)+' WHERE '+@where+' AND NOT EXISTS(SELECT 1 FROM SoftaxisProtoCloud.[identity].'+QUOTENAME(@tbl)+' x WHERE 1=0)';
 EXEC sp_executesql @sql,N'@t uniqueidentifier,@u uniqueidentifier',@t,@u;
 PRINT @tbl+': '+CAST(@@ROWCOUNT AS varchar);
 FETCH NEXT FROM c INTO @tbl,@where;
END
CLOSE c; DEALLOCATE c;

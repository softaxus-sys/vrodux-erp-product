/* ============================================================================
   Why can a CRM Team Lead not see their team members' leads?
   ----------------------------------------------------------------------------
   READ-ONLY. Reproduces LeadAccessGuard.ScopeReadable exactly, step by step, so
   whichever step comes back empty is the answer.

   The rule for the TEAM tier (holds crm.leads-team.view, not crm.leads.view):

       visible  =  leads.AssignedToUserId = me
                OR (leads.TeamId IS NOT NULL AND leads.TeamId is a team I lead)

   Note what is NOT in it: being a MEMBER of a team, or leading the team its
   OWNER belongs to, grants nothing on its own. A lead becomes visible to a team
   lead only once THE LEAD ITSELF is filed to that team (leads.TeamId). An
   unfiled lead (TeamId NULL) is visible to its owner and to full-access roles
   only. That is the usual cause — see STEP 4.

   Holding a second role (e.g. Sales Manager) can never reduce this: roles are
   additive and only a per-USER deny can remove a key. STEP 1 accounts for both.

   [identity] must stay bracketed — it is a reserved word in T-SQL.
   ============================================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @Email nvarchar(320) = N'someone@example.com';   -- <<< set this to the user you are checking

DECLARE @UserId   uniqueidentifier,
        @TenantId uniqueidentifier;

SELECT @UserId = u.[Id], @TenantId = u.[TenantId]
FROM [identity].[users] u
WHERE LOWER(u.[email]) = LOWER(@Email) AND u.[IsDeleted] = 0;

IF @UserId IS NULL
BEGIN
    SELECT 'STEP 0 - user not found (check the address, or it is soft-deleted)' AS Result;
    RETURN;
END

SELECT 'STEP 0 - user' AS Step, @UserId AS UserId, @TenantId AS TenantId;

/* ---------------------------------------------------------------------------
   STEP 1 - effective permissions: (roles UNION user grants) MINUS user denies.
   This is the same formula that builds the JWT, so what shows here is what the
   API sees at request time.
   --------------------------------------------------------------------------- */
;WITH role_perms AS (
    SELECT p.[Id], p.[ModuleId] + '.' + p.[Action] AS [PermKey]
    FROM [identity].[user_roles] ur
    JOIN [identity].[role_permissions] rp ON rp.[RoleId] = ur.[RoleId]
    JOIN [identity].[permissions] p       ON p.[Id] = rp.[PermissionId]
    WHERE ur.[UserId] = @UserId
),
grants AS (
    SELECT p.[Id], p.[ModuleId] + '.' + p.[Action] AS [PermKey]
    FROM [identity].[user_permissions] up
    JOIN [identity].[permissions] p ON p.[Id] = up.[PermissionId]
    WHERE up.[UserId] = @UserId AND up.[IsGranted] = 1
),
denies AS (
    SELECT up.[PermissionId]
    FROM [identity].[user_permissions] up
    WHERE up.[UserId] = @UserId AND up.[IsGranted] = 0
),
effective AS (
    SELECT x.[PermKey]
    FROM (SELECT * FROM role_perms UNION SELECT * FROM grants) x
    WHERE x.[Id] NOT IN (SELECT [PermissionId] FROM denies)
)
SELECT 'STEP 1 - view tier' AS Step,
       MAX(CASE WHEN [PermKey] = 'crm.leads.view'          THEN 1 ELSE 0 END) AS has_full_view,
       MAX(CASE WHEN [PermKey] = 'crm.leads-team.view'     THEN 1 ELSE 0 END) AS has_team_view,
       MAX(CASE WHEN [PermKey] = 'crm.leads-assigned.view' THEN 1 ELSE 0 END) AS has_assigned_view,
       (SELECT CAST(u.[IsSuperAdmin] AS int) FROM [identity].[users] u WHERE u.[Id] = @UserId) AS is_super_admin
FROM effective;
/* has_full_view = 1  -> should already see everything; the cause is elsewhere.
   has_team_view = 1, has_full_view = 0 -> the team rule below applies.
   all three 0        -> no view tier at all; grant one. */

/* ---------------------------------------------------------------------------
   STEP 2 - teams this user LEADS. Only these count.
   Being listed as a member of a team is irrelevant here; only TeamLeadUserId
   matters, and only while IsActive = 1 AND IsDeleted = 0. An empty result means
   the team rule can never match a single lead.
   --------------------------------------------------------------------------- */
SELECT 'STEP 2 - teams led' AS Step,
       t.[Id] AS TeamId, t.[Name], t.[IsActive], t.[IsDeleted], t.[TenantId],
       (SELECT COUNT(*) FROM [identity].[team_members] m WHERE m.[TeamId] = t.[Id]) AS member_count
FROM [identity].[teams] t
WHERE t.[TeamLeadUserId] = @UserId;
-- Inactive/deleted teams are listed on purpose: such a team still looks normal
-- in the UI but matches nothing in the guard.

/* ---------------------------------------------------------------------------
   STEP 3 - what this user can see right now (the guard, expressed in SQL).
   --------------------------------------------------------------------------- */
SELECT 'STEP 3 - visible to them' AS Step, COUNT(*) AS visible_leads
FROM [crm].[leads] l
WHERE l.[IsDeleted] = 0
  AND l.[TenantId]  = @TenantId
  AND ( l.[AssignedToUserId] = @UserId
        OR ( l.[TeamId] IS NOT NULL
             AND EXISTS (SELECT 1 FROM [identity].[teams] t
                         WHERE t.[Id] = l.[TeamId]
                           AND t.[TeamLeadUserId] = @UserId
                           AND t.[IsActive] = 1 AND t.[IsDeleted] = 0) ) );

/* ---------------------------------------------------------------------------
   STEP 4 - THE USUAL ANSWER.
   Leads owned by this lead's team members, split by how they are filed.
   unfiled_TeamId_null = invisible to the team lead purely because nobody filed
   them. Fix in the UI: CRM > Leads > tick the rows > "File to team".
   --------------------------------------------------------------------------- */
;WITH led AS (
    SELECT t.[Id]
    FROM [identity].[teams] t
    WHERE t.[TeamLeadUserId] = @UserId AND t.[IsActive] = 1 AND t.[IsDeleted] = 0
),
members AS (
    SELECT DISTINCT m.[UserId]
    FROM [identity].[team_members] m
    WHERE m.[TeamId] IN (SELECT [Id] FROM led)
)
SELECT 'STEP 4 - leads owned by their members' AS Step,
       COUNT(*)                                                    AS owned_by_members,
       SUM(CASE WHEN l.[TeamId] IS NULL THEN 1 ELSE 0 END)         AS unfiled_TeamId_null,
       SUM(CASE WHEN led.[Id] IS NOT NULL THEN 1 ELSE 0 END)       AS filed_to_a_team_they_lead,
       SUM(CASE WHEN l.[TeamId] IS NOT NULL AND led.[Id] IS NULL
                THEN 1 ELSE 0 END)                                 AS filed_to_another_team
FROM [crm].[leads] l
JOIN members mem      ON mem.[UserId] = l.[AssignedToUserId]
-- LEFT JOIN, not IN(): SQL Server cannot aggregate over a subquery.
LEFT JOIN led         ON led.[Id] = l.[TeamId]
WHERE l.[IsDeleted] = 0
  AND l.[TenantId]  = @TenantId;

/* ---------------------------------------------------------------------------
   STEP 5 - the same, per member, so you can see who is affected.
   leads_owned = 0 for everyone would mean the leads are assigned by NAME only
   (AssignedToUserId NULL) - see STEP 7.
   --------------------------------------------------------------------------- */
;WITH led AS (
    SELECT t.[Id]
    FROM [identity].[teams] t
    WHERE t.[TeamLeadUserId] = @UserId AND t.[IsActive] = 1 AND t.[IsDeleted] = 0
),
members AS (
    SELECT DISTINCT m.[UserId]
    FROM [identity].[team_members] m
    WHERE m.[TeamId] IN (SELECT [Id] FROM led)
)
SELECT 'STEP 5 - per member' AS Step,
       u.[FirstName] + ' ' + u.[LastName] AS Member,
       u.[email]                          AS Email,
       COUNT(l.[Id])                                             AS leads_owned,
       SUM(CASE WHEN l.[Id] IS NOT NULL AND l.[TeamId] IS NULL
                THEN 1 ELSE 0 END)                               AS unfiled,
       SUM(CASE WHEN led.[Id] IS NOT NULL THEN 1 ELSE 0 END)     AS visible_to_lead
-- DISTINCT members first: someone in two of the led teams would otherwise be
-- joined twice and have every one of their leads counted twice.
FROM members m
JOIN [identity].[users] u ON u.[Id] = m.[UserId]
LEFT JOIN [crm].[leads] l
       ON l.[AssignedToUserId] = m.[UserId]
      AND l.[IsDeleted] = 0
      AND l.[TenantId]  = @TenantId
LEFT JOIN led             ON led.[Id] = l.[TeamId]
GROUP BY u.[FirstName], u.[LastName], u.[email]
ORDER BY leads_owned DESC;

/* ---------------------------------------------------------------------------
   STEP 6 - is anything filed to any team at all, in this tenant?
   --------------------------------------------------------------------------- */
SELECT 'STEP 6 - leads filed per team' AS Step,
       t.[Name] AS Team, t.[IsActive], COUNT(l.[Id]) AS leads_filed_here
FROM [identity].[teams] t
LEFT JOIN [crm].[leads] l ON l.[TeamId] = t.[Id] AND l.[IsDeleted] = 0
WHERE t.[TenantId] = @TenantId AND t.[IsDeleted] = 0
GROUP BY t.[Name], t.[IsActive]
ORDER BY leads_filed_here DESC;

/* ---------------------------------------------------------------------------
   STEP 7 - second most common cause: the lead has an owner NAME but no owner
   ID. Legacy rows, and anything assigned before the picker started storing the
   user id, match no user and so belong to nobody as far as the guard is
   concerned. Re-assign them through the UI to attach an id.
   --------------------------------------------------------------------------- */
SELECT 'STEP 7 - assigned by name only' AS Step,
       l.[AssignedTo] AS OwnerName, COUNT(*) AS leads_with_no_owner_id
FROM [crm].[leads] l
WHERE l.[IsDeleted] = 0
  AND l.[TenantId]  = @TenantId
  AND l.[AssignedToUserId] IS NULL
  AND l.[AssignedTo] IS NOT NULL AND l.[AssignedTo] <> ''
GROUP BY l.[AssignedTo]
ORDER BY leads_with_no_owner_id DESC;

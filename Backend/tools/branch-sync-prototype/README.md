# Branch-server sync prototype (P0)

Proves the design in docs/branch-server-design.md with two local gateways and two databases.

1. Publish the gateway: `dotnet publish Backend/src/ApiGateway/Softaxis.ApiGateway -c Release -o /tmp/gwbranch`
2. Create empty databases `SoftaxisProtoCloud` and `SoftaxisProtoBranch`.
3. Start the cloud (`start-cloud.sh`, port 5301) and a branch (same env, `BranchSync__Mode=Branch`,
   `BranchSync__TenantId/BranchId/CloudBaseUrl/BranchKey`, port 5302). `env.sh <Db>` exports the connection strings.
4. Copy the test tenant into both databases, create two branches on the cloud, put the branch id and key in the
   cloud's `BranchSync__Branches__0__*` settings, restart the cloud.
5. `node scenario.cjs down|up|price|security|outage|recover` (stop the cloud before `outage`, restart before `recover`).

The ids, ports, paths and key in these files are the ones used in the first run; change them for your setup.

## Identity phase (P3)

`identity.cjs make-users|check|offline-login|disable|password` proves sign-in at a branch server.
Use `start-cloud2.sh` / `start-branch2.sh` (the branch has its OWN `Jwt__Secret`). Copy the test tenant, its roles
and role permissions into the cloud database with SQL first; the branch gets them by sync.

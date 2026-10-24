# Branch for the P6 part 2 test: the key comes from /tmp/proto/branch-key.txt (written by failure.cjs from an issued key).
cd /tmp/gwbranch && source /tmp/proto/env.sh SoftaxisProtoBranch
export Jwt__Secret="branch-only-secret-9876543210zyxwvutsrqponmlkjihgfedcba"
export ASPNETCORE_URLS=http://localhost:5302 BranchSync__Mode=Branch \
 BranchSync__TenantId=4BE5DD59-EEBC-459F-9A42-B19AF2749F8B BranchSync__BranchId=089A949F-86F7-41F8-BC10-12FC6538DD6E \
 BranchSync__CloudBaseUrl=http://localhost:5301 BranchSync__BranchKey="$(cat /tmp/proto/branch-key.txt)" \
 BranchSync__IntervalSeconds=3 BranchSync__StartupDelaySeconds=15 BranchSync__MaxBackoffSeconds=10
./Softaxis.ApiGateway.exe > /tmp/proto/branch.log 2>&1

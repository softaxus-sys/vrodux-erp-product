cd /tmp/gwbranch && source /tmp/proto/env.sh SoftaxisProtoCloud
export ASPNETCORE_URLS=http://localhost:5301 BranchSync__Mode=Cloud \
 BranchSync__Branches__0__BranchId=e183f04c-3e89-451f-8e01-6317c3d35f7e BranchSync__Branches__0__TenantId=4BE5DD59-EEBC-459F-9A42-B19AF2749F8B BranchSync__Branches__0__Key=proto-key-branch1-9f3a
./Softaxis.ApiGateway.exe > /tmp/proto/cloud.log 2>&1

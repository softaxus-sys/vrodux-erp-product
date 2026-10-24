# Cloud for the P5 relay test: a short "branch offline" window and a fake Foodpanda (fake-foodpanda.cjs on :5399).
cd /tmp/gwbranch && source /tmp/proto/env.sh SoftaxisProtoCloud
export ASPNETCORE_URLS=http://localhost:5301 BranchSync__Mode=Cloud BranchSync__RelayOfflineAfterSeconds=20 BranchSync__AlertAfterMinutes=1 BranchSync__StartupDelaySeconds=10 \
 Foodpanda__SandboxBaseUrl=http://localhost:5399 \
 BranchSync__Branches__0__BranchId=089A949F-86F7-41F8-BC10-12FC6538DD6E BranchSync__Branches__0__TenantId=4BE5DD59-EEBC-459F-9A42-B19AF2749F8B BranchSync__Branches__0__Key=proto-key-branch1-9f3a
./Softaxis.ApiGateway.exe > /tmp/proto/cloud.log 2>&1

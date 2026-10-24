# Cloud for the P6 part 2 test: NO branch keys in configuration - only keys issued from the head-office screen work.
cd /tmp/gwbranch && source /tmp/proto/env.sh SoftaxisProtoCloud
export ASPNETCORE_URLS=http://localhost:5301 BranchSync__Mode=Cloud BranchSync__StartupDelaySeconds=10 \
 BranchSync__PublicBaseUrl=http://localhost:5301
./Softaxis.ApiGateway.exe > /tmp/proto/cloud.log 2>&1

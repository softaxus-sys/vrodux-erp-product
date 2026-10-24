# P6 part 2 end-to-end: keys, then failure testing. Expects /tmp/gwbranch published, the two prototype
# databases freshly created, this folder AND Deploy/installer/scripts/check-branch-code.ps1 copied to /tmp/proto.
# Usage: bash /tmp/proto/run-failure.sh
cd /tmp/proto
# Node on Windows reads "/tmp" as C:\tmp - hand it the real folder.
export PROTO_DIR="$(cygpath -w /tmp/proto)"
listening() { powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue) { 'yes' }" | tr -d '\r'; }
up()   { for i in $(seq 1 90); do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$1/health)" = 200 ] && return 0; done; echo "port $1 did not come up"; exit 1; }
stopsrv() {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w /tmp/proto/kill-port.ps1)" -Port $1
  for i in $(seq 1 30); do [ -z "$(listening $1)" ] && return 0; sleep 1; done
  echo "port $1 still in use"; exit 1
}
start() { [ -n "$(listening $2)" ] && { echo "port $2 already in use before start"; exit 1; }; (bash $1 &); up $2; }
step() { echo; echo "=== $1"; node failure.cjs $1 || FAILED="$FAILED $1"; }
FAILED=""

start start-cloud4.sh 5301
sqlcmd -S SHAHBAZ-QFINITY -E -i "$(cygpath -w /tmp/proto/seed-cloud.sql)" > /dev/null
step keys1
start start-branch3.sh 5302
step keys2
stopsrv 5302; start start-branch3.sh 5302
step keys3
stopsrv 5302; start start-branch3.sh 5302
sleep 40                                   # let the fresh key connect and the menu arrive
stopsrv 5301                               # head office goes down
step backlog
start start-cloud4.sh 5301
step partial                               # stops the branch itself the moment the upload is part-way through
for i in $(seq 1 30); do [ -z "$(listening 5302)" ] && break; sleep 1; done
start start-branch3.sh 5302
step complete
step reseed
echo; echo "Failed phases:${FAILED:- none}"

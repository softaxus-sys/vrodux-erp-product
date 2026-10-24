# usage: source env.sh <DbName>
DB="$1"
CS="Server=SHAHBAZ-QFINITY;Database=$DB;Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=True;"
for n in Identity POS Inventory Sales Purchase Hr Finance Crm Construction RealEstate Hospitality Restaurant Recipe ProjectManagement Visa Support Seo Calendar AiAssistant Notifications Library Manufacturing Trade Fbr; do
  export "ConnectionStrings__${n}Db=$CS"
done
export ASPNETCORE_ENVIRONMENT=Development
export Jwt__Secret="test-only-multibranch-secret-0123456789abcdefghij"

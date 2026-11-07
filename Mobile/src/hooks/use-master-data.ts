import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hasModuleAccess, hasPermission } from "@/store/auth.store";
import { MASTER_REGISTRY, masterById, type MasterDef, type MasterRecord } from "@/lib/master-data";

const KEY = "master-data";

/** Masters this session may open: the tenant owns the module and the user holds one of the view keys. */
export function visibleMasters(): MasterDef[] {
  return MASTER_REGISTRY.filter(
    (m) => hasModuleAccess(m.module) && (!m.viewPermission?.length || hasPermission(...m.viewPermission)),
  );
}

export const canWriteMaster = (m: MasterDef) => !m.writePermission?.length || hasPermission(...m.writePermission);

export function useMasterRecords(masterId: string) {
  const master = masterById(masterId);
  return useQuery({
    queryKey: [KEY, masterId],
    queryFn: () => (master as MasterDef).fetchAll(),
    enabled: Boolean(master),
  });
}

export function useSaveMaster(masterId: string) {
  const qc = useQueryClient();
  const master = masterById(masterId) as MasterDef;
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: MasterRecord }) =>
      id ? (master.update as NonNullable<MasterDef["update"]>)(id, data) : (master.create as NonNullable<MasterDef["create"]>)(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, masterId] }),
  });
}

export function useDeleteMaster(masterId: string) {
  const qc = useQueryClient();
  const master = masterById(masterId) as MasterDef;
  return useMutation({
    mutationFn: (id: string) => (master.remove as NonNullable<MasterDef["remove"]>)(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, masterId] }),
  });
}

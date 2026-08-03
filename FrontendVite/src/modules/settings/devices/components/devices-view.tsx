import * as React from "react";
import { Smartphone, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useBranches } from "@/hooks/identity/use-branches";
import { useDeviceRegistrations, useUpdateDeviceRegistration, useRemoveDeviceRegistration } from "@/hooks/restaurant/use-devices";
import type { DeviceRegistrationDto } from "@/lib/restaurant/devices.api";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DevicesView() {
  const canEdit = useCan("restaurant.devices.edit");
  const { data: devices = [], isLoading } = useDeviceRegistrations();
  const { data: branches = [] } = useBranches();
  const updateDevice = useUpdateDeviceRegistration();
  const removeDevice = useRemoveDeviceRegistration();

  const branchName = (id: string | null) => id ? (branches.find(b => b.id === id)?.name ?? "—") : "All Branches";

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" /> Registered Devices
        </h1>
        <p className="text-sm text-muted-foreground">
          POS terminals/tablets that have connected to this tenant — inventory only, this list doesn't gate access.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>
        ) : devices.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No devices have registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Device</th>
                  <th className="px-4 py-2.5 font-medium">Branch</th>
                  <th className="px-4 py-2.5 font-medium">Last Seen</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  {canEdit && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <DeviceRow key={d.id} d={d} branchName={branchName(d.branchId)}
                    canEdit={canEdit}
                    onToggleActive={() => updateDevice.mutate({ id: d.id, deviceName: d.deviceName, branchId: d.branchId, isActive: !d.isActive })}
                    onRemove={() => removeDevice.mutate(d.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceRow({ d, branchName, canEdit, onToggleActive, onRemove }: {
  d: DeviceRegistrationDto; branchName: string; canEdit: boolean;
  onToggleActive: () => void; onRemove: () => void;
}) {
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-2.5 font-medium text-foreground">{d.deviceName}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{branchName}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{timeAgo(d.lastSeenAt)}</td>
      <td className="px-4 py-2.5">
        <button onClick={canEdit ? onToggleActive : undefined} disabled={!canEdit}
          className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
            d.isActive ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground")}>
          {d.isActive ? "Active" : "Deactivated"}
        </button>
      </td>
      {canEdit && (
        <td className="px-4 py-2.5 text-right">
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

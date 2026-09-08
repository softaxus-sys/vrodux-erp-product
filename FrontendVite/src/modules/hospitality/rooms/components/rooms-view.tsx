import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, X, BedDouble, Users, Maximize2, Eye, Wifi, Wind,
  Coffee, Star, Cigarette, Accessibility, Wrench, SprayCan,
  ChevronRight, Filter,
} from "lucide-react";
import type { RoomDto as Room, RoomStatus, RoomType } from "@/lib/hospitality/hospitality.api";
import { useRooms, useRoomsSummary } from "@/hooks/hospitality/use-hospitality";
import { formatCurrency, fitTextClass, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { AddRoomForm } from "./add-room-form";

const STATUS_CONFIG: Record<RoomStatus, { label: string; color: string; bg: string; dot: string }> = {
  available:   { label: "Available",   color: "text-success",            bg: "bg-success/10",            dot: "bg-success" },
  occupied:    { label: "Occupied",    color: "text-primary",            bg: "bg-primary/10",            dot: "bg-primary" },
  reserved:    { label: "Reserved",    color: "text-blue-500",           bg: "bg-blue-500/10",           dot: "bg-blue-500" },
  maintenance: { label: "Maintenance", color: "text-destructive",        bg: "bg-destructive/10",        dot: "bg-destructive" },
  cleaning:    { label: "Cleaning",    color: "text-warning",            bg: "bg-warning/10",            dot: "bg-warning" },
};

const TYPE_CONFIG: Record<RoomType, { label: string }> = {
  standard:  { label: "Standard" },
  deluxe:    { label: "Deluxe" },
  suite:     { label: "Suite" },
  penthouse: { label: "Penthouse" },
  studio:    { label: "Studio" },
};

const VIEW_ICONS: Record<string, string> = {
  sea: "🌊", city: "🏙️", pool: "🏊", garden: "🌿", courtyard: "🏛️",
};

const ROOM_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "standard", label: "Standard" },
  { value: "studio", label: "Studio" },
  { value: "deluxe", label: "Deluxe" },
  { value: "suite", label: "Suite" },
  { value: "penthouse", label: "Penthouse" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
  { value: "cleaning", label: "Cleaning" },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps { label: string; value: string | number; sub?: string; accent?: string }
function StatCard({ label, value, sub, accent = "bg-primary" }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-1`} />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

// ─── Room Drawer ──────────────────────────────────────────────────────────────
function RoomDrawer({ room, onClose }: { room: Room; onClose: () => void }) {
  const currency = useCurrency();
  const cfg = STATUS_CONFIG[room.status];

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Room {room.roomNumber}</p>
            <h2 className="text-lg font-bold text-foreground">
              Floor {room.floor} · {TYPE_CONFIG[room.type].label}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Current Guest (if occupied) */}
          {room.currentGuestName && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-medium text-primary mb-2">Current Guest</p>
              <p className="text-sm font-semibold text-foreground">{room.currentGuestName}</p>
              {room.checkoutDate && (
                <p className="text-xs text-muted-foreground mt-0.5">Checks out: {room.checkoutDate}</p>
              )}
              {room.currentBookingId && (
                <p className="text-xs text-muted-foreground mt-0.5">Booking: {room.currentBookingId}</p>
              )}
            </div>
          )}

          {/* Key Details */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Room Details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: BedDouble, label: "Bed Type", value: room.bedType.charAt(0).toUpperCase() + room.bedType.slice(1) },
                { icon: Eye, label: "View", value: `${VIEW_ICONS[room.view] || ""} ${room.view.charAt(0).toUpperCase() + room.view.slice(1)}` },
                { icon: Users, label: "Capacity", value: `${room.capacity} guests` },
                { icon: Maximize2, label: "Size", value: `${room.sizeSqm} m²` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-muted/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rate */}
          <div className="bg-muted/20 rounded-xl p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Rate Per Night</p>
            <p className={cn("font-bold text-foreground truncate", fitTextClass(formatCurrency(room.ratePerNight, currency), "2xl"))}
               title={formatCurrency(room.ratePerNight, currency)}>
              {formatCurrency(room.ratePerNight, currency)}
            </p>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-2">
            {room.isAccessible && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">
                <Accessibility className="w-3 h-3" /> Accessible
              </span>
            )}
            {room.isSmokingAllowed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
                <Cigarette className="w-3 h-3" /> Smoking Allowed
              </span>
            )}
            {!room.isSmokingAllowed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-muted-foreground text-xs font-medium">
                Non-Smoking
              </span>
            )}
          </div>

          {/* Amenities */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {room.amenities.map((amenity) => (
                <span key={amenity} className="px-2.5 py-1 rounded-lg bg-muted/30 text-xs text-foreground border border-border">
                  {amenity}
                </span>
              ))}
            </div>
          </div>

          {/* Last Cleaned */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <SprayCan className="w-4 h-4" />
              <span className="text-xs">Last Cleaned</span>
            </div>
            <span className="text-xs font-medium text-foreground">{room.lastCleaned}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          {room.status === "available" && (
            <Button className="flex-1" size="sm">Assign Booking</Button>
          )}
          {room.status === "occupied" && (
            <Button variant="outline" className="flex-1" size="sm">View Booking</Button>
          )}
          {room.status === "maintenance" && (
            <Button variant="outline" className="flex-1" size="sm">
              <Wrench className="w-3.5 h-3.5 mr-1.5" /> Mark Ready
            </Button>
          )}
          {room.status === "cleaning" && (
            <Button variant="outline" className="flex-1" size="sm">
              <SprayCan className="w-3.5 h-3.5 mr-1.5" /> Mark Clean
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Room Card (Grid View) ────────────────────────────────────────────────────
function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  const currency = useCurrency();
  const cfg = STATUS_CONFIG[room.status];
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group relative"
    >
      {/* Status bar at top */}
      <div className={`absolute top-0 left-4 right-4 h-0.5 rounded-b-full ${cfg.dot}`} />

      <div className="flex items-start justify-between mb-3 mt-1">
        <div>
          <p className="text-lg font-bold text-foreground">{room.roomNumber}</p>
          <p className="text-xs text-muted-foreground">Floor {room.floor}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-sm font-medium text-foreground">{TYPE_CONFIG[room.type].label}</p>
        <p className="text-xs text-muted-foreground capitalize">{room.bedType} · {VIEW_ICONS[room.view]} {room.view}</p>
      </div>

      {room.currentGuestName && (
        <p className="text-xs text-primary font-medium mb-2 truncate">{room.currentGuestName}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex items-center gap-1 text-xs"><Users className="w-3 h-3" />{room.capacity}</span>
          <span className="flex items-center gap-1 text-xs"><Maximize2 className="w-3 h-3" />{room.sizeSqm}m²</span>
        </div>
        <span className="text-xs font-semibold text-foreground">
          {formatCurrency(room.ratePerNight, currency)}<span className="text-muted-foreground font-normal">/n</span>
        </span>
      </div>

      <ChevronRight className="absolute right-3 bottom-3 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RoomsView() {
  const { data: rooms = [] } = useRooms();
  const { data: roomsSummary } = useRoomsSummary();

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const floors = React.useMemo(() => {
    const f = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
    return f;
  }, [rooms]);

  const filtered = React.useMemo(() => {
    return rooms.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.roomNumber.includes(q) ||
        r.type.includes(q) ||
        (r.currentGuestName?.toLowerCase().includes(q) ?? false);
      const matchType = typeFilter === "all" || r.type === typeFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [rooms, search, typeFilter, statusFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rooms</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{roomsSummary?.total ?? rooms.length} rooms · {roomsSummary?.occupancyRate ?? 0}% occupied</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <BedDouble className="w-3.5 h-3.5 mr-1.5" /> Add Room
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Rooms" value={roomsSummary?.total ?? rooms.length} accent="bg-primary" />
          <StatCard label="Available" value={roomsSummary?.available ?? rooms.filter(r => r.status === "available").length} accent="bg-success" />
          <StatCard label="Occupied" value={roomsSummary?.occupied ?? rooms.filter(r => r.status === "occupied").length} accent="bg-primary" />
          <StatCard label="Reserved" value={roomsSummary?.reserved ?? rooms.filter(r => r.status === "reserved").length} accent="bg-blue-500" />
          <StatCard label="Cleaning" value={roomsSummary?.cleaning ?? rooms.filter(r => r.status === "cleaning").length} accent="bg-warning" />
          <StatCard label="Maintenance" value={roomsSummary?.maintenance ?? rooms.filter(r => r.status === "maintenance").length} accent="bg-destructive" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52 max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rooms or guests…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {ROOM_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_OPTIONS.slice(1).map(opt => {
              const cfg = STATUS_CONFIG[opt.value as RoomStatus];
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(statusFilter === opt.value ? "all" : opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === opt.value
                      ? `${cfg.bg} ${cfg.color}`
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rooms Grid — grouped by floor */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BedDouble className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No rooms match your filters</p>
          </div>
        ) : (
          <div className="space-y-6">
            {floors.map(floor => {
              const floorRooms = filtered.filter(r => r.floor === floor);
              if (floorRooms.length === 0) return null;
              return (
                <div key={floor}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Floor {floor}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs text-muted-foreground">{floorRooms.length} room{floorRooms.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {floorRooms.map(room => (
                      <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedRoom && (
          <RoomDrawer room={selectedRoom} onClose={() => setSelectedRoom(null)} />
        )}
      </AnimatePresence>
      <AddRoomForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}


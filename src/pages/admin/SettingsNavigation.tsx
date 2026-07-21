import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeRise } from "@/components/motion";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_NAV_CONFIG, NAV_SETTINGS_KEY, NavItem } from "@/config/adminNavConfig";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Menu, GripVertical, ChevronDown, ChevronRight, ArrowLeft, RotateCcw, Save, Plus, Trash2, FolderOpen,
  icons,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const LucideIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (icons as any)[name];
  if (!Icon) return <Menu className={className} />;
  return <Icon className={className} />;
};

/* ─── Sortable Item ─── */
interface SortableItemProps {
  item: NavItem;
  depth: number;
  onToggleExpand: (id: string) => void;
  expanded: Set<string>;
  onRemove: (id: string) => void;
  onUnnest: (id: string) => void;
}

const SortableItem = ({ item, depth, onToggleExpand, expanded, onRemove, onUnnest }: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expanded.has(item.id);

  return (
    <div ref={setNodeRef} style={style} className={cn("transition-opacity", isDragging && "opacity-40")}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-secondary/50 hover:bg-secondary/80 transition-colors group",
          depth > 0 && "ml-8 border-l-2 border-l-primary/20"
        )}
      >
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors p-1">
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <LucideIcon name={item.icon} className="h-4 w-4" />
        </span>

        <span className="text-sm font-medium flex-1">{item.label}</span>

        {item.path && (
          <span className="text-xs text-muted-foreground font-mono hidden sm:block">{item.path}</span>
        )}

        {hasChildren && (
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {item.children!.length} items
          </Badge>
        )}

        {hasChildren && (
          <button
            onClick={() => onToggleExpand(item.id)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}

        {depth > 0 && (
          <button
            onClick={() => onUnnest(item.id)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            title="Move out of group"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Don't allow removing dashboard or settings */}
        {item.id !== "dashboard" && item.id !== "settings" && (
          <button
            onClick={() => onRemove(item.id)}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Render children */}
      {hasChildren && isExpanded && (
        <SortableContext items={item.children!.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => (
              <SortableItem
                key={child.id}
                item={child}
                depth={depth + 1}
                onToggleExpand={onToggleExpand}
                expanded={expanded}
                onRemove={onRemove}
                onUnnest={onUnnest}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

/* ─── Main Page ─── */
const SettingsNavigation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["nav-config-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", NAV_SETTINGS_KEY)
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        try { return JSON.parse(data.value) as NavItem[]; } catch { return DEFAULT_NAV_CONFIG; }
      }
      return DEFAULT_NAV_CONFIG;
    },
  });

  const [items, setItems] = useState<NavItem[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["users"]));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Initialize from saved config
  const config = items ?? savedConfig ?? DEFAULT_NAV_CONFIG;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getAllIds = (navItems: NavItem[]): string[] => {
    return navItems.flatMap((item) => [item.id, ...(item.children ? getAllIds(item.children) : [])]);
  };

  const findItemById = (navItems: NavItem[], id: string): NavItem | null => {
    for (const item of navItems) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findParent = (navItems: NavItem[], id: string): { parent: NavItem[] | null; parentItem: NavItem | null; index: number } => {
    for (let i = 0; i < navItems.length; i++) {
      if (navItems[i].id === id) return { parent: navItems, parentItem: null, index: i };
      if (navItems[i].children) {
        for (let j = 0; j < navItems[i].children!.length; j++) {
          if (navItems[i].children![j].id === id) return { parent: navItems[i].children!, parentItem: navItems[i], index: j };
        }
      }
    }
    return { parent: null, parentItem: null, index: -1 };
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const newItems = JSON.parse(JSON.stringify(config)) as NavItem[];
    const activeInfo = findParent(newItems, active.id as string);
    const overInfo = findParent(newItems, over.id as string);

    if (!activeInfo.parent || !overInfo.parent) return;

    // Same level reorder
    if (activeInfo.parent === overInfo.parent ||
        (activeInfo.parentItem?.id === overInfo.parentItem?.id)) {
      const arr = activeInfo.parentItem
        ? newItems.find(i => i.id === activeInfo.parentItem!.id)!.children!
        : newItems;

      // Find indices in the actual array
      const oldIndex = arr.findIndex(i => i.id === active.id);
      const newIndex = arr.findIndex(i => i.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(arr, oldIndex, newIndex);
        if (activeInfo.parentItem) {
          const parentIdx = newItems.findIndex(i => i.id === activeInfo.parentItem!.id);
          newItems[parentIdx].children = reordered;
        } else {
          setItems(reordered);
          return;
        }
      }
    } else {
      // Cross-level: remove from source, insert at target
      const item = findItemById(newItems, active.id as string);
      if (!item) return;

      // Remove from source
      if (activeInfo.parentItem) {
        const pIdx = newItems.findIndex(i => i.id === activeInfo.parentItem!.id);
        newItems[pIdx].children = newItems[pIdx].children!.filter(c => c.id !== active.id);
      } else {
        const idx = newItems.findIndex(i => i.id === active.id);
        newItems.splice(idx, 1);
      }

      // Insert at target
      if (overInfo.parentItem) {
        const pIdx = newItems.findIndex(i => i.id === overInfo.parentItem!.id);
        const oIdx = newItems[pIdx].children!.findIndex(c => c.id === over.id);
        newItems[pIdx].children!.splice(oIdx, 0, { ...item, children: undefined });
      } else {
        const oIdx = newItems.findIndex(i => i.id === over.id);
        newItems.splice(oIdx, 0, item);
      }
    }

    setItems(newItems);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleNestIntoAbove = (id: string) => {
    const newItems = JSON.parse(JSON.stringify(config)) as NavItem[];
    const idx = newItems.findIndex((i) => i.id === id);
    if (idx <= 0) return;

    const item = newItems.splice(idx, 1)[0];
    const target = newItems[idx - 1];
    if (!target.children) target.children = [];
    // When nesting, strip children from the item
    target.children.push({ ...item, children: undefined });
    setExpanded((prev) => new Set(prev).add(target.id));
    setItems(newItems);
  };

  const handleUnnest = (id: string) => {
    const newItems = JSON.parse(JSON.stringify(config)) as NavItem[];
    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].children) {
        const childIdx = newItems[i].children!.findIndex((c) => c.id === id);
        if (childIdx !== -1) {
          const child = newItems[i].children!.splice(childIdx, 1)[0];
          newItems.splice(i + 1, 0, child);
          // Clean up empty groups
          if (newItems[i].children!.length === 0 && !newItems[i].path) {
            newItems.splice(i, 1);
          }
          setItems(newItems);
          return;
        }
      }
    }
  };

  const handleRemove = (id: string) => {
    const newItems = JSON.parse(JSON.stringify(config)) as NavItem[];
    // Try top level
    const idx = newItems.findIndex((i) => i.id === id);
    if (idx !== -1) {
      // If has children, move children up
      const removed = newItems.splice(idx, 1)[0];
      if (removed.children) {
        newItems.splice(idx, 0, ...removed.children);
      }
      setItems(newItems);
      return;
    }
    // Try nested
    for (const item of newItems) {
      if (item.children) {
        item.children = item.children.filter((c) => c.id !== id);
      }
    }
    setItems(newItems);
  };

  const handleCreateGroup = () => {
    const newItems = JSON.parse(JSON.stringify(config)) as NavItem[];
    const groupId = `group-${Date.now()}`;
    // Insert before settings (last item)
    const settingsIdx = newItems.findIndex((i) => i.id === "settings");
    const insertIdx = settingsIdx !== -1 ? settingsIdx : newItems.length;
    newItems.splice(insertIdx, 0, {
      id: groupId,
      label: "New group",
      icon: "FolderOpen",
      path: "",
      children: [],
    });
    setExpanded((prev) => new Set(prev).add(groupId));
    setItems(newItems);
  };

  const handleReset = () => {
    setItems([...DEFAULT_NAV_CONFIG]);
    toast({ title: "Reset to defaults", description: "Save to apply changes." });
  };

  const handleSave = async () => {
    setSaving(true);
    const configToSave = config;
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: NAV_SETTINGS_KEY, value: JSON.stringify(configToSave), description: "Admin sidebar navigation configuration" },
        { onConflict: "key" }
      );

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Navigation saved" });
      queryClient.invalidateQueries({ queryKey: ["nav-config"] });
      queryClient.invalidateQueries({ queryKey: ["nav-config-edit"] });
    }
    setSaving(false);
  };

  const activeItem = activeId ? findItemById(config, activeId) : null;

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse text-muted-foreground">Loading navigation settings…</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <FadeRise>
        <div className="flex items-center gap-3">
          <Link to="/admin/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Menu navigation</h1>
            <p className="text-muted-foreground mt-1">
              Drag and drop to reorder sidebar items. Nest items to create dropdown groups.
            </p>
          </div>
        </div>
      </FadeRise>

      <FadeRise delay={80}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Sidebar items</CardTitle>
                <CardDescription>
                  Drag items to reorder. Use the arrow button to unnest, or drag items onto groups.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCreateGroup} className="gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  New group
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={getAllIds(config)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {config.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      depth={0}
                      onToggleExpand={toggleExpand}
                      expanded={expanded}
                      onRemove={handleRemove}
                      onUnnest={handleUnnest}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeItem && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-card shadow-soft-lg">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <LucideIcon name={activeItem.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">{activeItem.label}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            <div className="mt-4 p-4 rounded-2xl bg-secondary/50 text-xs text-muted-foreground space-y-1">
              <p><strong>Tips:</strong></p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Drag the grip handle to reorder items</li>
                <li>Click the arrow icon on nested items to move them out of a group</li>
                <li>Create a new group and drag items into it to build dropdown menus</li>
                <li>Dashboard and Settings cannot be removed</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </FadeRise>

      {/* Sticky save bar */}
      <div className="sticky bottom-4">
        <Card className="shadow-soft-lg bg-card/95 backdrop-blur">
          <CardContent className="py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {items ? "You have unsaved changes" : "No changes to save"}
            </p>
            <Button onClick={handleSave} disabled={saving || !items} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save navigation"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsNavigation;
